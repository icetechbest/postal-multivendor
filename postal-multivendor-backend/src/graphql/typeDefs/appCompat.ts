// Compatibility surface for the Store (vendor) and Rider mobile apps.
// These fields are additive: nothing here renames or removes an existing
// operation, so the customer and admin clients keep working unchanged.
export const appCompatTypeDefs = `#graphql
  extend type Query {
    # Store app
    restaurantOrders: [Order!]!
    storeCurrentWithdrawRequest(storeId: String): WithdrawRequest
    storeEarningsGraph(storeId: ID!, page: Int, limit: Int, startDate: String, endDate: String): StoreEarningsGraph!

    # Rider app
    riderOrders: [Order!]!
    riderCurrentWithdrawRequest(riderId: String): WithdrawRequest
    riderEarningsGraph(riderId: ID!, page: Int, limit: Int, startDate: String, endDate: String): RiderEarningsGraph!
  }

  extend type Mutation {
    # Store app
    acceptOrder(_id: String!, time: String): Order
    orderPickedUp(_id: String!): Order
    muteRing(orderId: String): Boolean
    toggleAvailability(restaurantId: String): Restaurant
    toggleStoreAvailability(restaurantId: String!): Restaurant
    saveRestaurantToken(token: String, isEnabled: Boolean): Restaurant

    # Rider app
    assignOrder(id: String!): Order
    updateOrderStatusRider(id: String!, status: String!): Order
    updateRiderLicenseDetails(id: String!, licenseDetails: LicenseDetailsInput): User
    updateRiderVehicleDetails(id: String!, vehicleDetails: VehicleDetailsInput): User
    updateRiderBussinessDetails(id: String!, bussinessDetails: BussinessDetailsInput): User
    updateWorkSchedule(riderId: String!, workSchedule: [DayScheduleInput!]!, timeZone: String!): User
  }

  extend type Subscription {
    subscriptionAssignRider(riderId: String!): RiderAssignment!
    subscriptionZoneOrders(zoneId: String!): ZoneOrderUpdate!
  }

  extend type Order {
    chat: [Chat!]
  }

  extend type User {
    timeZone: String
    workSchedule: [WorkSchedule!]
  }

  # ----- work schedule (rider app)
  type TimeSlot {
    startTime: String
    endTime: String
  }
  type WorkSchedule {
    day: String
    enabled: Boolean
    slots: [TimeSlot!]!
  }
  input TimeSlotScheduleInput {
    startTime: String
    endTime: String
  }
  input DayScheduleInput {
    day: String!
    enabled: Boolean
    slots: [TimeSlotScheduleInput!]
  }

  # ----- order chat preview (rider app selects chat on riderOrders)
  type Chat {
    user: String
    message: String
    images: [String!]
    isActive: Boolean
  }

  # ----- earnings graphs
  type StoreEarningsOrderDetails {
    orderId: String
    orderType: String
    paymentMethod: String
  }
  type StoreEarningsEntry {
    totalOrderAmount: Float
    totalEarnings: Float
    orderDetails: StoreEarningsOrderDetails
    date: Date
  }
  type StoreEarningsGroup {
    _id: ID
    totalEarningsSum: Float
    totalOrderAmount: Float
    totalDeliveries: Int
    earningsArray: [StoreEarningsEntry!]!
  }
  type StoreEarningsGraph {
    totalCount: Int!
    earnings: [StoreEarningsGroup!]!
  }

  type RiderEarningsOrderDetails {
    orderType: String
    orderId: String
    paymentMethod: String
  }
  type RiderEarningsEntry {
    tip: Float
    orderDetails: RiderEarningsOrderDetails
    totalEarnings: Float
    deliveryFee: Float
    date: Date
  }
  type RiderEarningsGroup {
    _id: ID
    earningsArray: [RiderEarningsEntry!]!
    totalDeliveries: Int
    totalEarningsSum: Float
    totalHours: Float
    totalTipsSum: Float
    date: Date
  }
  type RiderEarningsGraph {
    totalCount: Int!
    earnings: [RiderEarningsGroup!]!
  }

  # ----- subscription payloads
  type RiderAssignment {
    order: Order!
    origin: String!
  }
  type ZoneOrderUpdate {
    zoneId: String!
    origin: String!
    order: Order!
  }

  # The mobile apps send dateFilter as { startDate, endDate }.
  input DateFilter {
    startDate: String
    endDate: String
  }
`;
