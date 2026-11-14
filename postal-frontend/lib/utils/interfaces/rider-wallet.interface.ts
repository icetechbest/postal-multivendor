export interface IRiderWallet {
  riderId: string;
  name?: string | null;
  username?: string | null;
  phone?: string | null;
  available?: boolean | null;
  isActive?: boolean | null;
  zone?: string | null;
  vehicleType?: string | null;
  commissionRate: number;
  currentBalance: number;
  totalEarnings: number;
  withdrawn: number;
  debt: number;
  cashInHand: number;
  debtLimit: number;
  cashLimit: number;
  blocked: boolean;
  blockedReason?: string | null;
  totalCommission: number;
  totalPaid: number;
  netBalance: number;
  deliveredOrders: number;
  totalCashCollected: number;
  lastDeliveryAt?: string | null;
}

export interface IRiderWalletSettings {
  commissionRate: number;
  commissionBase: string;
  debtLimit: number;
  cashLimit: number;
}

export interface IWalletTransaction {
  _id: string;
  type: string;
  amount: number;
  direction: number;
  balance: 'WALLET' | 'DEBT' | 'CASH' | string;
  walletAfter?: number | null;
  debtAfter?: number | null;
  note?: string | null;
  order?: string | null;
  orderId?: string | null;
  createdAt?: string | null;
  createdBy?: string | null;
}

export interface IRiderWalletsPage {
  riders: IRiderWallet[];
  total: number;
  page: number;
  totalPages: number;
  totalDebt: number;
  totalBalance: number;
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

export interface IAdminChatSummary {
  orderId: string;
  orderNumber?: string | null;
  orderStatus?: string | null;
  restaurantName?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  riderName?: string | null;
  riderPhone?: string | null;
  messageCount: number;
  lastMessage?: string | null;
  lastSender?: string | null;
  lastMessageAt?: string | null;
}

export interface IChatMessageItem {
  id: string;
  message?: string | null;
  createdAt?: string | null;
  user?: { id?: string | null; name?: string | null } | null;
}
