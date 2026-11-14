import { gql } from '@apollo/client';

const WALLET_RESULT = `
  riderId
  name
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

export const SETTLE_RIDER_DEBT = gql`
  mutation SettleRiderDebt($riderId: ID!, $amount: Float!, $method: String!, $note: String) {
    settleRiderDebt(riderId: $riderId, amount: $amount, method: $method, note: $note) {
      ${WALLET_RESULT}
    }
  }
`;

export const ADJUST_RIDER_WALLET = gql`
  mutation AdjustRiderWallet($riderId: ID!, $amount: Float!, $target: String!, $note: String!) {
    adjustRiderWallet(riderId: $riderId, amount: $amount, target: $target, note: $note) {
      ${WALLET_RESULT}
    }
  }
`;

export const COLLECT_RIDER_CASH = gql`
  mutation CollectRiderCash($riderId: ID!, $amount: Float!, $note: String) {
    collectRiderCash(riderId: $riderId, amount: $amount, note: $note) {
      ${WALLET_RESULT}
    }
  }
`;

export const SET_RIDER_COMMISSION_RATE = gql`
  mutation SetRiderCommissionRate($rate: Float!) {
    setRiderCommissionRate(rate: $rate)
  }
`;

export const SET_RIDER_LIMITS = gql`
  mutation SetRiderLimits($debtLimit: Float!, $cashLimit: Float!) {
    setRiderLimits(debtLimit: $debtLimit, cashLimit: $cashLimit) {
      commissionRate
      commissionBase
      debtLimit
      cashLimit
    }
  }
`;

export const SETTLE_PAST_DELIVERED_ORDERS = gql`
  mutation SettlePastDeliveredOrders {
    settlePastDeliveredOrders
  }
`;
