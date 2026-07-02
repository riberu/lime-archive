import { NextResponse } from "next/server";
import { coinProducts, getTotalCoins } from "@/lib/purchase-products";

export async function GET() {
  return NextResponse.json({
    products: coinProducts.map((product) => ({
      ...product,
      totalCoins: getTotalCoins(product),
      chatCount: Math.floor(getTotalCoins(product) / 30)
    }))
  });
}
