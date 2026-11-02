export interface IOrderUser {
  _id: string;
  name?: string | null;
  phone?: string | null;
}

export interface IOrderRestaurant {
  _id: string;
  name?: string | null;
}

export interface IOrderRider {
  _id: string;
  name?: string | null;
  phone?: string | null;
  available?: boolean | null;
}

export interface IOrderAddress {
  deliveryAddress?: string | null;
  details?: string | null;
}

export interface IOrderVariation {
  _id?: string | null;
  title?: string | null;
  price?: number | null;
  discounted?: number | null;
}

export interface IOrderAddonOption {
  _id?: string | null;
  title?: string | null;
  price?: number | null;
}

export interface IOrderAddon {
  _id?: string | null;
  title?: string | null;
  options?: IOrderAddonOption[] | null;
}

export interface IOrderItem {
  _id?: string | null;
  title?: string | null;
  quantity?: number | null;
  specialInstructions?: string | null;
  variation?: IOrderVariation | null;
  addons?: IOrderAddon[] | null;
}

export interface IOrder {
  _id: string;
  orderId?: string | null;
  orderStatus?: string | null;
  status?: string | null;
  total?: number | null;
  orderAmount?: number | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  createdAt?: string | null;
  user?: IOrderUser | null;
  restaurant?: IOrderRestaurant | null;
  deliveryAddress?: IOrderAddress | null;
  rider?: IOrderRider | null;
  instructions?: string | null;
  deliveryCharges?: number | null;
  tipping?: number | null;
  taxationAmount?: number | null;
  discount?: number | null;
  adminNote?: string | null;
  adminConfirmedAt?: string | null;
  adminRejectedAt?: string | null;
  items?: IOrderItem[] | null;
}

export interface IOrdersPage {
  totalCount: number;
  currentPage: number;
  totalPages: number;
  orders: IOrder[];
}

export interface IChartPoint {
  label: string;
  value: number;
}

export interface IDashboardUsers {
  usersCount: number;
  vendorsCount: number;
  restaurantsCount: number;
  ridersCount: number;
}

export interface IRider {
  _id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  available?: boolean | null;
  isAvailable?: boolean | null;
  assigned?: boolean | null;
  status?: string | null;
  vehicleType?: string | null;
  currentWalletAmount?: number | null;
  zone?: { _id?: string | null; title?: string | null } | null;
  location?: { coordinates?: number[] | null } | null;
}

export interface IRestaurant {
  _id: string;
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  image?: string | null;
  logo?: string | null;
  isActive?: boolean | null;
  isAvailable?: boolean | null;
  shopType?: string | null;
  rating?: number | null;
  totalOrders?: number | null;
  wallet?: number | null;
  owner?: { _id?: string | null; name?: string | null; email?: string | null; phone?: string | null } | null;
  location?: { coordinates?: number[] | null } | null;
}

export interface IRestaurantsPage {
  totalCount: number;
  currentPage: number;
  totalPages: number;
  data: IRestaurant[];
}

export interface IUser {
  _id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  userType?: string | null;
  isActive?: boolean | null;
  createdAt?: string | null;
}

export interface ITicketSummary {
  _id: string;
  title?: string | null;
  status?: string | null;
  createdAt?: string | null;
}

export interface ITicketUser {
  _id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  isActive?: boolean | null;
  userType?: string | null;
  latestTicket?: ITicketSummary | null;
}

export interface ITicketUsersPage {
  users: ITicketUser[];
  docsCount: number;
  totalPages: number;
  currentPage: number;
}

export interface ITicket {
  _id: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  category?: string | null;
  createdAt?: string | null;
}

export interface IUserTicketsPage {
  tickets: ITicket[];
  docsCount: number;
  totalPages: number;
  currentPage: number;
}

export interface IEarningRow {
  _id: string;
  orderId?: string | null;
  orderType?: string | null;
  paymentMethod?: string | null;
  createdAt?: string | null;
  platformEarnings?: { totalEarnings?: number | null } | null;
  riderEarnings?: { totalEarnings?: number | null } | null;
  storeEarnings?: { totalEarnings?: number | null } | null;
}

export interface IEarningsResult {
  success?: boolean | null;
  message?: string | null;
  data?: {
    earnings: IEarningRow[];
    grandTotalEarnings?: {
      platformTotal?: number | null;
      riderTotal?: number | null;
      storeTotal?: number | null;
    } | null;
  } | null;
  pagination?: { total?: number | null } | null;
}

export interface ITransaction {
  _id: string;
  amountCurrency?: string | null;
  status?: string | null;
  transactionId?: string | null;
  userType?: string | null;
  amountTransferred?: number | null;
  createdAt?: string | null;
  toBank?: {
    accountName?: string | null;
    bankName?: string | null;
    accountNumber?: string | null;
  } | null;
}

export interface ITransactionPage {
  data: ITransaction[];
  pagination?: { total?: number | null } | null;
}

export interface IWithdrawRequest {
  _id: string;
  requestId?: string | null;
  requestAmount?: number | null;
  requestTime?: string | null;
  status?: string | null;
  rider?: { _id?: string | null; name?: string | null; phone?: string | null } | null;
  store?: { _id?: string | null; name?: string | null } | null;
}

export interface IWithdrawPage {
  success?: boolean | null;
  message?: string | null;
  data: IWithdrawRequest[];
  pagination?: { total?: number | null } | null;
}
