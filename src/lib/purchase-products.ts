export type CoinProduct = {
  id: string;
  name: string;
  baseCoins: number;
  bonusCoins: number;
  amountKrw: number;
  recommended?: boolean;
};

export const coinProducts: CoinProduct[] = [
  {
    id: "lime_coin_2000",
    name: "라이트",
    baseCoins: 2000,
    bonusCoins: 0,
    amountKrw: 2000
  },
  {
    id: "lime_coin_4900",
    name: "베이직",
    baseCoins: 4900,
    bonusCoins: 100,
    amountKrw: 4900
  },
  {
    id: "lime_coin_9600",
    name: "스탠다드",
    baseCoins: 9600,
    bonusCoins: 600,
    amountKrw: 9600
  },
  {
    id: "lime_coin_28000",
    name: "플러스",
    baseCoins: 28000,
    bonusCoins: 3000,
    amountKrw: 28000
  },
  {
    id: "lime_coin_46000",
    name: "추천",
    baseCoins: 46000,
    bonusCoins: 7000,
    amountKrw: 46000,
    recommended: true
  },
  {
    id: "lime_coin_90000",
    name: "맥스",
    baseCoins: 90000,
    bonusCoins: 18000,
    amountKrw: 90000
  }
];

export function getCoinProduct(productId: string) {
  return coinProducts.find((product) => product.id === productId);
}

export function getTotalCoins(product: CoinProduct) {
  return product.baseCoins + product.bonusCoins;
}
