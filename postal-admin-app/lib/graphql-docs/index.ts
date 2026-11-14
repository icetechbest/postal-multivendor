// AUTO-GENERATED from packages/graphql-docs/src/index.ts — run `npm run sync:docs`.
import { gql } from 'graphql-tag';

/** Fragments shared by order lists and details. */
export const ORDER_SUMMARY_FIELDS = gql`
  fragment OrderSummaryFields on Order {
    _id
    orderId
    orderStatus
    status
    total
    orderAmount
    paymentMethod
    paymentStatus
    createdAt
    user {
      _id
      name
      phone
    }
    restaurant {
      _id
      name
    }
    deliveryAddress {
      deliveryAddress
      details
    }
    rider {
      _id
      name
      phone
      available
    }
  }
`;

export const LOGIN = gql`
  mutation Login($email: String!, $password: String!, $type: String!) {
    login(email: $email, password: $password, type: $type) {
      userId
      token
      refreshToken
      tokenExpiration
      isActive
      name
      email
      phone
      userType
      image
      user {
        _id
        name
        email
        phone
        role
        userType
        isActive
        image
      }
    }
  }
`;

export const PROFILE = gql`
  query Profile {
    profile {
      _id
      name
      email
      phone
      role
      userType
      isActive
      image
      currentWalletAmount
    }
  }
`;

export const DASHBOARD_USERS = gql`
  query DashboardUsers {
    getDashboardUsers {
      usersCount
      vendorsCount
      restaurantsCount
      ridersCount
    }
  }
`;

export const DASHBOARD_ORDERS_BY_TYPE = gql`
  query DashboardOrdersByType {
    getDashboardOrdersByType {
      value
      label
    }
  }
`;

export const DASHBOARD_SALES_BY_TYPE = gql`
  query DashboardSalesByType {
    getDashboardSalesByType {
      value
      label
    }
  }
`;

export const ALL_ORDERS_PAGINATED = gql`
  query AllOrdersPaginated(
    $page: Int
    $rows: Int
    $dateKeyword: String
    $orderStatus: [String]
    $search: String
  ) {
    allOrdersPaginated(
      page: $page
      rows: $rows
      dateKeyword: $dateKeyword
      orderStatus: $orderStatus
      search: $search
    ) {
      totalCount
      currentPage
      totalPages
      orders {
        ...OrderSummaryFields
      }
    }
  }
  ${ORDER_SUMMARY_FIELDS}
`;

export const ORDER_BY_ID = gql`
  query OrderById($id: String!) {
    order(id: $id) {
      ...OrderSummaryFields
      instructions
      deliveryCharges
      tipping
      taxationAmount
      discount
      adminNote
      adminConfirmedAt
      adminRejectedAt
      items {
        _id
        title
        quantity
        specialInstructions
        variation {
          _id
          title
          price
          discounted
        }
        addons {
          _id
          title
          options {
            _id
            title
            price
          }
        }
      }
    }
  }
  ${ORDER_SUMMARY_FIELDS}
`;

export const UPDATE_ORDER_STATUS = gql`
  mutation UpdateOrderStatus($id: String!, $orderStatus: String!) {
    updateStatus(id: $id, orderStatus: $orderStatus) {
      _id
      orderStatus
      status
    }
  }
`;

export const ASSIGN_RIDER = gql`
  mutation AssignRider($orderId: String!, $riderId: String!) {
    assignRider(orderId: $orderId, riderId: $riderId) {
      _id
      orderStatus
      rider {
        _id
        name
      }
    }
  }
`;

export const RIDERS = gql`
  query Riders {
    riders {
      _id
      name
      email
      phone
      available
      isAvailable
      assigned
      status
      vehicleType
      currentWalletAmount
      zone {
        _id
        title
      }
      location {
        coordinates
      }
    }
  }
`;

