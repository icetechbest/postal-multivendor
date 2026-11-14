import { gql } from '@apollo/client';

export const GET_ADMIN_CHATS = gql`
  query AdminChats($search: String, $page: Int, $limit: Int) {
    adminChats(search: $search, page: $page, limit: $limit) {
      chats {
        orderId
        orderNumber
        orderStatus
        restaurantName
        customerName
        customerPhone
        riderName
        riderPhone
        messageCount
        lastMessage
        lastSender
        lastMessageAt
      }
      total
      page
      totalPages
    }
  }
`;

export const GET_ORDER_CHAT = gql`
  query OrderChat($order: ID!) {
    chat(order: $order) {
      id
      message
      createdAt
      user {
        id
        name
      }
    }
  }
`;

export const SUBSCRIBE_NEW_CHAT_MESSAGE = gql`
  subscription SubscriptionNewMessage($order: ID!) {
    subscriptionNewMessage(order: $order) {
      id
      message
      createdAt
      user {
        id
        name
      }
    }
  }
`;
