import { gql } from '@apollo/client';

const RIDER_WALLET_FIELDS = `
  riderId
  name
  username
  phone
  available
  isActive
  zone
  vehicleType
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
  totalCashCollected
  lastDeliveryAt
`;

export const GET_RIDER_WALLET_SETTINGS = gql`
  query RiderWalletSettings {
    riderWalletSettings {
      commissionRate
      commissionBase
      debtLimit
      cashLimit
    }
  }
`;

export const GET_RIDER_WALLETS = gql`
  query RiderWallets($search: String, $onlyDebt: Boolean, $page: Int, $limit: Int) {
    riderWallets(search: $search, onlyDebt: $onlyDebt, page: $page, limit: $limit) {
      riders {
        ${RIDER_WALLET_FIELDS}
      }
      total
      page
      totalPages
      totalDebt
      totalBalance
    }
  }
`;

export const GET_RIDER_WALLET = gql`
  query RiderWallet($riderId: ID, $page: Int, $limit: Int, $type: String) {
    riderWallet(riderId: $riderId, page: $page, limit: $limit, type: $type) {
      wallet {
        ${RIDER_WALLET_FIELDS}
      }
      transactions {
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
          createdBy
        }
        total
        page
        totalPages
      }
    }
  }
`;

export const GET_RIDER_ORDER_HISTORY = gql`
  query RiderOrderHistory(
    $riderId: ID
    $page: Int
    $limit: Int
    $startDate: String
    $endDate: String
  ) {
    riderOrderHistory(
      riderId: $riderId
      page: $page
      limit: $limit
      startDate: $startDate
      endDate: $endDate
    ) {
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
      total
      page
      totalPages
      totalEarnings
      totalCommission
    }
  }
`;