export const RESTAURANTS_PAGINATED = gql`
  query RestaurantsPaginated($page: Int, $limit: Int, $search: String) {
    restaurantsPaginated(page: $page, limit: $limit, search: $search) {
      totalCount
      currentPage
      totalPages
      data {
        _id
        name
        address
        phone
        image
        logo
        isActive
        isAvailable
        shopType
        rating
        totalOrders
        wallet
        owner {
          _id
          name
          email
          phone
        }
        location {
          coordinates
        }
      }
    }
  }
`;

export const RESTAURANT_BY_ID = gql`
  query RestaurantById($id: String) {
    restaurant(id: $id) {
      _id
      name
      address
      phone
      image
      logo
      isActive
      isAvailable
      shopType
      rating
      totalOrders
      wallet
      owner {
        _id
        name
        email
        phone
      }
      location {
        coordinates
      }
    }
  }
`;

export const TOGGLE_RESTAURANT = gql`
  mutation ToggleRestaurant($id: String!) {
    deleteRestaurant(id: $id) {
      _id
      isActive
    }
  }
`;

export const EARNINGS = gql`
  query Earnings($pageSize: Int, $pageNo: Int) {
    earnings(pagination: { pageSize: $pageSize, pageNo: $pageNo }) {
      success
      message
      data {
        earnings {
          _id
          orderId
          orderType
          paymentMethod
          createdAt
          platformEarnings {
            totalEarnings
          }
          riderEarnings {
            totalEarnings
          }
          storeEarnings {
            totalEarnings
          }
        }
        grandTotalEarnings {
          platformTotal
          riderTotal
          storeTotal
        }
      }
      pagination {
        total
      }
    }
  }
`;

export const TRANSACTION_HISTORY = gql`
  query TransactionHistory($pageSize: Int, $pageNo: Int) {
    transactionHistory(pagination: { pageSize: $pageSize, pageNo: $pageNo }) {
      data {
        _id
        amountCurrency
        status
        transactionId
        userType
        amountTransferred
        createdAt
        toBank {
          accountName
          bankName
          accountNumber
        }
      }
      pagination {
        total
      }
    }
  }
`;

export const WITHDRAW_REQUESTS = gql`
  query WithdrawRequests($pageSize: Int, $pageNo: Int) {
    withdrawRequests(pagination: { pageSize: $pageSize, pageNo: $pageNo }) {
      success
      message
      data {
        _id
        requestId
        requestAmount
        requestTime
        status
        rider {
          _id
          name
          phone
        }
        store {
          _id
          name
        }
      }
      pagination {
        total
      }
    }
  }
`;

export const UPDATE_WITHDRAW_STATUS = gql`
  mutation UpdateWithdrawStatus($id: ID!, $status: String!) {
    updateWithdrawReqStatus(id: $id, status: $status) {
      success
      message
      data {
        _id
        status
      }
    }
  }
`;

export const USERS = gql`
  query Users {
    users {
      _id
      name
      email
      phone
      role
      userType
      isActive
      createdAt
    }
  }
`;

export const TICKET_USERS = gql`
  query TicketUsers($page: Int, $limit: Int) {
    getTicketUsers(input: { page: $page, limit: $limit }) {
      users {
        _id
        name
        email
        phone
        isActive
        userType
        latestTicket {
          _id
          title
          status
          createdAt
        }
      }
      docsCount
      totalPages
      currentPage
    }
  }
`;

export const USER_TICKETS = gql`
  query UserTickets($userId: ID!, $page: Int, $limit: Int) {
    getSingleUserSupportTickets(
      input: { userId: $userId, filters: { page: $page, limit: $limit } }
    ) {
      tickets {
        _id
        title
        description
        status
        category
        createdAt
      }
      docsCount
      totalPages
      currentPage
    }
  }
`;

export const SEND_NOTIFICATION_USER = gql`
  mutation SendNotificationUser($title: String, $body: String!) {
    sendNotificationUser(notificationTitle: $title, notificationBody: $body)
  }
`;

export const UPLOAD_TOKEN = gql`
  mutation UploadToken($id: String!, $pushToken: String!) {
    uploadToken(id: $id, pushToken: $pushToken) {
      _id
      pushToken
    }
  }
`;
