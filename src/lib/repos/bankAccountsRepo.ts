import { query } from "@/lib/db";
import { badRequest, notFound } from "./errors";

export type BankAccount = {
  id: string;
  name: string;
  bank_name: string;
  account_number: string | null;
  currency: string;
  color: string;
  is_default: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateBankAccountInput = {
  name: string;
  bank_name?: string;
  account_number?: string | null;
  currency?: string;
  color?: string;
  is_default?: boolean;
  notes?: string | null;
};

function normalizeRow(row: Record<string, unknown>): BankAccount {
  return {
    id: String(row.id),
    name: String(row.name),
    bank_name: String(row.bank_name ?? "Salaam Bank"),
    account_number: row.account_number ? String(row.account_number) : null,
    currency: String(row.currency ?? "USD"),
    color: String(row.color ?? "#13c2c2"),
    is_default: Boolean(row.is_default),
    is_active: Boolean(row.is_active),
    notes: row.notes ? String(row.notes) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function getAllBankAccounts(): Promise<BankAccount[]> {
  const { rows } = await query(
    `SELECT id, name, bank_name, account_number, currency, color,
            is_default, is_active, notes, created_at, updated_at
     FROM public.bank_accounts
     WHERE is_active = true
     ORDER BY is_default DESC, name ASC`,
  );
  return rows.map(normalizeRow);
}

export async function getBankAccountById(id: string): Promise<BankAccount | null> {
  if (!id) throw badRequest("Bank account id is required.");
  const { rows } = await query(
    `SELECT id, name, bank_name, account_number, currency, color,
            is_default, is_active, notes, created_at, updated_at
     FROM public.bank_accounts
     WHERE id = $1`,
    [id],
  );
  return rows.length ? normalizeRow(rows[0]) : null;
}

export async function createBankAccount(data: CreateBankAccountInput): Promise<BankAccount> {
  if (!data.name?.trim()) throw badRequest("Account name is required.");

  if (data.is_default) {
    await query(`UPDATE public.bank_accounts SET is_default = false, updated_at = now()`);
  }

  const { rows } = await query(
    `INSERT INTO public.bank_accounts
       (name, bank_name, account_number, currency, color, is_default, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, bank_name, account_number, currency, color,
               is_default, is_active, notes, created_at, updated_at`,
    [
      data.name.trim(),
      data.bank_name?.trim() || "Salaam Bank",
      data.account_number?.trim() || null,
      data.currency || "USD",
      data.color || "#13c2c2",
      data.is_default ?? false,
      data.notes?.trim() || null,
    ],
  );
  return normalizeRow(rows[0]);
}

export async function updateBankAccount(
  id: string,
  data: Partial<CreateBankAccountInput>,
): Promise<BankAccount> {
  if (!id) throw badRequest("Bank account id is required.");

  if (data.is_default) {
    await query(
      `UPDATE public.bank_accounts SET is_default = false, updated_at = now() WHERE id != $1`,
      [id],
    );
  }

  const { rows } = await query(
    `UPDATE public.bank_accounts SET
       name           = COALESCE($1, name),
       bank_name      = COALESCE($2, bank_name),
       account_number = COALESCE($3, account_number),
       currency       = COALESCE($4, currency),
       color          = COALESCE($5, color),
       is_default     = COALESCE($6, is_default),
       notes          = COALESCE($7, notes),
       updated_at     = now()
     WHERE id = $8
     RETURNING id, name, bank_name, account_number, currency, color,
               is_default, is_active, notes, created_at, updated_at`,
    [
      data.name?.trim() ?? null,
      data.bank_name?.trim() ?? null,
      data.account_number !== undefined ? (data.account_number?.trim() || null) : null,
      data.currency ?? null,
      data.color ?? null,
      data.is_default ?? null,
      data.notes !== undefined ? (data.notes?.trim() || null) : null,
      id,
    ],
  );
  if (!rows.length) throw notFound("Bank account not found.");
  return normalizeRow(rows[0]);
}

export async function setDefaultBankAccount(id: string): Promise<void> {
  if (!id) throw badRequest("Bank account id is required.");
  await query(`UPDATE public.bank_accounts SET is_default = false, updated_at = now()`);
  const { rows } = await query(
    `UPDATE public.bank_accounts SET is_default = true, updated_at = now() WHERE id = $1 RETURNING id`,
    [id],
  );
  if (!rows.length) throw notFound("Bank account not found.");
}

export async function deactivateBankAccount(id: string): Promise<void> {
  if (!id) throw badRequest("Bank account id is required.");

  const account = await getBankAccountById(id);
  if (!account) throw notFound("Bank account not found.");
  if (account.is_default) throw badRequest("Cannot deactivate the default bank account.");

  await query(
    `UPDATE public.bank_accounts SET is_active = false, is_default = false, updated_at = now() WHERE id = $1`,
    [id],
  );
}

export const bankAccountsRepo = {
  getAllBankAccounts,
  getBankAccountById,
  createBankAccount,
  updateBankAccount,
  setDefaultBankAccount,
  deactivateBankAccount,
};
