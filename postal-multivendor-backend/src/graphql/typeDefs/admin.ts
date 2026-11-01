// Admin-dashboard surface. Merged with the base schema in ./index.ts.
export const adminTypeDefs = `#graphql
  extend type Query {
    auditLogs(page: Int, limit: Int): AuditLogPagination!
    getDashboardUsers: DashboardUsers!
    getDashboardUsersByYear(year: Int!): DashboardUsersByYear!
    getDashboardOrdersByType: [DashboardLabelValue!]!
    getDashboardSalesByType: [DashboardLabelValue!]!
    getRestaurantDashboardOrdersSalesStats(restaurant: String!, starting_date: String!, ending_date: String!, dateKeyword: String): RestaurantOrdersSalesStats!
    getRestaurantDashboardSalesOrderCountDetailsByYear(restaurant: String!, year: Int!): RestaurantYearlyStats!
    getDashboardOrderSalesDetailsByPaymentMethod(restaurant: String!, starting_date: String!, ending_date: String!): PaymentMethodBreakdown!
    getStoreDetailsByVendorId(id: String!, dateKeyword: String, starting_date: String, ending_date: String): [VendorStoreDetails!]!
    getVendorDashboardStatsCardDetails(vendorId: String!, dateKeyword: String, starting_date: String!, ending_date: String!): VendorStatsCard!
    getLiveMonitorData(id: String!, dateKeyword: String, starting_date: String, ending_date: String): LiveMonitorData!
    getVendorDashboardGrowthDetailsByYear(vendorId: String!, year: Int!): VendorGrowth!

    earnings(userId: String, userType: UserTypeEnum, orderType: OrderTypeEnum, paymentMethod: PaymentMethodEnum, search: String, pagination: PageInput, dateFilter: DateFilterInput): EarningsResponse!
    transactionHistory(userType: UserTypeEnum, userId: String, search: String, pagination: PageInput, dateFilter: DateFilterInput): TransactionHistoryResponse!
    withdrawRequests(userType: UserTypeEnum, userId: String, search: String, pagination: PageInput): WithdrawRequestsResponse!

    notifications: [Notification!]!
    webNotifications: [WebNotification!]!

    ordersByUser(userId: ID!, page: Int, limit: Int): OrderPagination!
    ordersByRestIdWithoutPagination(restaurant: String!, search: String): [Order!]!
    allOrders(page: Int): [Order!]!
    pendingConfirmationOrders(page: Int, limit: Int, search: String): OrderPagination!
    pendingConfirmationCount: Int!
    allOrdersPaginated(page: Int, rows: Int, dateKeyword: String, starting_date: String, ending_date: String, orderStatus: [String], search: String): OrderPagination!
    allOrdersWithoutPagination(dateKeyword: String, starting_date: String, ending_date: String): [Order!]!

    commissionRate(page: Int, limit: Int): CommissionRatePagination!
    restaurantsPaginated(page: Int, limit: Int, search: String): RestaurantsPaginated!
    getClonedRestaurants: [Restaurant!]!
    getClonedRestaurantsPaginated(page: Int, limit: Int, search: String): RestaurantsPaginated!
    getRestaurantDeliveryZoneInfo(id: ID!): RestaurantDeliveryZoneInfo
    restaurantCoupons(restaurantId: String!): [Coupon!]!
    reviews(restaurant: String!): [Review!]!

    ridersByZone(id: String!): [User!]!
    fetchShopTypes(filter: FetchShopTypeFilter, pagination: PaginationInput): ShopTypePagination!
    fetchShopTypeByUnique(dto: FetchUniqueShopTypeInput): ShopType
    staffs: [Staff!]!
    subCategory(_id: String): SubCategory
    user(id: ID!): User
    vendors: [Vendor!]!
    getVendor(id: String!): Vendor

    getTicketUsersWithLatest(input: FiltersInput): TicketUsersResult!
    getTicketUsers(input: FiltersInput): TicketUsersResult!
    getSingleUserSupportTickets(input: SingleUserSupportTicketsInput!): UserTicketsResult!
    getSingleSupportTicket(ticketId: ID!): SupportTicket
    getTicketMessages(input: TicketMessagesInput!): TicketMessagesResult!
  }

  extend type Mutation {
    saveEmailConfiguration(configurationInput: EmailConfigurationInput!): Configuration!
    saveFormEmailConfiguration(configurationInput: FormEmailConfigurationInput!): Configuration!
    saveSendGridConfiguration(configurationInput: SendGridConfigurationInput!): Configuration!
    saveFirebaseConfiguration(configurationInput: FirebaseConfigurationInput!): Configuration!
    saveSentryConfiguration(configurationInput: SentryConfigurationInput!): Configuration!
    saveGoogleApiKeyConfiguration(configurationInput: GoogleApiKeyConfigurationInput!): Configuration!
    saveCloudinaryConfiguration(configurationInput: CloudinaryConfigurationInput!): Configuration!
    saveAmplitudeApiKeyConfiguration(configurationInput: AmplitudeApiKeyConfigurationInput!): Configuration!
    saveGoogleClientIDConfiguration(configurationInput: GoogleClientIDConfigurationInput!): Configuration!
    saveWebConfiguration(configurationInput: WebConfigurationInput!): Configuration!
    saveAppConfigurations(configurationInput: AppConfigurationsInput!): Configuration!
    saveDeliveryRateConfiguration(configurationInput: DeliveryCostConfigurationInput!): Configuration!
    saveTwilioConfiguration(configurationInput: TwilioConfigurationInput!): Configuration!
    saveVerificationsToggle(configurationInput: VerificationConfigurationInput!): Configuration!
    saveCurrencyConfiguration(configurationInput: CurrencyConfigurationInput!): Configuration!

    editAddon(addonInput: editAddonInput): Restaurant!
    deleteAddon(id: String!, restaurant: String!): Restaurant!
    createOptions(optionInput: CreateOptionInput): Restaurant!
    editOption(optionInput: editOptionInput): Restaurant!
    deleteOption(id: String!, restaurant: String!): Restaurant!

    setVersions(customerAppVersion: AppTypeInput, riderAppVersion: AppTypeInput, restaurantAppVersion: AppTypeInput): Boolean!

    createBanner(bannerInput: BannerInput!): Banner!
    editBanner(bannerInput: BannerInput!): Banner!
    deleteBanner(id: String!): Boolean!
    createCuisine(cuisineInput: CuisineInput!): Cuisine!
    editCuisine(cuisineInput: CuisineInput!): Cuisine!
    deleteCuisine(id: String!): Boolean!
    createShopType(dto: CreateShopTypeInput): ShopType!
    updateShopType(dto: UpdateShopTypeInput): ShopType!
    deleteShopType(id: String!, type: DeleteTypeEnum): ShopType!
    createTaxation(taxationInput: TaxationInput!): Taxation!
    editTaxation(taxationInput: TaxationInput!): Taxation!
    createTipping(tippingInput: TippingInput!): Tipping!
    editTipping(tippingInput: TippingInput!): Tipping!
    createSubCategories(subCategories: [SubCategoryInput!]!): Boolean!
    deleteSubCategory(_id: String!): Boolean!

    updateCommission(id: String!, commissionRate: Float!): Restaurant!
    hardDeleteRestaurant(id: String!): Boolean!
    duplicateRestaurant(id: String!, owner: String!): Restaurant!
    updateRestaurantBussinessDetails(id: String!, bussinessDetails: BussinessDetailsInput): RestaurantResponse!
    updateDeliveryBoundsAndLocation(id: ID!, boundType: String!, bounds: [[[Float!]]], circleBounds: CircleBoundsInput, location: CoordinatesInput!, address: String, postCode: String, city: String): RestaurantResponse!
    updateTimings(id: String!, openingTimes: [TimingsInput]): Restaurant!
    updateDeliveryOptions(restId: String!, pickup: Boolean!, delivery: Boolean!): Restaurant!
    createRestaurantCoupon(restaurantId: ID!, couponInput: CouponInput!): Coupon!
    editRestaurantCoupon(restaurantId: ID!, couponInput: CouponInput!): Coupon!
    deleteRestaurantCoupon(restaurantId: ID!, couponId: ID!): Boolean!

    updateStatus(id: String!, orderStatus: String!): Order!
    adminConfirmOrder(id: String!, note: String): Order!
    adminRejectOrder(id: String!, reason: String!): Order!
    sendNotificationUser(notificationTitle: String, notificationBody: String!): Boolean!
    markWebNotificationsAsRead: [WebNotification!]!
    uploadImageToS3(image: String!): ImageUploadResult!
    uploadToken(id: String!, pushToken: String!): PushTokenResult!

    createStaff(staffInput: StaffInput!): Staff!
    editStaff(staffInput: StaffInput!): Staff!
    deleteStaff(id: String!): Staff!
    createVendor(vendorInput: VendorInput): Vendor!
    editVendor(vendorInput: VendorInput): Vendor!
    deleteVendor(id: String!): Boolean!

    updateUserStatus(id: ID!, status: String!, reason: String): User!
    updateUserNotes(id: ID!, notes: String!): User!
    deleteUser(id: ID!): User!
    resetUserSession(userId: ID!): User!

    createSupportTicket(ticketInput: SupportTicketInput!): SupportTicket!
    createMessage(messageInput: MessageInput!): TicketMessage!
    updateSupportTicketStatus(input: UpdateSupportTicketInput!): SupportTicket!

    updateWithdrawReqStatus(id: ID!, status: String!): WithdrawUpdateResponse!
    createWithdrawRequest(requestAmount: Float!, restaurantId: ID): WithdrawRequest!
  }

  extend type Subscription {
    subscriptionDispatcher: Order!
    subscriptionPendingOrders: Order!
    riderUpdated: User
  }

  extend type Restaurant {
    city: String
    postCode: String
  }

  enum UserTypeEnum { ALL RIDER STORE }
  enum OrderTypeEnum { ALL DELIVERY PICKUP }
  enum PaymentMethodEnum { ALL COD }
  enum DeleteTypeEnum { SOFT HARD }

  # ----- shared small types
  type BussinessDetails { bankName: String accountName: String accountCode: String accountNumber: String bussinessRegNo: String companyRegNo: String taxRate: Float }
  type LicenseDetails { number: String expiryDate: String image: String }
  type VehicleDetails { number: String image: String }
  type DeliveryInfo { minDeliveryFee: Float deliveryDistance: Float deliveryFee: Float }
  type DeliveryOptions { delivery: Boolean pickup: Boolean }
  type CircleBounds { radius: Float }
  type PaginationTotal { total: Int }
  type ImageUploadResult { imageUrl: String }
  type PushTokenResult { _id: ID pushToken: String }
  type RestaurantResponse { success: Boolean! message: String data: Restaurant }
  type RestaurantDeliveryZoneInfo { boundType: String deliveryBounds: DeliveryBounds location: Location circleBounds: CircleBounds address: String city: String postCode: String }
  type RestaurantsPaginated { data: [Restaurant!]! totalCount: Int! currentPage: Int! totalPages: Int! }
  type CommissionRatePagination { restaurant: [Restaurant!]! currentPage: Int! totalPages: Int! nextPage: Int prevPage: Int }

  # ----- people
  type Vendor {
    _id: ID!
    unique_id: String
    email: String
    userType: String
    isActive: Boolean
    name: String
    image: String
    firstName: String
    lastName: String
    phoneNumber: String
    password: String
    plainPassword: String
    restaurants: [Restaurant!]
  }
  type Staff {
    _id: ID!
    name: String
    email: String
    password: String
    plainPassword: String
    phone: String
    isActive: Boolean
    permissions: [String!]
    userType: String
  }

  # ----- catalog extras
  type ShopType { _id: ID! name: String image: String isActive: Boolean }
  type ShopTypePagination { data: [ShopType!]! total: Int! page: Int! pageSize: Int! totalPages: Int! hasNextPage: Boolean! hasPrevPage: Boolean! }
  type Notification { _id: ID! title: String body: String createdAt: Date }
  type WebNotification { _id: ID! title: String body: String navigateTo: String read: Boolean createdAt: Date }

  # ----- dashboard
  type DashboardUsers { usersCount: Int! vendorsCount: Int! restaurantsCount: Int! ridersCount: Int! }
  type PercentageChange { usersPercent: Float vendorsPercent: Float restaurantsPercent: Float ridersPercent: Float }
  type DashboardUsersByYear { usersCount: [Int!]! vendorsCount: [Int!]! restaurantsCount: [Int!]! ridersCount: [Int!]! percentageChange: PercentageChange }
  type DashboardLabelValue { value: Float! label: String! }
  type RestaurantOrdersSalesStats { totalOrders: Int! totalSales: Float! totalCODOrders: Int! totalCardOrders: Int! }
  type RestaurantYearlyStats { salesAmount: [Float!]! ordersCount: [Int!]! }
  type PaymentBreakdownData { total_orders: Int total_sales: Float total_sales_without_delivery: Float total_delivery_fee: Float }
  type PaymentBreakdownEntry { _type: String data: PaymentBreakdownData }
  type PaymentMethodBreakdown { all: PaymentBreakdownEntry cod: PaymentBreakdownEntry card: PaymentBreakdownEntry }
  type VendorStoreDetails { _id: ID restaurantName: String totalOrders: Int totalSales: Float pickUpCount: Int deliveryCount: Int }
  type VendorStatsCard { totalRestaurants: Int! totalOrders: Int! totalSales: Float! totalDeliveries: Int! }
  type LiveMonitorData { online_stores: Int! cancelled_orders: Int! delayed_orders: Int! ratings: Float! }
  type VendorGrowth { totalRestaurants: [Int!]! totalOrders: [Int!]! totalSales: [Float!]! }
  type AuditLogEntry { _id: ID! timestamp: Date admin: User action: String targetType: String targetId: String changes: JSON }
  type AuditLogPagination { auditLogs: [AuditLogEntry!]! totalCount: Int! currentPage: Int! totalPages: Int! }

  # ----- finance
  type PlatformEarnings { marketplaceCommission: Float deliveryCommission: Float tax: Float platformFee: Float totalEarnings: Float }
  type RiderEarnings { riderId: User deliveryFee: Float tip: Float totalEarnings: Float }
  type StoreEarnings { storeId: Restaurant orderAmount: Float totalEarnings: Float }
  type Earning { _id: ID! orderId: String orderType: String paymentMethod: String createdAt: Date updatedAt: Date platformEarnings: PlatformEarnings riderEarnings: RiderEarnings storeEarnings: StoreEarnings }
  type GrandTotalEarnings { platformTotal: Float riderTotal: Float storeTotal: Float }
  type EarningsData { earnings: [Earning!]! grandTotalEarnings: GrandTotalEarnings }
  type EarningsResponse { success: Boolean! message: String data: EarningsData pagination: PaginationTotal }
  type BankDetails { accountName: String bankName: String accountNumber: String accountCode: String }
  type TransactionRecord { _id: ID! amountCurrency: String status: String transactionId: String userType: String userId: String amountTransferred: Float createdAt: Date toBank: BankDetails rider: User store: Restaurant }
  type TransactionHistoryResponse { data: [TransactionRecord!]! pagination: PaginationTotal }
  type WithdrawRequest { _id: ID! requestId: String requestAmount: Float requestTime: Date status: String createdAt: Date rider: User store: Restaurant }
  type WithdrawRequestsResponse { success: Boolean! message: String data: [WithdrawRequest!]! pagination: PaginationTotal }
  type WithdrawUpdateResponse { success: Boolean! message: String data: WithdrawRequest }

  # ----- support
  type SupportTicket { _id: ID! title: String description: String status: String category: String orderId: String otherDetails: String createdAt: Date updatedAt: Date user: User }
  type TicketMessage { _id: ID! content: String senderType: String isRead: Boolean ticket: ID createdAt: Date updatedAt: Date }
  type TicketUser { _id: ID! name: String email: String phone: String isActive: Boolean userType: String latestTicket: SupportTicket }
  type TicketUsersResult { users: [TicketUser!]! docsCount: Int! totalPages: Int! currentPage: Int! }
  type UserTicketsResult { tickets: [SupportTicket!]! docsCount: Int! totalPages: Int! currentPage: Int! }
  type TicketMessagesResult { messages: [TicketMessage!]! ticket: SupportTicket page: Int! totalPages: Int! docsCount: Int! }

  # ----- inputs
  input PageInput { pageSize: Int pageNo: Int }
  input PaginationInput { page: Int pageSize: Int limit: Int }
  input DateFilterInput { starting_date: String ending_date: String }
  input FiltersInput { page: Int limit: Int status: String search: String category: String }
  input SingleUserSupportTicketsInput { userId: ID! filters: FiltersInput }
  input TicketMessagesInput { ticket: ID! page: Int limit: Int }
  input MessageInput { content: String! ticket: ID! }
  input UpdateSupportTicketInput { ticketId: ID! status: String! }
  input SupportTicketInput { title: String! description: String category: String orderId: String otherDetails: String }

  input BussinessDetailsInput { bankName: String accountName: String accountCode: String accountNumber: String bussinessRegNo: String companyRegNo: String taxRate: Float }
  input LicenseDetailsInput { number: String expiryDate: String image: String }
  input VehicleDetailsInput { number: String image: String }
  input CircleBoundsInput { radius: Float }
  # latitude/longitude arrive as numbers or numeric strings depending on the caller.
  input CoordinatesInput { latitude: JSON longitude: JSON }
  input TimeSlotInput { startTime: [String] endTime: [String] }
  input TimingsInput { day: String times: [TimeSlotInput] }
  input RestaurantProfileInput {
    _id: ID
    name: String
    phone: String
    address: String
    image: String
    logo: String
    deliveryTime: Int
    minimumOrder: Float
    username: String
    password: String
    shopType: String
    salesTax: Float
    orderPrefix: String
    cuisines: [String!]
    isAvailable: Boolean
  }
  input AddonFormInput { _id: ID title: String description: String quantityMinimum: Int quantityMaximum: Int options: [String!] }
  input editAddonInput { _id: ID restaurant: String addons: AddonFormInput }
  input RestaurantOptionInput { _id: ID title: String! description: String price: Float! }
  input CreateOptionInput { restaurant: String! options: [RestaurantOptionInput!]! }
  input editOptionInput { _id: ID restaurant: String! options: RestaurantOptionInput! }
  input AppTypeInput { android: String ios: String }
  input BannerInput { _id: ID title: String! description: String action: String screen: String file: String parameters: JSON }
  input CuisineInput { _id: ID name: String! description: String image: String shopType: String }
  input CreateShopTypeInput { name: String! image: String isActive: Boolean }
  input UpdateShopTypeInput { _id: ID! name: String image: String isActive: Boolean }
  input FetchShopTypeFilter { search: String name: String isActive: Boolean }
  input FetchUniqueShopTypeInput { _id: ID name: String }
  input TaxationInput { _id: ID taxationCharges: Float enabled: Boolean }
  input TippingInput { _id: ID tipVariations: [Float!] enabled: Boolean }
  input SubCategoryInput { _id: ID title: String! parentCategoryId: String! }
  input StaffInput { _id: ID name: String! email: String! password: String phone: String isActive: Boolean permissions: [String!] }
  input VendorInput { _id: ID name: String email: String! password: String image: String firstName: String lastName: String phoneNumber: String }

  input EmailConfigurationInput { email: String password: String emailName: String enableEmail: Boolean }
  input FormEmailConfigurationInput { formEmail: String }
  input SendGridConfigurationInput { sendGridApiKey: String sendGridEnabled: Boolean sendGridEmail: String sendGridEmailName: String sendGridPassword: String }
  input FirebaseConfigurationInput { firebaseKey: String authDomain: String projectId: String storageBucket: String msgSenderId: String appId: String measurementId: String vapidKey: String }
  input SentryConfigurationInput { dashboardSentryUrl: String webSentryUrl: String apiSentryUrl: String customerAppSentryUrl: String restaurantAppSentryUrl: String riderAppSentryUrl: String }
  input GoogleApiKeyConfigurationInput { mapTileUrl: String geocodingUrl: String routingUrl: String }
  input CloudinaryConfigurationInput { cloudinaryUploadUrl: String cloudinaryApiKey: String }
  input AmplitudeApiKeyConfigurationInput { webAmplitudeApiKey: String appAmplitudeApiKey: String }
  input GoogleClientIDConfigurationInput { webClientID: String androidClientID: String iOSClientID: String expoClientID: String }
  input WebConfigurationInput { mapTileUrl: String geocodingUrl: String routingUrl: String }
  input AppConfigurationsInput { termsAndConditions: String privacyPolicy: String testOtp: String }
  input DeliveryCostConfigurationInput { deliveryRate: Float costType: String }
  input TwilioConfigurationInput { twilioAccountSid: String twilioAuthToken: String twilioPhoneNumber: String twilioEnabled: Boolean twilioWhatsAppNumber: String }
  input VerificationConfigurationInput { skipEmailVerification: Boolean skipMobileVerification: Boolean skipWhatsAppOTP: Boolean }
  input CurrencyConfigurationInput { currency: String currencySymbol: String }
`;
