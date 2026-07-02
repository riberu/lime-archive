import type { SupabaseClient } from "@supabase/supabase-js";
export { CHAT_MESSAGE_COST, DAILY_ATTENDANCE_REWARD, WEEKLY_ATTENDANCE_BONUS } from "@/lib/currency-config";

export type WalletBalance = {
  paidBalance: number;
  freeBalance: number;
  totalBalance: number;
};

export type SpendResult = WalletBalance & {
  transactionId: string;
  paidSpent: number;
  freeSpent: number;
};

type WalletRow = {
  paid_balance: number;
  free_balance: number;
};

type SpendRpcRow = {
  transaction_id: string;
  paid_spent: number;
  free_spent: number;
  paid_balance_after: number;
  free_balance_after: number;
};

type GrantRpcRow = {
  transaction_id: string;
  paid_balance_after: number;
  free_balance_after: number;
};

export function toWalletBalance(row: WalletRow): WalletBalance {
  return {
    paidBalance: row.paid_balance,
    freeBalance: row.free_balance,
    totalBalance: row.paid_balance + row.free_balance
  };
}

export async function ensureWallet(supabase: SupabaseClient, userId: string) {
  const { error } = await supabase.rpc("ensure_wallet", { target_user_id: userId });
  if (error) throw new Error(error.message);
}

export async function getWalletBalance(supabase: SupabaseClient, userId: string): Promise<WalletBalance> {
  await ensureWallet(supabase, userId);

  const { data, error } = await supabase
    .from("wallets")
    .select("paid_balance, free_balance")
    .eq("user_id", userId)
    .single<WalletRow>();

  if (error) throw new Error(error.message);
  return toWalletBalance(data);
}

export async function assertEnoughBalance(supabase: SupabaseClient, userId: string, amount: number) {
  const balance = await getWalletBalance(supabase, userId);
  if (balance.totalBalance < amount) {
    const shortage = amount - balance.totalBalance;
    const error = new Error("insufficient_balance");
    error.name = "InsufficientBalanceError";
    Object.assign(error, { balance, shortage, cost: amount });
    throw error;
  }
  return balance;
}

export async function spendCurrency(
  supabase: SupabaseClient,
  params: {
    userId: string;
    amount: number;
    reason: string;
    referenceType?: string;
    referenceId?: string;
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<SpendResult> {
  const { data, error } = await supabase.rpc("spend_wallet_balance", {
    target_user_id: params.userId,
    spend_amount: params.amount,
    spend_reason: params.reason,
    spend_reference_type: params.referenceType ?? "",
    spend_reference_id: params.referenceId ?? "",
    spend_idempotency_key: params.idempotencyKey ?? null,
    spend_metadata: params.metadata ?? {}
  });

  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? (data[0] as SpendRpcRow | undefined) : (data as SpendRpcRow | undefined);
  if (!row) throw new Error("spend result is empty");

  return {
    transactionId: row.transaction_id,
    paidSpent: row.paid_spent,
    freeSpent: row.free_spent,
    paidBalance: row.paid_balance_after,
    freeBalance: row.free_balance_after,
    totalBalance: row.paid_balance_after + row.free_balance_after
  };
}

export async function grantCurrency(
  supabase: SupabaseClient,
  params: {
    userId: string;
    paidAmount?: number;
    freeAmount?: number;
    type: "purchase" | "attendance" | "refund" | "admin_grant" | "adjustment";
    reason: string;
    referenceType?: string;
    referenceId?: string;
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<WalletBalance & { transactionId: string }> {
  const { data, error } = await supabase.rpc("grant_wallet_balance", {
    target_user_id: params.userId,
    grant_paid: params.paidAmount ?? 0,
    grant_free: params.freeAmount ?? 0,
    grant_type: params.type,
    grant_reason: params.reason,
    grant_reference_type: params.referenceType ?? "",
    grant_reference_id: params.referenceId ?? "",
    grant_idempotency_key: params.idempotencyKey ?? null,
    grant_metadata: params.metadata ?? {}
  });

  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? (data[0] as GrantRpcRow | undefined) : (data as GrantRpcRow | undefined);
  if (!row) throw new Error("grant result is empty");

  return {
    transactionId: row.transaction_id,
    paidBalance: row.paid_balance_after,
    freeBalance: row.free_balance_after,
    totalBalance: row.paid_balance_after + row.free_balance_after
  };
}

export async function refundSpend(
  supabase: SupabaseClient,
  params: {
    userId: string;
    spend: Pick<SpendResult, "transactionId" | "paidSpent" | "freeSpent">;
    reason: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
  }
) {
  if (!params.spend.paidSpent && !params.spend.freeSpent) return null;

  return grantCurrency(supabase, {
    userId: params.userId,
    paidAmount: params.spend.paidSpent,
    freeAmount: params.spend.freeSpent,
    type: "refund",
    reason: params.reason,
    referenceType: "currency_transaction",
    referenceId: params.spend.transactionId,
    idempotencyKey: params.idempotencyKey,
    metadata: params.metadata
  });
}

export function isInsufficientBalanceError(error: unknown) {
  return error instanceof Error && (error.name === "InsufficientBalanceError" || error.message.includes("insufficient_balance"));
}
