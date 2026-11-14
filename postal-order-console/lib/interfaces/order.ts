export interface IOrderUser {
  _id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface IOrderRestaurant {
  _id: string;
  name?: string | null;
  address?: string | null;
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
  description?: string | null;
  options?: IOrderAddonOption[] | null;
}

export interface IOrderItem {
  _id?: string | null;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  quantity?: number | null;
  specialInstructions?: string | null;
  variation?: IOrderVariation | null;
  addons?: IOrderAddon[] | null;
}

export interface IOrderAddress {
  deliveryAddress?: string | null;
  details?: string | null;
  label?: string | null;
  location?: { coordinates?: number[] | null } | null;
}

export interface IOrder {
  _id: string;
  orderId?: string | null;
  createdAt?: string | null;
  orderStatus?: string | null;
  total?: number | null;
  orderAmount?: number | null;
  deliveryCharges?: number | null;
  tipping?: number | null;
  taxationAmount?: number | null;
  discount?: number | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  instructions?: string | null;
  isPickedUp?: boolean | null;
  adminConfirmedAt?: string | null;
  adminRejectedAt?: string | null;
  user?: IOrderUser | null;
  restaurant?: IOrderRestaurant | null;
  deliveryAddress?: IOrderAddress | null;
  items?: IOrderItem[] | null;
}

export interface IPendingOrdersResult {
  totalCount: number;
  totalPages: number;
  currentPage: number;
  nextPage?: number | null;
  prevPage?: number | null;
  orders: IOrder[];
}

export interface IPendingOrdersData {
  pendingConfirmationCount: number;
  pendingConfirmationOrders: IPendingOrdersResult;
}

export interface ITodayStatsData {
  allOrdersWithoutPagination: Array<{
    _id: string;
    orderStatus?: string | null;
    adminConfirmedAt?: string | null;
    adminRejectedAt?: string | null;
    createdAt?: string | null;
  }>;
}

export interface IRider {
  _id: string;
  name?: string | null;
  phone?: string | null;
  available?: boolean | null;
}

export interface IRidersData {
  riders: IRider[];
}
