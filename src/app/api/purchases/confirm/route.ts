import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getWalletBalance, grantCurrency } from "@/lib/currency";
import { verifyPayment, type PaymentProvider } from "@/lib/payments";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type ConfirmPurchaseRequest = {
  provider: PaymentProvider;
  orderId: string;
  paymentKey?: string;
  transactionId?: string;
  purchaseToken?: string;
  receiptData?: string;
};

type PurchaseReceiptRow = {
  id: string;
  user_id: string;
  provider: PaymentProvider;
  order_id: string;
  product_id: string;
  amount_krw: number;
  paid_coin_amount: number;
  status: string;
};

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);

  if (!supabase || !user) {
    return NextResponse.json({ error: "Login is required" }, { status: 401 });
  }

  const body = (await request.json()) as ConfirmPurchaseRequest;
  const provider = body.provider;
  const orderId = String(body.orderId ?? "").trim();

  if (!provider || !orderId) {
    return NextResponse.json({ error: "provider and orderId are required" }, { status: 400 });
  }

  const { data: receipt, error: receiptError } = await supabase
    .from("purchase_receipts")
    .select("id,user_id,provider,order_id,product_id,amount_krw,paid_coin_amount,status")
    .eq("provider", provider)
    .eq("order_id", orderId)
    .eq("user_id", user.id)
    .single<PurchaseReceiptRow>();

  if (receiptError || !receipt) {
    return NextResponse.json({ error: receiptError?.message ?? "Pending purchase not found" }, { status: 404 });
  }

  if (receipt.status === "paid") {
    return NextResponse.json({
      status: "paid",
      alreadyProcessed: true,
      wallet: await getWalletBalance(supabase, user.id)
    });
  }

  if (receipt.status !== "pending") {
    return NextResponse.json({ error: `Purchase status is ${receipt.status}` }, { status: 409 });
  }

  try {
    const verified = await verifyPayment({
      provider,
      orderId,
      amountKrw: receipt.amount_krw,
      paymentKey: body.paymentKey,
      transactionId: body.transactionId,
      purchaseToken: body.purchaseToken,
      receiptData: body.receiptData,
      productId: receipt.product_id
    });

    const providerTransactionId = verified.providerTransactionId;
    const idempotencyKey = `purchase:${provider}:${providerTransactionId}`;

    const grant = await grantCurrency(supabase, {
      userId: user.id,
      paidAmount: receipt.paid_coin_amount,
      type: "purchase",
      reason: `Purchase ${receipt.product_id}`,
      referenceType: "purchase_receipt",
      referenceId: receipt.id,
      idempotencyKey,
      metadata: {
        provider,
        orderId,
        productId: receipt.product_id,
        amountKrw: receipt.amount_krw,
        paymentKey: verified.paymentKey,
        providerTransactionId
      }
    });

    const { error: updateError } = await supabase
      .from("purchase_receipts")
      .update({
        payment_key: verified.paymentKey ?? null,
        provider_transaction_id: providerTransactionId,
        status: "paid",
        raw_payload: verified.rawPayload,
        updated_at: new Date().toISOString()
      })
      .eq("id", receipt.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      status: "paid",
      transactionId: grant.transactionId,
      wallet: {
        paidBalance: grant.paidBalance,
        freeBalance: grant.freeBalance,
        totalBalance: grant.totalBalance
      }
    });
  } catch (error) {
    await supabase
      .from("purchase_receipts")
      .update({
        status: "failed",
        raw_payload: {
          error: error instanceof Error ? error.message : "Payment verification failed"
        },
        updated_at: new Date().toISOString()
      })
      .eq("id", receipt.id);

    return NextResponse.json({ error: error instanceof Error ? error.message : "Payment verification failed" }, { status: 400 });
  }
}
