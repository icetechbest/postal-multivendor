import { gql } from "@apollo/client";

export const RIDER_WALLET = gql`
  query RiderWallet($page: Int, $limit: Int, $type: String) {
    riderWallet(page: $page, limit: $limit, type: $type) {
      wallet {
        riderId
        commissionRate
        currentBalance
        totalEarnings
        withdrawn
        debt
        cashInHand
        debtLimit
        cashLimit
        blocked
        blockedReason
        totalCommission
        totalPaid
        netBalance
        deliveredOrders
      }
      transactions {
        total
        page
        totalPages
        transactions {
          _id
          type
          amount
          direction
          balance
          walletAfter
          debtAfter
          note
          order
          orderId
          createdAt
        }
      }
    }
  }
`;

export const RIDER_ORDER_HISTORY = gql`
  query RiderOrderHistory(
    $page: Int
    $limit: Int
    $startDate: String
    $endDate: String
  ) {
    riderOrderHistory(
      page: $page
      limit: $limit
      startDate: $startDate
      endDate: $endDate
    ) {
      total
      page
      totalPages
      totalEarnings
      totalCommission
      orders {
        _id
        orderId
        orderStatus
        paymentMethod
        restaurantName
        customerName
        orderAmount
        total
        deliveryCharges
        tipping
        earning
        commission
        net
        changeAmount
        deliveredAt
        createdAt
      }
    }
  }
`;
