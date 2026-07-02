export type PaymentProvider = "apple" | "google" | "toss";

export type PaymentVerificationInput = {
  provider: PaymentProvider;
  orderId: string;
  amountKrw: number;
  paymentKey?: string;
  transactionId?: string;
  purchaseToken?: string;
  receiptData?: string;
  productId?: string;
};

export type VerifiedPayment = {
  provider: PaymentProvider;
  orderId: string;
  amountKrw: number;
  paymentKey?: string;
  providerTransactionId: string;
  productId?: string;
  rawPayload: Record<string, unknown>;
};

export async function verifyPayment(input: PaymentVerificationInput): Promise<VerifiedPayment> {
  if (input.provider === "toss") return verifyTossPayment(input);
  if (input.provider === "apple") return verifyApplePayment(input);
  if (input.provider === "google") return verifyGooglePayment(input);
  throw new Error("Unsupported payment provider");
}

async function verifyTossPayment(input: PaymentVerificationInput): Promise<VerifiedPayment> {
  const secretKey = process.env.TOSS_SECRET_KEY?.trim();
  if (!secretKey) throw new Error("TOSS_SECRET_KEY is missing");
  if (!input.paymentKey) throw new Error("paymentKey is required");

  const response = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      paymentKey: input.paymentKey,
      orderId: input.orderId,
      amount: input.amountKrw
    })
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof payload.message === "string" ? payload.message : `Toss confirm failed: ${response.status}`);
  }

  const approvedAmount = Number(payload.totalAmount ?? payload.balanceAmount ?? 0);
  const status = String(payload.status ?? "");
  if (approvedAmount !== input.amountKrw) throw new Error("Payment amount mismatch");
  if (status !== "DONE") throw new Error(`Payment is not completed: ${status}`);

  return {
    provider: "toss",
    orderId: input.orderId,
    amountKrw: approvedAmount,
    paymentKey: input.paymentKey,
    providerTransactionId: String(payload.paymentKey ?? input.paymentKey),
    productId: input.productId,
    rawPayload: payload
  };
}

async function verifyApplePayment(input: PaymentVerificationInput): Promise<VerifiedPayment> {
  if (!input.transactionId && !input.receiptData) {
    throw new Error("Apple transactionId or receiptData is required");
  }

  throw new Error("Apple receipt verification is not configured yet");
}

async function verifyGooglePayment(input: PaymentVerificationInput): Promise<VerifiedPayment> {
  if (!input.purchaseToken) {
    throw new Error("Google purchaseToken is required");
  }

  throw new Error("Google Play receipt verification is not configured yet");
}
