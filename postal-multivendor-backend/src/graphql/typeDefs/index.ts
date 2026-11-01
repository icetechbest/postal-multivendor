import { adminTypeDefs } from './admin';

const baseTypeDefs = `#graphql
  scalar Date
  scalar JSON
  directive @client on FIELD

  type Query {
    profile: User
    users: [User!]!
    restaurants(page: Int, limit: Int, search: String): [Restaurant!]!
    restaurant(id: String): Restaurant
    restaurantByOwner(id: String): Vendor
    nearByRestaurants(latitude: Float, longitude: Float, shopType: String, limit: Int): RestaurantList!
    nearByRestaurantsPreview(latitude: Float, longitude: Float, shopType: String): RestaurantPreviewList!
    topRatedVendors(latitude: Float, longitude: Float, limit: Int): [Restaurant!]!
    topRatedVendorsPreview(latitude: Float!, longitude: Float!): [RestaurantPreview!]!
    recentOrderRestaurants(latitude: Float!, longitude: Float!): [Restaurant!]!
    recentOrderRestaurantsPreview(latitude: Float!, longitude: Float!): [RestaurantPreview!]!
    mostOrderedRestaurants(latitude: Float!, longitude: Float!): [Restaurant!]!
    mostOrderedRestaurantsPreview(latitude: Float!, longitude: Float!, shopType: String): [RestaurantPreview!]!
    userFavourite(latitude: Float, longitude: Float): [Restaurant!]!
    myOrders(page: Int, limit: Int): OrderPagination!
    orders(offset: Int): [Order!]!
    order(id: String!): Order
    getActiveOrders(restaurantId: ID, page: Int, limit: Int, status: String, rowsPerPage: Int, actions: [String], search: String): OrderPagination!
    ordersByRestId(restaurant: String!, page: Int, rows: Int, limit: Int, status: String, search: String): [Order!]!
    food(restaurant: ID!): [Food!]!
    categories: [Category!]!
    popularFoodItems(restaurantId: String!): [Food!]!
    relatedItems(itemId: String!, restaurantId: String!): [ID!]!
    popularItems(restaurantId: String!): [PopularItem!]!
    fetchCategoryDetailsByStoreIdForMobile(storeId: String!): [StoreCategoryDetails!]!
    addons: [Addon!]!
    zones: [Zone!]!
    zone(id: ID!): Zone
    coupons: [Coupon!]!
    configuration: Configuration!
    getConfiguration: Configuration!
    taxes: [Taxation!]!
    getTaxation: Taxation!
    tips: [Tipping!]!
    getTipping: Tipping!
    cuisines: [Cuisine!]!
    banners: [Banner!]!
    getVersions: Versions!
    subCategories: [SubCategory!]!
    subCategoriesByParentId(parentCategoryId: String!): [SubCategory!]!
    reviewsByRestaurant(restaurant: String!): ReviewData!
    getCountryByIso(iso: String!): Country
    chat(order: ID!): [ChatMessage!]!
    riders: [User!]!
    rider(id: String): User
    availableRiders(zone: ID): [User!]!
  }

  type Mutation {
    login(email: String, password: String, type: String!, appleId: String, name: String, notificationToken: String): AuthPayload!
    createUser(userInput: UserInput!): AuthPayload!
    refreshToken(refreshToken: String!): AuthPayload!
    updateUser(updateUserInput: UpdateUserInput!): User!
    changePassword(oldPassword: String!, newPassword: String!): Boolean!
    forgotPassword(email: String!): Result!
    resetPassword(password: String!, email: String!, token: String): Result!
    sendOtpToEmail(email: String!): Result!
    sendOtpToPhoneNumber(phone: String!): Result!
    verifyOtp(phone: String, email: String, otp: String!): Result!
    ownerLogin(email: String!, password: String!): AuthPayload!
    emailExist(email: String!): User
    phoneExist(phone: String!): User
    Deactivate(isActive: Boolean!, email: String!): User
    pushToken(token: String): User
    updateNotificationStatus(offerNotification: Boolean!, orderNotification: Boolean!, isOrderNotification: Boolean): User!
    createRestaurant(restaurant: RestaurantInput, owner: ID, restaurantInput: RestaurantInput): Restaurant!
    editRestaurant(restaurant: RestaurantProfileInput, restaurantInput: EditRestaurantInput): Restaurant!
    deleteRestaurant(id: String!): Restaurant!
    updateRestaurantDelivery(id: ID!, deliveryBounds: [[[Float!]!]!], minDeliveryFee: Float, deliveryDistance: Float, deliveryFee: Float): RestaurantResponse!
    createFood(foodInput: FoodInput!): Restaurant!
    editFood(foodInput: FoodInput!): Restaurant!
    deleteFood(id: String!, restaurant: String, categoryId: String): Food!
    updateFoodOutOfStock(id: String!, restaurant: String, categoryId: String, isAvailable: Boolean): Boolean!
    placeOrder(restaurant: String!, orderInput: [OrderInput!]!, paymentMethod: String!, couponCode: String, tipping: Float!, taxationAmount: Float!, address: AddressInput!, orderDate: String!, isPickedUp: Boolean!, deliveryCharges: Float!, instructions: String): Order!
    updateOrderStatus(id: ID!, status: String!, reason: String): Order!
    assignRider(id: String, orderId: String, riderId: String!): Order!
    abortOrder(id: String!, reason: String): Order!
    cancelOrder(id: ID!, reason: String!): Order!
    reviewOrder(reviewInput: ReviewInput!): Order!
    createAddress(addressInput: AddressInput!): User!
    editAddress(addressInput: AddressInput!): User!
    deleteAddress(id: ID!): User!
    deleteBulkAddresses(ids: [ID!]!): User!
    selectAddress(id: String!): User!
    addFavourite(id: String!): User!
    addFavouriteRestaurant(id: ID!): User!
    createCategory(category: CategoryInput, categoryInput: CategoryInput): Restaurant!
    editCategory(category: CategoryInput, categoryInput: CategoryInput): Restaurant!
    deleteCategory(id: String!, restaurant: String): Restaurant!
    createAddons(addonInput: AddonInput): Restaurant!
    editAddons(addonInput: EditAddonInput!): Addon!
    deleteAddons(id: ID!): SuccessMessage!
    createCoupon(couponInput: CouponInput!): Coupon!
    editCoupon(couponInput: CouponInput!): Coupon!
    deleteCoupon(id: String!): Boolean!
    coupon(coupon: String!, restaurantId: ID!): CouponResponse!
    applyCoupon(code: String!, restaurant: ID): Coupon!
    createZone(zone: ZoneInput, zoneInput: ZoneInput): Zone!
    editZone(zone: ZoneInput, zoneInput: ZoneInput): Zone!
    deleteZone(id: String!): Zone!
    createRider(riderInput: RiderInput!): User!
    editRider(riderInput: RiderInput!): User!
    deleteRider(id: String!): User!
    toggleAvailablity(id: String!): User!
    updateRiderLocation(latitude: Float!, longitude: Float!): User!
    sendChatMessage(message: ChatMessageInput!, orderId: ID!): ChatResponse!
    createActivity(groupId: String!, module: String!, screenPath: String!, type: String!, details: String!): Boolean!
  }

  type Subscription {
    subscribePlaceOrder(restaurant: String!): OrderStatusChanged!
    subscriptionOrder(id: String!): Order!
    orderStatusChanged(userId: String!): OrderStatusChanged!
    subscriptionRiderLocation(riderId: String!): User!
    subscriptionNewMessage(order: ID!): ChatMessage!
  }

  type User {
    _id: ID!
    id: ID
    name: String
    email: String
    phone: String
    password: String
    username: String
    phoneIsVerified: Boolean
    emailIsVerified: Boolean
    phoneVerified: Boolean
    emailVerified: Boolean
    userType: String
    role: String
    isActive: Boolean
    isOrderNotification: Boolean
    isOfferNotification: Boolean
    notificationToken: String
    addresses: [Address!]
    favourite: [ID!]
    favouriteRestaurants: [Restaurant!]
    avatar: String
    image: String
    available: Boolean
    isAvailable: Boolean
    location: Location
    zone: Zone
    accountNumber: String
    currentWalletAmount: Float
    totalWalletAmount: Float
    withdrawnWalletAmount: Float
    vehicleType: String
    assigned: Boolean
    status: String
    lastLogin: Date
    notes: String
    bussinessDetails: BussinessDetails
    licenseDetails: LicenseDetails
    vehicleDetails: VehicleDetails
    createdAt: Date
    updatedAt: Date
  }

  type Restaurant {
    _id: ID!
    id: ID
    orderId: String
    orderPrefix: String
    name: String
    slug: String
    image: String
    logo: String
    address: String
    location: Location
    deliveryBounds: DeliveryBounds
    username: String
    password: String
    deliveryTime: Int
    minimumOrder: Float
    salesTax: Float
    tax: Float
    isActive: Boolean
    isAvailable: Boolean
    commissionRate: Float
    owner: User
    reviewCount: Int
    reviewAverage: Float
    rating: Float
    categories: [Category!]
    options: [Option!]
    addons: [RestaurantAddon!]
    reviewData: ReviewData
    openingTimes: [OpeningTime!]
    zone: Zone
    deliveryFee: Float
    wallet: Float
    totalOrders: Int
    totalEarnings: Float
    sections: [String!]
    notificationToken: String
    enableNotification: Boolean
    shopType: String
    phone: String
    restaurantUrl: String
    cuisines: [String!]
    keywords: [String!]
    tags: [String!]
    freeDelivery: Boolean
    acceptVouchers: Boolean
    distanceWithCurrentLocation: Float
    unique_restaurant_id: String
    deliveryInfo: DeliveryInfo
    deliveryOptions: DeliveryOptions
    bussinessDetails: BussinessDetails
    currentWalletAmount: Float
    totalWalletAmount: Float
    withdrawnWalletAmount: Float
    createdAt: Date
    updatedAt: Date
  }

  type RestaurantPreview {
    _id: ID!
    id: ID
    orderId: String
    orderPrefix: String
    name: String
    image: String
    logo: String
    address: String
    username: String
    password: String
    deliveryTime: Int
    minimumOrder: Float
    sections: [String!]
    rating: Float
    isActive: Boolean
    isAvailable: Boolean
    slug: String
    commissionRate: Float
    tax: Float
    notificationToken: String
    enableNotification: Boolean
    shopType: String
    cuisines: [String!]
    keywords: [String!]
    tags: [String!]
    reviewCount: Int
    reviewAverage: Float
    location: Location
    openingTimes: [OpeningTime!]
    distanceWithCurrentLocation: Float
    freeDelivery: Boolean
    acceptVouchers: Boolean
  }

  type RestaurantList {
    offers: [Offer!]!
    sections: [RestaurantSection!]!
    restaurants: [Restaurant!]!
  }

  type RestaurantPreviewList {
    offers: [Offer!]!
    sections: [RestaurantSection!]!
    restaurants: [RestaurantPreview!]!
  }

  type Offer {
    _id: ID!
    name: String
    tag: String
    restaurants: [ID!]
  }

  type RestaurantSection {
    _id: ID!
    name: String
    restaurants: [ID!]
  }

  type Food {
    _id: ID!
    id: ID
    title: String
    description: String
    image: String
    subCategory: String
    isActive: Boolean
    isAvailable: Boolean
    isOutOfStock: Boolean
    restaurant: Restaurant
    category: Category
    variations: [Variation!]
    isPopular: Boolean
    orderCount: Int
    createdAt: Date
    updatedAt: Date
  }

  type Order {
    _id: ID!
    id: ID
    orderId: String
    restaurant: Restaurant
    user: User
    items: [OrderItem!]
    deliveryAddress: DeliveryAddress
    orderAmount: Float
    deliveryCharges: Float
    tipping: Float
    taxationAmount: Float
    discount: Float
    total: Float
    paymentMethod: String
    paidAmount: Float
    status: String
    orderStatus: String
    paymentStatus: String
    reason: String
    adminConfirmedBy: ID
    adminConfirmedAt: Date
    adminNote: String
    adminRejectedAt: Date
    isActive: Boolean
    rider: User
    riderAssignedAt: Date
    assignedAt: Date
    acceptedAt: Date
    pickedAt: Date
    deliveredAt: Date
    completedAt: Date
    cancelledAt: Date
    estimatedDeliveryTime: Date
    expectedTime: Date
    completionTime: Date
    orderDate: Date
    preparationTime: Int
    review: Review
    isReviewed: Boolean
    isPickedUp: Boolean
    isRinged: Boolean
    isRiderRinged: Boolean
    instructions: String
    zone: Zone
    selectedPrepTime: Int
    createdAt: Date
    updatedAt: Date
  }

  type Address {
    _id: ID!
    id: ID
    label: String
    deliveryAddress: String
    details: String
    location: Location
    user: ID
    selected: Boolean
    isSelected: Boolean
    createdAt: Date
    updatedAt: Date
  }

  type Category {
    _id: ID!
    id: ID
    title: String
    description: String
    image: String
    foods: [Food!]
    isActive: Boolean
    createdAt: Date
    updatedAt: Date
  }

  type Addon {
    _id: ID!
    id: ID
    title: String
    description: String
    quantityMinimum: Int
    quantityMaximum: Int
    options: [Option!]
    isActive: Boolean
    createdAt: Date
    updatedAt: Date
  }

  type RestaurantAddon {
    _id: ID!
    id: ID
    title: String
    description: String
    quantityMinimum: Int
    quantityMaximum: Int
    options: JSON
  }

  type Zone {
    _id: ID!
    title: String
    description: String
    location: DeliveryBounds
    tax: Float
    isActive: Boolean
    createdAt: Date
    updatedAt: Date
  }

  type Coupon {
    _id: ID!
    title: String
    code: String
    discount: Float
    enabled: Boolean
    isActive: Boolean
    isEnabled: Boolean
    startDate: Date
    endDate: Date
    lifeTimeActive: Boolean
    restaurant: Restaurant
    createdAt: Date
    updatedAt: Date
  }

  type Configuration {
    _id: ID!
    email: String
    password: String
    emailName: String
    enableEmail: Boolean
    currency: String
    currencySymbol: String
    deliveryRate: Float
    twilioEnabled: Boolean
    twilioAccountSid: String
    twilioAuthToken: String
    twilioPhoneNumber: String
    firebaseKey: String
    authDomain: String
    projectId: String
    storageBucket: String
    msgSenderId: String
    appId: String
    measurementId: String
    androidClientID: String
    iOSClientID: String
    expoClientID: String
    appAmplitudeApiKey: String
    mapTileUrl: String
    geocodingUrl: String
    customerAppSentryUrl: String
    termsAndConditions: String
    privacyPolicy: String
    testOtp: String
    skipMobileVerification: Boolean
    skipEmailVerification: Boolean
    skipPhoneVerification: Boolean
    costType: String
    isPaidVersion: Boolean
    routingUrl: String
    appleStoreUrl: String
    playStoreUrl: String
    webClientID: String
    webAmplitudeApiKey: String
    webSentryUrl: String
    apiSentryUrl: String
    dashboardSentryUrl: String
    restaurantAppSentryUrl: String
    riderAppSentryUrl: String
    sendGridEnabled: Boolean
    sendGridApiKey: String
    sendGridEmail: String
    sendGridEmailName: String
    sendGridPassword: String
    formEmail: String
    skipWhatsAppOTP: Boolean
    twilioWhatsAppNumber: String
    cloudinaryUploadUrl: String
    cloudinaryApiKey: String
    vapidKey: String
  }

  type Taxation {
    _id: ID!
    taxationCharges: Float
    enabled: Boolean
  }

  type Tipping {
    _id: ID!
    tipVariations: [Float!]
    enabled: Boolean
  }

  type Cuisine {
    _id: ID!
    name: String
    description: String
    image: String
    shopType: String
  }

  type Banner {
    _id: ID!
    title: String
    description: String
    action: String
    screen: String
    file: String
    parameters: JSON
  }

  type Versions {
    customerAppVersion: AppVersion
    riderAppVersion: AppVersion
    restaurantAppVersion: AppVersion
  }

  type AppVersion {
    android: String
    ios: String
  }

  type SubCategory {
    _id: ID!
    title: String
    parentCategoryId: String
  }

  type ReviewData {
    reviews: [Review!]
    ratings: Float
    total: Int
  }

  type Review {
    _id: ID!
    rating: Int
    description: String
    comments: String
    isActive: Boolean
    order: Order
    restaurant: Restaurant
    createdAt: Date
    updatedAt: Date
  }

  type Country {
    iso: String
    cities: [City!]
  }

  type City {
    id: ID
    name: String
    latitude: Float
    longitude: Float
  }

  type ChatMessage {
    id: ID!
    message: String
    user: ChatUser
    createdAt: Date
  }

  type ChatUser {
    id: ID
    name: String
  }

  type ChatResponse {
    success: Boolean!
    message: String
    data: ChatMessage
  }

  type StoreCategoryDetails {
    id: ID
    category_name: String
    url: String
    food_id: ID
  }

  type PopularItem {
    id: ID
    count: Int
  }

  type OrderStatusChanged {
    userId: String
    origin: String
    order: Order
  }

  type Location {
    coordinates: [Float!]
  }

  type DeliveryBounds {
    coordinates: [[[Float!]!]!]
  }

  type OpeningTime {
    day: String
    times: [TimeRange!]
  }

  type TimeRange {
    startTime: [String!]
    endTime: [String!]
  }

  type Variation {
    _id: ID!
    id: ID
    title: String
    price: Float
    discounted: Float
    addons: [ID!]
    isOutOfStock: Boolean
  }

  type OrderItem {
    _id: ID
    id: ID
    title: String
    food: ID
    description: String
    image: String
    quantity: Int
    variation: VariationDetail
    addons: [AddonDetail!]
    specialInstructions: String
    isActive: Boolean
    isOutOfStock: Boolean
    createdAt: Date
    updatedAt: Date
  }

  type VariationDetail {
    _id: ID
    id: ID
    title: String
    price: Float
    discounted: Float
  }

  type AddonDetail {
    _id: ID
    id: ID
    title: String
    description: String
    quantityMinimum: Int
    quantityMaximum: Int
    options: [OptionDetail!]
  }

  type OptionDetail {
    _id: ID
    id: ID
    title: String
    description: String
    price: Float
  }

  type Option {
    _id: ID!
    id: ID
    title: String
    description: String
    price: Float
  }

  type DeliveryAddress {
    id: ID
    label: String
    deliveryAddress: String
    details: String
    location: Location
  }

  type AuthPayload {
    userId: ID
    token: String
    refreshToken: String
    tokenExpiration: Int
    isActive: Boolean
    name: String
    email: String
    phone: String
    isNewUser: Boolean
    userType: String
    userTypeId: String
    permissions: [String!]
    image: String
    shopType: String
    restaurants: [Restaurant!]
    user: User
  }

  type Result {
    result: String
  }

  type SuccessMessage {
    message: String!
  }

  type CouponResponse {
    coupon: Coupon
    message: String
    success: Boolean
  }

  type RestaurantPagination {
    restaurants: [Restaurant!]!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
  }

  type OrderPagination {
    orders: [Order!]!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
    nextPage: Int
    prevPage: Int
  }

  input UserInput {
    name: String
    email: String
    password: String
    phone: String
    notificationToken: String
    appleId: String
    emailIsVerified: Boolean
    isPhoneExists: Boolean
  }

  input UpdateUserInput {
    name: String!
    phone: String
    phoneIsVerified: Boolean
    emailIsVerified: Boolean
  }

  input RestaurantInput {
    name: String!
    address: String!
    image: String
    logo: String
    phone: String
    username: String
    password: String
    shopType: String
    cuisines: [String!]
    deliveryTime: Int
    minimumOrder: Float
    salesTax: Float
    orderPrefix: String
    location: LocationInput
    ownerId: ID
    deliveryFee: Float
    zone: ID
  }

  input EditRestaurantInput {
    _id: ID!
    name: String
    address: String
    image: String
    logo: String
    deliveryTime: Int
    minimumOrder: Float
    salesTax: Float
    isAvailable: Boolean
    deliveryFee: Float
  }

  input FoodInput {
    _id: ID
    subCategory: String
    isActive: Boolean
    title: String!
    description: String!
    image: String!
    restaurant: ID!
    category: ID!
    variations: [VariationInput!]!
  }

  input EditFoodInput {
    _id: ID!
    title: String
    description: String
    image: String
    category: ID
    variations: [VariationInput!]
  }

  input VariationInput {
    _id: ID
    isOutOfStock: Boolean
    title: String!
    price: Float!
    discounted: Float
    addons: [ID!]
  }

  input OrderInput {
    food: String!
    variation: String!
    addons: [OrderAddonInput!]
    quantity: Int!
    specialInstructions: String
  }

  input OrderAddonInput {
    _id: ID!
    options: [ID!]!
  }

  input AddressInput {
    _id: ID
    label: String!
    deliveryAddress: String!
    details: String
    latitude: String!
    longitude: String!
  }

  input ReviewInput {
    order: String!
    rating: Int!
    description: String
  }

  input CategoryInput {
    _id: ID
    restaurant: String
    parentCategoryId: String
    title: String!
    description: String
    image: String
  }

  input EditCategoryInput {
    _id: ID!
    title: String
    description: String
    image: String
  }

  input AddonInput {
    restaurant: String
    addons: [AddonFormInput!]
    title: String
    description: String
    quantityMinimum: Int
    quantityMaximum: Int
    options: [OptionInput!]
  }

  input EditAddonInput {
    _id: ID!
    title: String
    description: String
    quantityMinimum: Int
    quantityMaximum: Int
    options: [OptionInput!]
  }

  input OptionInput {
    _id: ID
    title: String!
    description: String
    price: Float!
  }

  input CouponInput {
    _id: ID
    code: String
    title: String
    discount: Float!
    enabled: Boolean
    isActive: Boolean
    isEnabled: Boolean
    startDate: String
    endDate: String
    lifeTimeActive: Boolean
    restaurant: ID
  }

  input EditCouponInput {
    _id: ID!
    code: String
    discount: Float
    isActive: Boolean
    isEnabled: Boolean
  }

  input ZoneInput {
    _id: ID
    title: String!
    description: String
    coordinates: [[[Float!]!]!]
  }

  input EditZoneInput {
    _id: ID!
    title: String
    description: String
    coordinates: [[[[Float!]!]!]!]
  }

  input RiderInput {
    _id: ID
    name: String!
    username: String
    email: String
    password: String
    phone: String
    zone: ID
    vehicleType: String
    available: Boolean
    bussinessDetails: BussinessDetailsInput
    licenseDetails: LicenseDetailsInput
    vehicleDetails: VehicleDetailsInput
  }

  input EditRiderInput {
    _id: ID!
    name: String
    email: String
    phone: String
    zone: ID
    isActive: Boolean
  }

  input LocationInput {
    latitude: Float!
    longitude: Float!
  }

  input ChatMessageInput {
    message: String!
    user: ChatUserInput!
  }

  input ChatUserInput {
    id: ID!
    name: String!
  }
`;

export const typeDefs = baseTypeDefs + '\n' + adminTypeDefs;
