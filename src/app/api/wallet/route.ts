import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getWalletBalance } from "@/lib/currency";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type TransactionRow = {
  id: string;
  currency_type: string;
  transaction_type: string;
  amount: number;
  paid_delta: number;
  free_delta: number;
  paid_balance_after: number;
  free_balance_after: number;
  reason: string;
  reference_type: string;
  reference_id: string;
  created_at: string;
};

export async function GET(request: Request) {
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);

  if (!supabase || !user) {
    return NextResponse.json({ error: "Login is required" }, { status: 401 });
  }

  try {
    const balance = await getWalletBalance(supabase, user.id);
    const { data, error } = await supabase
      .from("currency_transactions")
      .select("id,currency_type,transaction_type,amount,paid_delta,free_delta,paid_balance_after,free_balance_after,reason,reference_type,reference_id,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<TransactionRow[]>();

    if (error) throw error;

    return NextResponse.json({
      wallet: balance,
      transactions: (data ?? []).map((row) => ({
        id: row.id,
        currencyType: row.currency_type,
        transactionType: row.transaction_type,
        amount: row.amount,
        paidDelta: row.paid_delta,
        freeDelta: row.free_delta,
        paidBalanceAfter: row.paid_balance_after,
        freeBalanceAfter: row.free_balance_after,
        reason: row.reason,
        referenceType: row.reference_type,
        referenceId: row.reference_id,
        createdAt: row.created_at
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Wallet load failed" }, { status: 500 });
  }
}
