// Rider wallet (earnings + commission debt), customer wallet and admin chat monitoring.
export const walletTypeDefs = `#graphql
  type WalletTransaction {
    _id: ID!
    type: String!
    amount: Float!
    direction: Int!
    balance: String!
    walletAfter: Float
    debtAfter: Float
    note: String
    order: ID
    orderId: String
    createdAt: Date
    createdBy: String
  }

  type WalletTransactionsPage {
    transactions: [WalletTransaction!]!
    total: Int!
    page: Int!
    totalPages: Int!
  }

  type RiderWallet {
    riderId: ID!
    name: String
    username: String
    phone: String
    available: Boolean
    isActive: Boolean
    zone: String
    vehicleType: String
    commissionRate: Float!
    currentBalance: Float!
    totalEarnings: Float!
    withdrawn: Float!
    debt: Float!
    cashInHand: Float!
    debtLimit: Float!
    cashLimit: Float!
    blocked: Boolean!
    blockedReason: String
    totalCommission: Float!
    totalPaid: Float!
    netBalance: Float!
    deliveredOrders: Int!
    totalCashCollected: Float!
    lastDeliveryAt: Date
  }

  type RiderWalletSettings {
    commissionRate: Float!
    commissionBase: String!
    """Max debt before a rider can no longer take orders (0 = no limit)."""
    debtLimit: Float!
    """Max cash a rider may hold before he can no longer take orders (0 = no limit)."""
    cashLimit: Float!
  }

  type RiderWalletResult {
    wallet: RiderWallet!
    transactions: WalletTransactionsPage!
  }

  type RiderWalletsPage {
    riders: [RiderWallet!]!
    total: Int!
    page: Int!
    totalPages: Int!
    totalDebt: Float!
    totalBalance: Float!
  }

  type RiderHistoryOrder {
    _id: ID!
    orderId: String!
    orderStatus: String!
    paymentMethod: String
    restaurantName: String
    customerName: String
    orderAmount: Float!
    total: Float!
    deliveryCharges: Float!
    tipping: Float!
    earning: Float!
    commission: Float!
    net: Float!
    changeAmount: Float
    deliveredAt: Date
    createdAt: Date
  }

  type RiderOrderHistoryPage {
    orders: [RiderHistoryOrder!]!
    total: Int!
    page: Int!
    totalPages: Int!
    totalEarnings: Float!
    totalCommission: Float!
  }

  type CustomerChangeResult {
    success: Boolean!
    message: String
    changeAmount: Float!
    customerWalletBalance: Float!
    riderDebt: Float!
  }

  type AdminChatSummary {
    orderId: ID!
    orderNumber: String
    orderStatus: String
    restaurantName: String
    customerName: String
    customerPhone: String
    riderName: String
    riderPhone: String
    messageCount: Int!
    lastMessage: String
    lastSender: String
    lastMessageAt: Date
  }

  type AdminChatsPage {
    chats: [AdminChatSummary!]!
    total: Int!
    page: Int!
    totalPages: Int!
  }

  extend type Query {
    riderWalletSettings: RiderWalletSettings!
    """Rider: own wallet (riderId ignored). Admin/Staff: any rider's wallet."""
    riderWallet(riderId: ID, page: Int, limit: Int, type: String): RiderWalletResult!
    """Admin/Staff: every rider with balance and debt."""
    riderWallets(search: String, onlyDebt: Boolean, page: Int, limit: Int): RiderWalletsPage!
    """Delivered-order history with earning / commission per order. Rider: own. Admin: any rider."""
    riderOrderHistory(riderId: ID, page: Int, limit: Int, startDate: String, endDate: String): RiderOrderHistoryPage!
    """Customer: own money-wallet balance and ledger."""
    myWallet(page: Int, limit: Int): CustomerWalletResult!
    """Admin/Staff: all order chats that have at least one message."""
    adminChats(search: String, page: Int, limit: Int): AdminChatsPage!
  }

  type CustomerWalletResult {
    balance: Float!
    transactions: WalletTransactionsPage!
  }

  extend type Mutation {
    """Admin: record a payment from the rider. method CASH = rider paid cash; WALLET = deduct from rider's earnings."""
    settleRiderDebt(riderId: ID!, amount: Float!, method: String!, note: String): RiderWallet!
    """Admin: manual correction. target DEBT or WALLET. Positive amount adds, negative subtracts."""
    adjustRiderWallet(riderId: ID!, amount: Float!, target: String!, note: String!): RiderWallet!
    """Admin: platform commission percentage charged to riders (default 20)."""
    setRiderCommissionRate(rate: Float!): Float!
    """Admin: limits (0 = off). A rider at/over a limit cannot be assigned or self-assign new orders."""
    setRiderLimits(debtLimit: Float!, cashLimit: Float!): RiderWalletSettings!
    """Admin: record that the rider handed collected cash-on-delivery money to the company."""
    collectRiderCash(riderId: ID!, amount: Float!, note: String): RiderWallet!
    """Rider: COD order - customer paid more than the total; add the change to the customer's wallet instead of cash."""
    addChangeToCustomerWallet(orderId: ID!, receivedAmount: Float!): CustomerChangeResult!
    """Admin one-off: credit riders for orders delivered before wallets existed. Returns how many orders were settled."""
    settlePastDeliveredOrders: Int!
  }
`;
