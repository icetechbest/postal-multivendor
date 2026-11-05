
import React from 'react'
import { View } from 'react-native'
import { scale } from '../../../utils/scaling'
import { useSubscription } from '@apollo/client'
import { subscriptionOrder } from '../../../apollo/subscriptions'
import gql from 'graphql-tag'
import { ORDER_STATUS_ENUM } from '../../../utils/enums'

export const orderStatuses = [
  {
    key: 'AWAITING_ADMIN',
    status: 0,
    statusText: 'awaitingAdminOrder'
  },
  {
    key: 'PENDING',
    status: 1,
    statusText: 'pendingOrder'
  },
  {
    key: 'ACCEPTED',
    status: 2,
    statusText: 'acceptedOrder'
  },
  {
    key: 'ASSIGNED',
    status: 3,
    statusText: 'assignedOrder'
  },
  {
    key: 'PICKED',
    status: 4,
    statusText: 'pickedOrder'
  },
  {
    key: 'DELIVERED',
    status: 5,
    statusText: 'deliveredOrder'
  },
  {
    key: 'COMPLETED',
    status: 6,
    statusText: 'completedOrder'
  },
  {
    key: 'CANCELLED',
    status: 6,
    statusText: 'cancelledOrder'
  },
  {
    key:'CANCELLEDBYREST',
    status:7,
    statusText:'cancelledOrder'
  }
]

export const checkStatus = status => {
  const obj = orderStatuses.filter(x => {
    return x.key === status
  })
  return obj[0]
}

// For a pickup order (isPickedUp) there is no rider: the restaurant marking the order
// as PICKED (or later) means the customer already received it.
export const isPickupReceived = (order) =>
  !!order?.isPickedUp &&
  [ORDER_STATUS_ENUM.PICKED, ORDER_STATUS_ENUM.DELIVERED, ORDER_STATUS_ENUM.COMPLETED].includes(order?.orderStatus)

// Translation key for the status sentence, aware of pickup orders.
export const getOrderStatusText = (order) => {
  if (order?.isPickedUp) {
    if (isPickupReceived(order)) return 'pickupReceivedOrder'
    if ([ORDER_STATUS_ENUM.ACCEPTED, ORDER_STATUS_ENUM.ASSIGNED].includes(order?.orderStatus)) {
      return 'pickupPreparingOrder'
    }
  }
  return checkStatus(order?.orderStatus)?.statusText
}

export const ProgressBar = ({ currentTheme, item, customWidth, isPicked }) => {
  if (item.orderStatus === ORDER_STATUS_ENUM.CANCELLED) return null
  useSubscription(
    gql`
      ${subscriptionOrder}
    `,
    { variables: { id: item._id } }
  )

  const defaultWidth = scale(50)
  const width = customWidth !== undefined ? customWidth : defaultWidth

  // Filter statuses if isPicked is true
  // Pickup orders: ASSIGNED counts as ACCEPTED, and PICKED (received) fills every bar.
  let currentStatus
  if (isPicked) {
    if (isPickupReceived(item)) currentStatus = { status: 3 }
    else if (item.orderStatus === 'ASSIGNED') currentStatus = { status: 2 }
    else currentStatus = orderStatuses.find((x) => x.key === item.orderStatus) || { status: 0 }
  } else {
    currentStatus = orderStatuses.find((x) => x.key === item.orderStatus) || { status: 0 }
  }

  // Set the total number of filled bars based on the isPicked prop
  const totalBars = isPicked ? 3 : 4;

  return (
    <View style={{ marginTop: scale(10) }}>
      <View style={{ flexDirection: currentTheme?.isRTL ? 'row-reverse' : 'row' }}>
        {Array(Math.min(currentStatus.status, totalBars)) // Active bars
          .fill(0)
          .map((_, index) => (
            <View
              key={index}
              style={{
                height: scale(4),
                backgroundColor: currentTheme.primary,
                width: width,
                marginRight: scale(10)
              }}
            />
          ))}
        {Array(totalBars - Math.min(currentStatus.status, totalBars)) // Inactive bars
          .fill(0)
          .map((_, index) => (
            <View
              key={index}
              style={{
                height: scale(4),
                backgroundColor: currentTheme.gray200,
                width: width,
                marginRight: scale(10)
              }}
            />
          ))}
      </View>
    </View>
  )
}
