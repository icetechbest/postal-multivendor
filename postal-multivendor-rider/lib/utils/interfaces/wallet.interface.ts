export interface IWalletTransaction {
  _id: string;
  type: string;
  amount: number;
  /** 1 increases the affected balance, -1 decreases it. */
  direction: 1 | -1;
  /** Which balance moved: the rider's earnings ("WALLET") or the debt to the company ("DEBT"). */
  balance: "WALLET" | "DEBT";
  walletAfter?: number | null;
  debtAfter?: number | null;
  note?: string | null;
  order?: string | null;
  orderId?: string | null;
  createdAt: string;
}

export interface IRiderWalletSummary {
  riderId: string;
  commissionRate: number;
  currentBalance: number;
  totalEarnings: number;
  withdrawn: number;
  debt: number;
  cashInHand?: number;
  debtLimit?: number;
  cashLimit?: number;
  blocked?: boolean;
  blockedReason?: string | null;
  totalCommission: number;
  totalPaid: number;
  netBalance: number;
  deliveredOrders: number;
}

export interface IRiderWalletResponse {
  riderWallet: {
    wallet: IRiderWalletSummary;
    transactions: {
      total: number;
      page: number;
      totalPages: number;
      transactions: IWalletTransaction[];
    };
  };
}

export interface IRiderHistoryOrder {
  _id: string;
  orderId: string;
  orderStatus: string;
  paymentMethod?: string | null;
  restaurantName?: string | null;
  customerName?: string | null;
  orderAmount: number;
  total: number;
  deliveryCharges: number;
  tipping: number;
  earning: number;
  commission: number;
  net: number;
  changeAmount?: number | null;
  deliveredAt?: string | null;
  createdAt?: string | null;
}

export interface IRiderOrderHistoryResponse {
  riderOrderHistory: {
    total: number;
    page: number;
    totalPages: number;
    totalEarnings: number;
    totalCommission: number;
    orders: IRiderHistoryOrder[];
  };
}
