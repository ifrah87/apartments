import { NextRequest, NextResponse } from "next/server";
import type { LeaseAgreement } from "@/lib/leases";
import { ChargeEntry, PaymentEntry, StatementRow, createStatement, normalizeId } from "@/lib/reports/tenantStatement";
import { listManualPayments } from "@/lib/reports/manualPayments";
import { bankTransactionsRepo, datasetsRepo, tenantsRepo, RepoError } from "@/lib/repos";
import { query } from "@/lib/db";

function handleError(err: unknown) {
  const status = err instanceof RepoError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unexpected error.";
  return NextResponse.json({ ok: false, error: message }, { status });
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizeDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

type StoredInvoiceRow = {
  id: string;
  invoice_number: string | null;
  invoice_date: string | Date | null;
  total_amount: number | null;
};

type PaymentRecordRow = {
  id: string;
  invoice_id: string | null;
  payment_date: string | Date | null;
  amount: number | null;
  method: string | null;
  reference: string | null;
  bank_transaction_id: string | null;
};

type AllocatedPaymentRow = {
  transaction_id: string;
  invoice_id: string | null;
  date: string;
  description: string;
  amount: number;
};

type LegacyInvoiceRow = {
  id?: string;
  tenantId?: string;
  tenant_id?: string;
  tenantName?: string;
  tenant_name?: string;
  unitId?: string;
  unit_id?: string;
  unitLabel?: string;
  unit_label?: string;
  invoiceDate?: string;
  invoice_date?: string;
  total?: number | string;
  totalAmount?: number | string;
  total_amount?: number | string;
  status?: string;
};

type DepositSummaryRow = {
  tenant_id?: string;
  deposit_charged?: string | number;
  deposit_received?: string | number;
  deposit_released?: string | number;
};

type DepositTransactionRow = {
  id?: string;
  tenant_id?: string;
  date?: string;
  type?: string;
  amount?: string | number;
  note?: string;
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeUnitLabel(value: unknown) {
  return normalizeText(String(value ?? "").replace(/^unit\s+/i, ""));
}

function normalizeDateKey(value: unknown) {
  const date = parseDate(value === undefined || value === null ? null : String(value));
  return date ? toISO(normalizeDay(date)) : null;
}

function toAmount(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0;
}

function isMissingRelation(err: unknown, relation: string) {
  const code = (err as { code?: string } | null)?.code;
  const message = err instanceof Error ? err.message : String(err ?? "");
  return code === "42P01" || code === "42703" || message.includes(relation);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  try {
    const { tenantId } = await params;
    const normalizedTenantId = normalizeId(tenantId);
    const tenantIdValue = normalizedTenantId;
    const allTenants = await tenantsRepo.listTenants();
    let tenant =
      allTenants.find((t) => normalizeId(t.id) === tenantIdValue) ||
      allTenants.find((t) => normalizeId(t.reference) === tenantIdValue) ||
      null;

    if (!tenant) {
      return NextResponse.json({ ok: false, error: "Tenant not found" }, { status: 404 });
    }

    const tenantNameKey = normalizeText(tenant.name);
    const tenantReferenceKey = normalizeId(tenant.reference);
    const relatedTenants = allTenants.filter((candidate) => {
      const sameId = normalizeId(candidate.id) === normalizeId(tenant?.id);
      const sameReference = tenantReferenceKey && normalizeId(candidate.reference) === tenantReferenceKey;
      const sameName = tenantNameKey && normalizeText(candidate.name) === tenantNameKey;
      return Boolean(sameId || sameReference || sameName);
    });
    const relatedTenantIds = Array.from(
      new Set(relatedTenants.map((candidate) => String(candidate.id || "").trim()).filter(Boolean)),
    );
    const relatedTenantKeys = new Set(relatedTenantIds.map((id) => normalizeId(id)).filter(Boolean));
    const relatedTenantNameKeys = new Set(
      relatedTenants.map((candidate) => normalizeText(candidate.name)).filter(Boolean),
    );
    const relatedUnitKeys = new Set(
      relatedTenants.map((candidate) => normalizeUnitLabel(candidate.unit)).filter(Boolean),
    );

    const { searchParams } = new URL(req.url);
    const endRaw = parseDate(searchParams.get("end")) ?? new Date();
    const requestedStart = parseDate(searchParams.get("start"));
    const end = normalizeDay(endRaw);
    if (requestedStart && normalizeDay(requestedStart) > end) {
      return NextResponse.json({ ok: false, error: "Start date must be before end date" }, { status: 400 });
    }

    const dbInvoiceRows = await query<StoredInvoiceRow>(
      `SELECT id, invoice_number, invoice_date, total_amount
       FROM public.invoices
       WHERE tenant_id::text = ANY($1::text[])
         AND COALESCE(is_deleted, false) = false
         AND LOWER(COALESCE(status, '')) <> 'void'
         AND invoice_date <= $2
       ORDER BY invoice_date ASC, created_at ASC, id ASC`,
      [relatedTenantIds, toISO(end)],
    );
    const dbInvoiceIds = new Set(dbInvoiceRows.rows.map((row) => String(row.id)));

    const [
      manualPayments,
      legacyInvoiceRows,
      depositSummaries,
      depositTransactions,
      leaseAgreements,
      paymentRows,
      allocatedPaymentRows,
    ] = await Promise.all([
      listManualPayments(),
      datasetsRepo.getDataset<LegacyInvoiceRow[]>("billing_invoices", []).catch(() => []),
      datasetsRepo.getDataset<DepositSummaryRow[]>("tenant_deposits", []).catch(() => []),
      datasetsRepo.getDataset<DepositTransactionRow[]>("deposit_transactions", []).catch(() => []),
      datasetsRepo.getDataset<LeaseAgreement[]>("lease_agreements", []).catch(() => []),
      query<PaymentRecordRow>(
        `SELECT id, invoice_id, payment_date, amount, method, reference, bank_transaction_id
         FROM public.payments
         WHERE tenant_id::text = ANY($1::text[])
           AND COALESCE(is_deleted, false) = false
           AND payment_date <= $2
         ORDER BY payment_date ASC, created_at ASC, id ASC`,
        [relatedTenantIds, toISO(end)],
      )
        .then((result) => result.rows)
        .catch((err) => {
          if (isMissingRelation(err, 'relation "public.payments" does not exist')) return [];
          if (isMissingRelation(err, 'column "tenant_id"')) return [];
          throw err;
        }),
      query<AllocatedPaymentRow>(
        `SELECT
           ba.transaction_id::text AS transaction_id,
           ba.invoice_id::text AS invoice_id,
           bt.txn_date::text AS date,
           COALESCE(bt.payee, bt.particulars, 'Bank payment') AS description,
           SUM(ba.allocated_amount)::numeric AS amount
         FROM public.bank_allocations ba
         JOIN public.bank_transactions bt ON bt.id = ba.transaction_id
         JOIN public.invoices i ON i.id::text = ba.invoice_id::text
         WHERE i.tenant_id::text = ANY($1::text[])
           AND bt.txn_date <= $2
           AND COALESCE(bt.is_deleted, false) = false
           AND COALESCE(i.is_deleted, false) = false
           AND LOWER(COALESCE(i.status, '')) <> 'void'
         GROUP BY ba.transaction_id, ba.invoice_id, bt.txn_date, bt.payee, bt.particulars
         ORDER BY bt.txn_date ASC, ba.transaction_id ASC`,
        [relatedTenantIds, toISO(end)],
      )
        .then((result) => result.rows)
        .catch(async (err) => {
          if (
            !isMissingRelation(err, 'relation "bank_allocations" does not exist') &&
            !isMissingRelation(err, 'relation "public.bank_allocations" does not exist')
          ) {
            throw err;
          }
          const bankTransactions = await bankTransactionsRepo.listTransactions();
          return bankTransactions
            .map((row) => ({
              transaction_id: String(row.id || ""),
              invoice_id: null,
              date: row.date,
              description: row.description,
              amount: Number(row.amount || 0),
              tenant_id: row.tenant_id,
            }))
            .filter((row) => relatedTenantKeys.has(normalizeId(row.tenant_id)))
            .map((row) => ({
              transaction_id: row.transaction_id,
              invoice_id: row.invoice_id,
              date: row.date,
              description: row.description,
              amount: row.amount,
            }));
        }),
    ]);

    const invoiceCharges: ChargeEntry[] = dbInvoiceRows.rows.flatMap((invoice) => {
      const dateKey = normalizeDateKey(invoice.invoice_date);
      const amount = toAmount(invoice.total_amount);
      if (!dateKey || amount <= 0) return [];
      return [
        {
          date: dateKey,
          amount,
          description: invoice.invoice_number ? `Invoice ${invoice.invoice_number}` : "Invoice charge",
          category: "invoice",
          meta: {
            invoice_id: invoice.id,
            invoice_number: invoice.invoice_number,
          },
        },
      ];
    });

    const legacyCharges: ChargeEntry[] = (Array.isArray(legacyInvoiceRows) ? legacyInvoiceRows : []).flatMap((invoice) => {
      const legacyId = String(invoice?.id ?? "").trim();
      if (!legacyId || dbInvoiceIds.has(legacyId)) return [];
      const invoiceDate = normalizeDateKey(invoice?.invoiceDate ?? invoice?.invoice_date);
      const amount = toAmount(invoice?.total ?? invoice?.totalAmount ?? invoice?.total_amount);
      if (!invoiceDate || amount <= 0) return [];

      const invoiceTenantId = normalizeId(invoice?.tenantId ?? invoice?.tenant_id);
      const invoiceTenantName = normalizeText(invoice?.tenantName ?? invoice?.tenant_name);
      const invoiceUnitLabel = normalizeUnitLabel(invoice?.unitLabel ?? invoice?.unit_label);

      const matchesTenant =
        (invoiceTenantId && relatedTenantKeys.has(invoiceTenantId)) ||
        (invoiceTenantName && relatedTenantNameKeys.has(invoiceTenantName)) ||
        (invoiceUnitLabel && relatedUnitKeys.has(invoiceUnitLabel));
      if (!matchesTenant) return [];

      return [
        {
          date: invoiceDate,
          amount,
          description: legacyId ? `Invoice ${legacyId}` : "Legacy invoice charge",
          category: "invoice",
          meta: { invoice_id: legacyId, legacy: true },
        },
      ];
    });

    const paymentEntries: PaymentEntry[] = [];
    const paymentKeys = new Set<string>();
    const addPayment = (entry: PaymentEntry, key: string) => {
      const dateKey = normalizeDateKey(entry.date);
      const amount = toAmount(entry.amount);
      if (!dateKey || amount <= 0 || paymentKeys.has(key)) return;
      paymentKeys.add(key);
      paymentEntries.push({
        date: dateKey,
        amount,
        description: entry.description,
        source: entry.source,
      });
    };

    paymentRows.forEach((row) => {
      const dateKey = normalizeDateKey(row.payment_date);
      const amount = toAmount(row.amount);
      if (!dateKey || amount <= 0) return;
      const paymentKey =
        row.bank_transaction_id && row.invoice_id
          ? `bank:${row.bank_transaction_id}:${row.invoice_id}:${amount}:${dateKey}`
          : `payment:${row.id}`;
      addPayment(
        {
          date: dateKey,
          amount,
          description: row.reference || row.method || "Recorded payment",
          source: "payment",
        },
        paymentKey,
      );
    });

    allocatedPaymentRows.forEach((row) => {
      const dateKey = normalizeDateKey(row.date);
      const amount = toAmount(row.amount);
      if (!dateKey || amount <= 0) return;
      addPayment(
        {
          date: dateKey,
          amount,
          description: row.description,
          source: "bank",
        },
        `bank:${row.transaction_id}:${row.invoice_id ?? ""}:${amount}:${dateKey}`,
      );
    });

    manualPayments
      .filter((entry) => relatedTenantKeys.has(normalizeId(entry.tenant_id)))
      .forEach((entry) => {
        addPayment(
          {
            date: entry.date,
            amount: Number(entry.amount || 0),
            description: entry.description || "Manual payment",
            source: "manual",
          },
          `manual:${entry.id}`,
        );
      });

    const depositTxRows = (Array.isArray(depositTransactions) ? depositTransactions : []).filter((entry) =>
      relatedTenantKeys.has(normalizeId(entry?.tenant_id)),
    );
    const depositChargesFromTx: ChargeEntry[] = [];
    depositTxRows.forEach((entry) => {
      const typeKey = normalizeText(entry.type);
      const dateKey = normalizeDateKey(entry.date);
      const amount = toAmount(entry.amount);
      if (!dateKey || amount <= 0) return;
      if (/(received|applied|apply|deduction|used|utilized)/.test(typeKey)) {
        addPayment(
          {
            date: dateKey,
            amount,
            description: entry.note || "Security deposit",
            source: "deposit",
          },
          `deposit-payment:${String(entry.id || `${dateKey}:${typeKey}:${amount}:${entry.note || ""}`)}`,
        );
        return;
      }
      if (/(charge|charged|expected)/.test(typeKey)) {
        depositChargesFromTx.push({
          date: dateKey,
          amount,
          description: entry.note || "Security deposit",
          category: "deposit",
        });
      }
    });

    let depositChargeEntry: ChargeEntry | null = null;
    if (!depositChargesFromTx.length) {
      const depositSummaryMap = new Map<string, DepositSummaryRow>();
      (Array.isArray(depositSummaries) ? depositSummaries : []).forEach((entry) => {
        const key = normalizeId(entry?.tenant_id);
        if (key) depositSummaryMap.set(key, entry);
      });
      const summary =
        relatedTenantIds
          .map((id) => depositSummaryMap.get(normalizeId(id)))
          .find((entry) => Boolean(entry)) || null;
      const summaryCharged = toAmount(summary?.deposit_charged ?? 0);
      const summaryReceived = toAmount(summary?.deposit_received ?? 0);
      const depositAmount = summaryCharged > 0 ? summaryCharged : summaryReceived;
      if (depositAmount > 0) {
        const matchingLease = (Array.isArray(leaseAgreements) ? leaseAgreements : []).find((lease) => {
          const leaseName = normalizeText(lease?.tenantName);
          const leaseUnit = normalizeUnitLabel(lease?.unit);
          return (
            (leaseName && relatedTenantNameKeys.has(leaseName)) ||
            (leaseUnit && relatedUnitKeys.has(leaseUnit))
          );
        });
        const firstDepositTxnDate = depositTxRows
          .map((entry) => normalizeDateKey(entry?.date))
          .filter((value): value is string => Boolean(value))
          .sort()[0];
        const depositDate =
          firstDepositTxnDate ||
          normalizeDateKey(matchingLease?.startDate) ||
          normalizeDateKey(requestedStart) ||
          normalizeDateKey(end) ||
          toISO(end);
        depositChargeEntry = {
          date: depositDate,
          amount: depositAmount,
          description: "Security deposit",
          category: "deposit",
        };
      }
    }

    const rawCharges = [
      ...invoiceCharges,
      ...legacyCharges,
      ...depositChargesFromTx,
      ...(depositChargeEntry ? [depositChargeEntry] : []),
    ];
    const chargeKeys = new Set<string>();
    const chargeEntries = rawCharges.filter((entry) => {
      const key = `${entry.category || "charge"}:${entry.date}:${toAmount(entry.amount)}:${entry.description || ""}`;
      if (chargeKeys.has(key)) return false;
      chargeKeys.add(key);
      return true;
    });

    const candidateDates = [
      ...chargeEntries.map((entry) => entry.date),
      ...paymentEntries.map((entry) => entry.date),
    ]
      .map((value) => normalizeDateKey(value))
      .filter((value): value is string => Boolean(value))
      .sort();
    const start = requestedStart
      ? normalizeDay(requestedStart)
      : candidateDates.length
        ? normalizeDay(new Date(candidateDates[0]))
        : (() => {
            const fallback = new Date(end);
            fallback.setUTCMonth(fallback.getUTCMonth() - 2);
            fallback.setUTCDate(1);
            return normalizeDay(fallback);
          })();

    const filteredPayments = paymentEntries.filter((entry) => {
      const date = parseDate(entry.date);
      if (!date) return false;
      const normalized = normalizeDay(date);
      return normalized >= start && normalized <= end;
    });
    const filteredCharges = chargeEntries.filter((entry) => {
      const date = parseDate(entry.date);
      if (!date) return false;
      const normalized = normalizeDay(date);
      return normalized >= start && normalized <= end;
    });
    const invoiceChargeCount = [...invoiceCharges, ...legacyCharges].filter((entry) => {
      const date = parseDate(entry.date);
      if (!date) return false;
      const normalized = normalizeDay(date);
      return normalized >= start && normalized <= end;
    }).length;

    const statementTenant = {
      id: tenant.id,
      name: tenant.name,
      property_id: tenant.property_id ?? undefined,
      building: tenant.building ?? undefined,
      unit: tenant.unit ?? undefined,
      reference: tenant.reference ?? undefined,
      monthly_rent: tenant.monthly_rent ?? undefined,
      due_day: tenant.due_day ?? undefined,
    };

    const { rows, totals } = createStatement({
      tenant: statementTenant,
      start,
      end,
      payments: filteredPayments,
      additionalCharges: filteredCharges,
      includeRentCharges: invoiceChargeCount === 0,
    });

    const payload = {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        property: tenant.building || tenant.property_id,
        unit: tenant.unit ?? undefined,
        monthlyRent: Number(tenant.monthly_rent || 0),
        dueDay: Number(tenant.due_day || 1),
      },
      period: { start: toISO(start), end: toISO(end) },
      totals,
      rows,
    };

    if (searchParams.get("format") === "csv") {
      const csv = buildStatementCsv(payload.rows, payload.tenant.name, payload.tenant.unit, payload.period);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename=\"tenant-statement-${tenantIdValue}-${payload.period.start}-to-${payload.period.end}.csv\"`,
        },
      });
    }

    return NextResponse.json({ ok: true, data: payload });
  } catch (err) {
    console.error("❌ failed to build tenant statement", err);
    return handleError(err);
  }
}

function buildStatementCsv(rows: StatementRow[], tenantName: string, unit: string | undefined, period: { start: string; end: string }) {
  const lines: string[] = [];
  lines.push(`Tenant,${csvValue(tenantName)}`);
  lines.push(`Unit,${csvValue(unit || "—")}`);
  lines.push(`Period,${csvValue(`${period.start} – ${period.end}`)}`);
  lines.push("");
  lines.push(["Date", "Type", "Description", "Charge", "Payment", "Balance", "Source"].map(csvValue).join(","));
  rows.forEach((row) => {
    lines.push(
      [
        row.date,
        row.entryType,
        row.description,
        row.charge ? row.charge.toFixed(2) : "",
        row.payment ? row.payment.toFixed(2) : "",
        row.balance.toFixed(2),
        row.source || "",
      ]
        .map(csvValue)
        .join(","),
    );
  });
  return lines.join("\n");
}

function csvValue(value: string) {
  const needsQuotes = /[",\n]/.test(value);
  const safe = value.replace(/"/g, '""');
  return needsQuotes ? `"${safe}"` : safe;
}
