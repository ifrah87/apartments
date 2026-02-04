import { randomUUID } from "crypto";
import { query } from "@/lib/db/client";
import { badRequest, notFound } from "./errors";

export type BankTransaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type?: string | null;
  property_id?: string | null;
  tenant_id?: string | null;
  reference?: string | null;
  category_id?: string | null;
  matched_tenant_id?: string | null;
  match_amount?: number | null;
  match_note?: string | null;
};

export type BankTransactionFilters = {
  start?: string;
  end?: string;
  propertyId?: string;
  tenantId?: string;
  type?: string;
};

export type BankTransactionInput = Partial<BankTransaction> & {
  date?: string;
  description?: string;
  amount?: number | string;
};

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const num = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : null;
}

function normalizeTxnRow(row: any): BankTransaction {
  return {
    id: String(row.id),
    date: row.date,
    description: row.description,
    amount: row.amount !== null && row.amount !== undefined ? Number(row.amount) : 0,
    type: row.type ?? null,
    property_id: row.property_id ?? null,
    tenant_id: row.tenant_id ?? null,
    reference: row.reference ?? null,
    category_id: row.category_id ?? null,
    matched_tenant_id: row.matched_tenant_id ?? null,
    match_amount: row.match_amount !== null && row.match_amount !== undefined ? Number(row.match_amount) : null,
    match_note: row.match_note ?? null,
  };
}

function normalizeTxnInput(payload: BankTransactionInput, requireCore = true) {
  const date = payload.date?.trim();
  const description = payload.description?.trim();
  const amount = toNumber(payload.amount);

  if (requireCore) {
    if (!date) throw badRequest("Transaction date is required.");
    if (!description) throw badRequest("Transaction description is required.");
    if (amount === null) throw badRequest("Transaction amount is required.");
  }

  return {
    id: payload.id ? String(payload.id) : undefined,
    date: date ?? payload.date,
    description: description ?? payload.description,
    amount,
    type: payload.type ?? null,
    property_id: payload.property_id ?? null,
    tenant_id: payload.tenant_id ?? null,
    reference: payload.reference ?? null,
  };
}

export async function listTransactions(filters: BankTransactionFilters = {}): Promise<BankTransaction[]> {
  const clauses: string[] = [];
  const params: any[] = [];

  if (filters.start) {
    params.push(filters.start);
    clauses.push(`date >= $${params.length}`);
  }
  if (filters.end) {
    params.push(filters.end);
    clauses.push(`date <= $${params.length}`);
  }
  if (filters.propertyId) {
    params.push(filters.propertyId);
    clauses.push(`property_id = $${params.length}`);
  }
  if (filters.tenantId) {
    params.push(filters.tenantId);
    clauses.push(`tenant_id = $${params.length}`);
  }
  if (filters.type) {
    params.push(filters.type);
    clauses.push(`type = $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { rows } = await query(
    `SELECT id, date, description, amount, type, property_id, tenant_id, reference, category_id, matched_tenant_id, match_amount, match_note
     FROM bank_transactions
     ${where}
     ORDER BY date DESC, id DESC`,
    params,
  );
  return rows.map(normalizeTxnRow);
}

export async function createTransaction(payload: BankTransactionInput): Promise<BankTransaction> {
  const normalized = normalizeTxnInput(payload);
  const id = normalized.id ?? randomUUID();
  const { rows } = await query(
    `INSERT INTO bank_transactions (id, date, description, amount, type, property_id, tenant_id, reference)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, date, description, amount, type, property_id, tenant_id, reference, category_id, matched_tenant_id, match_amount, match_note`,
    [
      id,
      normalized.date,
      normalized.description,
      normalized.amount,
      normalized.type,
      normalized.property_id,
      normalized.tenant_id,
      normalized.reference,
    ],
  );
  return normalizeTxnRow(rows[0]);
}

export async function categorizeTransaction(id: string, categoryId: string | null): Promise<BankTransaction> {
  if (!id) throw badRequest("Transaction id is required.");
  const { rows } = await query(
    `UPDATE bank_transactions
     SET category_id = $1, updated_at = now()
     WHERE id = $2
     RETURNING id, date, description, amount, type, property_id, tenant_id, reference, category_id, matched_tenant_id, match_amount, match_note`,
    [categoryId, id],
  );
  if (!rows.length) throw notFound("Transaction not found.");
  return normalizeTxnRow(rows[0]);
}

export async function matchTransactionToTenant(
  id: string,
  tenantId: string,
  amount?: number | string,
  note?: string,
): Promise<BankTransaction> {
  if (!id) throw badRequest("Transaction id is required.");
  if (!tenantId) throw badRequest("Tenant id is required.");
  const matchAmount = toNumber(amount);
  const { rows } = await query(
    `UPDATE bank_transactions
     SET matched_tenant_id = $1, match_amount = $2, match_note = $3, updated_at = now()
     WHERE id = $4
     RETURNING id, date, description, amount, type, property_id, tenant_id, reference, category_id, matched_tenant_id, match_amount, match_note`,
    [tenantId, matchAmount, note ?? null, id],
  );
  if (!rows.length) throw notFound("Transaction not found.");
  return normalizeTxnRow(rows[0]);
}

export const bankTransactionsRepo = {
  listTransactions,
  createTransaction,
  categorizeTransaction,
  matchTransactionToTenant,
};
