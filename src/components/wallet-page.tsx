"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { CalendarCheck, Coins, Gem, ShieldCheck } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type WalletState = {
  paidBalance: number;
  freeBalance: number;
  totalBalance: number;
};

type CoinProduct = {
  id: string;
  name: string;
  baseCoins: number;
  bonusCoins: number;
  totalCoins: number;
  amountKrw: number;
  chatCount: number;
  recommended?: boolean;
};

export function WalletPage() {
  const [token, setToken] = useState("");
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [products, setProducts] = useState<CoinProduct[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    void (async () => {
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      const accessToken = session?.access_token ?? "";
      if (!accessToken) {
        window.location.replace("/signup");
        return;
      }
      setToken(accessToken);
      await Promise.all([loadWallet(accessToken), loadProducts()]);
    })();

    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const accessToken = session?.access_token ?? "";
      if (!accessToken) {
        window.location.replace("/signup");
        return;
      }
      setToken(accessToken);
      void loadWallet(accessToken);
      void loadProducts();
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const loadWallet = async (accessToken: string) => {
    setError("");
    try {
      const response = await fetch("/api/wallet", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = (await response.json().catch(() => null)) as { wallet?: WalletState; error?: string } | null;
      if (!response.ok) {
        setError(data?.error ?? "지갑 정보를 불러오지 못했어요.");
        return;
      }
      setWallet(data?.wallet ?? null);
    } catch {
      setError("지갑 정보를 불러오지 못했어요.");
    }
  };

  const loadProducts = async () => {
    const response = await fetch("/api/purchases/products", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) return;
    const data = (await response.json()) as { products?: CoinProduct[] };
    setProducts(data.products ?? []);
  };

  const claimAttendance = () => {
    if (!token) return;
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/wallet/attendance", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = (await response.json().catch(() => null)) as {
        claimed?: boolean;
        rewardAmount?: number;
        bonusAmount?: number;
        wallet?: WalletState;
        error?: string;
      } | null;
      if (!response.ok) {
        setError(data?.error ?? "출석 보상을 받지 못했어요.");
        return;
      }
      if (data?.wallet) setWallet(data.wallet);
      const amount = (data?.rewardAmount ?? 0) + (data?.bonusAmount ?? 0);
      setMessage(data?.claimed ? `오늘 ${amount.toLocaleString("ko-KR")} LP를 받았어요.` : "오늘 출석 보상은 이미 받았어요.");
      window.dispatchEvent(new Event("lime-wallet-refresh"));
    });
  };

  const startCoinOrder = (product: CoinProduct) => {
    if (!token) return;
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/purchases/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          provider: "toss",
          productId: product.id
        })
      });
      const data = (await response.json().catch(() => null)) as { order?: { orderId: string }; error?: string } | null;
      if (!response.ok) {
        setError(data?.error ?? "결제 주문을 만들지 못했어요.");
        return;
      }
      setMessage(`주문 ${data?.order?.orderId ?? ""} 생성 완료. 다음 단계에서 Toss 결제창을 연결하면 됩니다.`);
    });
  };

  return (
    <div className="wallet-page">
      <div className="wallet-page-hero">
        <div>
          <p>라임 지갑</p>
          <h1>충전과 보상은 여기서 관리해요</h1>
          <span>Lime Point가 먼저 차감되고, 부족하면 Lime Coin이 사용됩니다.</span>
        </div>
        <Link href="/profile">내 정보로 돌아가기</Link>
      </div>

      {error ? <p className="wallet-alert is-error">{error}</p> : null}
      {message ? <p className="wallet-alert">{message}</p> : null}

      <section className="wallet-profile-card">
        <div className="wallet-profile-grid">
          <div>
            <span><Coins size={16} /> Lime Point</span>
            <b>{(wallet?.freeBalance ?? 0).toLocaleString("ko-KR")}</b>
            <small>무료 재화</small>
          </div>
          <div>
            <span><Gem size={16} /> Lime Coin</span>
            <b>{(wallet?.paidBalance ?? 0).toLocaleString("ko-KR")}</b>
            <small>유료 재화</small>
          </div>
        </div>

        <button type="button" className="attendance-claim" onClick={claimAttendance} disabled={isPending}>
          <CalendarCheck size={16} />
          {isPending ? "확인 중..." : "오늘 출석 보상 받기"}
        </button>

        <p>채팅 1회 생성에는 30 재화가 사용됩니다. 결제 재화는 서버 검증 후에만 충전됩니다.</p>
      </section>

      <section className="wallet-shop">
        <div className="wallet-shop-head">
          <div>
            <h2>Lime Coin 충전</h2>
            <p>웹 결제는 Toss/Card 연결 예정이고, 앱에서는 Apple/Google 영수증 검증 후 지급됩니다.</p>
          </div>
          <span><ShieldCheck size={15} /> 서버 검증 충전</span>
        </div>

        {products.length ? (
          <div className="coin-products" aria-label="Lime Coin 충전 상품">
            {products.map((product) => (
              <button key={product.id} type="button" className={product.recommended ? "recommended" : ""} onClick={() => startCoinOrder(product)} disabled={isPending}>
                {product.recommended ? <em>추천</em> : null}
                <span>{product.name}</span>
                <b>{product.totalCoins.toLocaleString("ko-KR")} LC</b>
                <small>
                  {product.bonusCoins ? `+${product.bonusCoins.toLocaleString("ko-KR")} 보너스 · ` : ""}
                  약 {product.chatCount.toLocaleString("ko-KR")}회
                </small>
                <strong>{product.amountKrw.toLocaleString("ko-KR")}원</strong>
              </button>
            ))}
          </div>
        ) : (
          <div className="wallet-empty">충전 상품을 불러오는 중이에요.</div>
        )}
      </section>
    </div>
  );
}
