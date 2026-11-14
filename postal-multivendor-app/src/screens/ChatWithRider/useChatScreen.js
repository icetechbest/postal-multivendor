import React, { useRef, useState, useEffect, useContext, useLayoutEffect, useMemo, useCallback } from 'react'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import { theme } from '../../utils/themeColors'
import { Ionicons, FontAwesome5, Entypo } from '@expo/vector-icons'
import { callNumber } from '../../utils/callNumber'
import gql from 'graphql-tag'
import { chat, order as orderQuery } from '../../apollo/queries'
import { subscriptionNewMessage } from '../../apollo/subscriptions'
import { sendChatMessage } from '../../apollo/mutations'
import { useMutation, useQuery } from '@apollo/client'
import { Alert, Platform, StatusBar, View } from 'react-native'
import { useUserContext } from '../../context/User'
import { useTranslation } from 'react-i18next'
import { alignment } from '../../utils/alignment'
import { useFocusEffect } from '@react-navigation/native'

export const useChatScreen = ({ navigation, route }) => {
  const { id: orderId, orderNo: paramOrderNo, total: paramTotal, riderPhone: paramRiderPhone } = route.params || {}

  const { t } = useTranslation()
  const { profile } = useUserContext()
  const {
    subscribeToMore: subscribeToMessages,
    updateQuery: updateChatQuery,
    data: chatData,
    loading: chatLoading,
    error: chatError,
    refetch: refetchChat
  } = useQuery(
    gql`
      ${chat}
    `,
    {
      variables: { order: orderId },
      fetchPolicy: 'cache-and-network',
      skip: !orderId
    }
  )

  // Opened from a push notification: only the order id is known, so load the rest.
  const needsOrder = !!orderId && (paramOrderNo == null || paramTotal == null || !paramRiderPhone)
  const { data: orderData } = useQuery(
    gql`
      ${orderQuery}
    `,
    { variables: { id: orderId }, skip: !needsOrder, fetchPolicy: 'cache-first' }
  )
  const orderNo = paramOrderNo ?? orderData?.order?.orderId
  const total = paramTotal ?? orderData?.order?.orderAmount
  const riderPhone = paramRiderPhone || orderData?.order?.rider?.phone

  // Adds a message to the cached conversation unless it is already there
  // (the sender receives its own message both from the mutation and the subscription).
  const appendMessage = useCallback(
    (message) => {
      if (!message?.id) return
      updateChatQuery((prev) => {
        const existing = prev?.chat || []
        if (existing.some((item) => item.id === message.id)) return prev
        return { ...prev, chat: [message, ...existing] }
      })
    },
    [updateChatQuery]
  )

  const [send] = useMutation(
    gql`
      ${sendChatMessage}
    `
  )
  // Messages the user just sent that the server has not confirmed yet. They are shown
  // immediately so a slow connection never makes the chat feel stuck.
  const [pending, setPending] = useState([])

  // GiftedChat renders newest-first, the API returns oldest-first: sort once here.
  const messages = useMemo(() => {
    const confirmed = [...(chatData?.chat || [])]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((message) => ({
        _id: message.id,
        text: message.message,
        createdAt: message.createdAt,
        user: {
          _id: String(message.user?.id ?? ''),
          name: message.user?.name
        }
      }))
    const mine = pending.map((p) => ({
      _id: p.tmpId,
      text: p.text,
      createdAt: p.createdAt,
      pending: true,
      user: { _id: String(profile?._id ?? ''), name: profile?.name }
    }))
    return [...mine.reverse(), ...confirmed]
  }, [chatData, pending, profile])

  const [inputMessage, setInputMessage] = useState('')
  const [image, setImage] = useState([])
  const themeContext = useContext(ThemeContext)
  const currentTheme = theme[themeContext.ThemeValue]
  useFocusEffect(() => {
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor(currentTheme.themeBackground)
    }
    StatusBar.setBarStyle(
      themeContext.ThemeValue === 'Dark' ? 'light-content' : 'dark-content'
    )
  })
  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: {
        backgroundColor: currentTheme.headerMenuBackground
      },
      headerTitleStyle: {
        fontSize: 14,
        // fontWeight: '700',
        color: currentTheme.fontFourthColor
      },
      headerLeft: () => (
        <View
          style={{
            borderRadius: 30,
            borderWidth: 1,
            borderColor: currentTheme.fontFourthColor,
            ...alignment.MLmedium
          }}>
          <Entypo
            name="cross"
            size={20}
            color={currentTheme.fontFourthColor}
            onPress={() => navigation.goBack()}
          />
        </View>
      ),
      headerRight: () => (
        <View
          style={{
            ...alignment.MRmedium
          }}>
          <Ionicons
            name="call-outline"
            size={24}
            color={currentTheme.fontFourthColor}
            onPress={() => callNumber(riderPhone)}
          />
        </View>
      ),
      headerTitle: t('contactYourRider')
    })
  }, [navigation])
  useEffect(() => {
    const unsubscribe = subscribeToMessages({
      document: gql`
        ${subscriptionNewMessage}
      `,
      variables: { order: orderId },
      updateQuery: (prev, { subscriptionData }) => {
        const incoming = subscriptionData?.data?.subscriptionNewMessage
        if (!incoming) return prev
        const existing = prev?.chat || []
        if (existing.some((item) => item.id === incoming.id)) return prev
        return { ...prev, chat: [incoming, ...existing] }
      }
    })
    return unsubscribe
  }, [orderId])
  const onSend = async () => {
    const text = inputMessage?.trim()
    if (!text || !profile?._id) return
    const tmpId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setPending((list) => [...list, { tmpId, text, createdAt: new Date().toISOString() }])
    setInputMessage('')
    setImage([])

    const removePending = () => setPending((list) => list.filter((p) => p.tmpId !== tmpId))
    try {
      const { data } = await send({
        variables: {
          orderId,
          messageInput: {
            message: text,
            user: { id: String(profile._id), name: profile.name }
          }
        }
      })
      const result = data?.sendChatMessage
      if (!result?.success) throw new Error(result?.message || t('wl_chat_send_failed'))
      appendMessage(result.data)
      removePending()
    } catch (error) {
      removePending()
      // Give the text back so the user can resend it.
      setInputMessage((current) => current || text)
      Alert.alert(t('error'), error?.message || t('wl_chat_send_failed'))
    }
  }

  return {
    messages,
    onSend,
    currentTheme,
    image,
    setImage,
    inputMessage,
    setInputMessage,
    profile,
    orderNo,
    total,
    chatLoading,
    chatError,
    refetchChat
  }
}
