import { gql } from "@apollo/client";

export const ADD_CHANGE_TO_CUSTOMER_WALLET = gql`
  mutation AddChangeToCustomerWallet($orderId: ID!, $receivedAmount: Float!) {
    addChangeToCustomerWallet(
      orderId: $orderId
      receivedAmount: $receivedAmount
    ) {
      success
      message
      changeAmount
      customerWalletBalance
      riderDebt
    }
  }
`;
