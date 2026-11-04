import React, { useState, useEffect, useContext, useLayoutEffect, useMemo, useCallback } from 'react'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import { theme } from '../../utils/themeColors'
import { Ionicons, FontAwesome5, Entypo } from '@expo/vector-icons'
import { callNumber } from '../../utils/callNumber'
import gql from 'graphql-tag'
import { chat } from '../../apollo/queries'
import { subscriptionNewMessage } from '../../apollo/subscriptions'
import { sendChatMessage } from '../../apollo/mutations'
import { useMutation, useQuery } from '@apollo/client'
import { Alert, Platform, StatusBar, View } from 'react-native'
import { useUserContext } from '../../context/User'
import { useTranslation } from 'react-i18next'
import { alignment } from '../../utils/alignment'
import { useFocusEffect } from '@react-navigation/native'

export const useChatScreen = ({ navigation, route }) => {
  const { id: orderId, orderNo, total, riderPhone } = route.params

  const { t } = useTranslation()
  const { profile } = useUserContext()
  const {
    subscribeToMore: subscribeToMessages,
    updateQuery: updateChatQuery,
    data: chatData
  } = useQuery(
    gql`
      ${chat}
    `,
    {
      variables: { order: orderId },
      fetchPolicy: 'network-only',
      onError
    }
  )

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
    `,
    {
      onCompleted,
      onError
    }
  )

  // GiftedChat renders newest-first, the API returns oldest-first: sort once here.
  const messages = useMemo(
    () =>
      [...(chatData?.chat || [])]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map((message) => ({
          _id: message.id,
          text: message.message,
          createdAt: message.createdAt,
          user: {
            _id: message.user?.id,
            name: message.user?.name
          }
        })),
    [chatData]
  )

  function onCompleted({ sendChatMessage: messageResult }) {
    if (!messageResult?.success) {
      Alert.alert('Error', messageResult?.message)
      return
    }
    appendMessage(messageResult.data)
  }
  function onError(error) {
    Alert.alert('Error', error.message)
  }
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
  const onSend = () => {
    const text = inputMessage?.trim()
    if (!text) return

    send({
      variables: {
        orderId: orderId,
        messageInput: {
          message: text,
          user: {
            id: profile._id,
            name: profile.name
          }
        }
      }
    })
    setInputMessage('')
    setImage([])
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
    total
  }
}
