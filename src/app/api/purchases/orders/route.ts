import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getCoinProduct, getTotalCoins } from "@/lib/purchase-products";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { PaymentProvider } from "@/lib/payments";

type CreateOrderRequest = {
  provider: PaymentProvider;
  productId: string;
};

const allowedProviders = new Set<PaymentProvider>(["apple", "google", "toss"]);

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);

  if (!supabase || !user) {
    return NextResponse.json({ error: "Login is required" }, { status: 401 });
  }

  const body = (await request.json()) as CreateOrderRequest;
  const provider = body.provider;
  const productId = String(body.productId ?? "").trim();
  const product = getCoinProduct(productId);

  if (!allowedProviders.has(provider)) {
    return NextResponse.json({ error: "Unsupported payment provider" }, { status: 400 });
  }
  if (!product) {
    return NextResponse.json({ error: "Unknown coin product" }, { status: 400 });
  }

  const orderId = `lime_${provider}_${Date.now()}_${crypto.randomUUID().replaceAll("-", "")}`;
  const { data, error } = await supabase
    .from("purchase_receipts")
    .insert({
      user_id: user.id,
      provider,
      order_id: orderId,
      product_id: product.id,
      amount_krw: product.amountKrw,
      paid_coin_amount: getTotalCoins(product),
      status: "pending",
      raw_payload: {
        createdBy: "server",
        product,
        note: "Pending order. Coins are granted only after provider verification."
      }
    })
    .select("id,provider,order_id,product_id,amount_krw,paid_coin_amount,status,created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    order: {
      id: data.id,
      provider: data.provider,
      orderId: data.order_id,
      productId: data.product_id,
      amountKrw: data.amount_krw,
      coinAmount: data.paid_coin_amount,
      status: data.status,
      createdAt: data.created_at
    }
  });
}
