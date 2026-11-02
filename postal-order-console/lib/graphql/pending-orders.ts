import { gql } from '@apollo/client';

const ORDER_FIELDS = gql`
  fragment PendingOrderFields on Order {
    _id
    orderId
    createdAt
    orderStatus
    total
    orderAmount
    deliveryCharges
    tipping
    taxationAmount
    discount
    paymentMethod
    paymentStatus
    instructions
    adminConfirmedAt
    adminRejectedAt
    user {
      _id
      name
      phone
      email
    }
    restaurant {
      _id
      name
      address
    }
    deliveryAddress {
      deliveryAddress
      details
      label
      location {
        coordinates
      }
    }
    items {
      _id
      title
      description
      image
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
        description
        options {
          _id
          title
          price
        }
      }
    }
  }
`;

export const PENDING_ORDERS_QUERY = gql`
  query PendingConfirmationOrders($page: Int, $limit: Int, $search: String) {
    pendingConfirmationCount
    pendingConfirmationOrders(page: $page, limit: $limit, search: $search) {
      totalCount
      totalPages
      currentPage
      nextPage
      prevPage
      orders {
        ...PendingOrderFields
      }
    }
  }
  ${ORDER_FIELDS}
`;

export const TODAY_STATS_QUERY = gql`
  query TodayConfirmationStats {
    allOrdersWithoutPagination(dateKeyword: "today") {
      _id
      orderStatus
      adminConfirmedAt
      adminRejectedAt
      createdAt
    }
  }
`;

export const CONFIRM_ORDER_MUTATION = gql`
  mutation AdminConfirmOrder($id: String!, $note: String) {
    adminConfirmOrder(id: $id, note: $note) {
      _id
      orderStatus
      adminConfirmedAt
    }
  }
`;

export const REJECT_ORDER_MUTATION = gql`
  mutation AdminRejectOrder($id: String!, $reason: String!) {
    adminRejectOrder(id: $id, reason: $reason) {
      _id
      orderStatus
      adminRejectedAt
    }
  }
`;

export const PENDING_ORDER_SUBSCRIPTION = gql`
  subscription PendingOrderCreated {
    subscriptionPendingOrders {
      ...PendingOrderFields
    }
  }
  ${ORDER_FIELDS}
`;
