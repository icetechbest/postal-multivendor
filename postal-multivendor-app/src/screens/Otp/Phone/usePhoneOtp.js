import { useState, useContext, useEffect, useCallback } from 'react'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import gql from 'graphql-tag'
import { useMutation } from '@apollo/client'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { loginWithPhone, sendOtpToPhoneNumber } from '../../../apollo/mutations'
import ThemeContext from '../../../ui/ThemeContext/ThemeContext'
import { theme } from '../../../utils/themeColors'
import { FlashMessage } from '../../../ui/FlashMessage/FlashMessage'
import AuthContext from '../../../context/Auth'
import analytics from '../../../utils/analytics'
import { getApolloErrorMessage } from '../../../utils/phone'

const LOGIN_WITH_PHONE = gql`
  ${loginWithPhone}
`
const SEND_OTP_TO_PHONE = gql`
  ${sendOtpToPhoneNumber}
`

const RESEND_SECONDS = 30

const getNotificationToken = async () => {
  try {
    if (!Device.isDevice) return null
    const { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted') return null
    return (await Notifications.getExpoPushTokenAsync({ projectId: Constants.expoConfig.extra.eas.projectId })).data
  } catch (error) {
    return null
  }
}

/**
 * Second step of phone-number-only authentication: verify the code that was
 * texted to the user. The backend creates the account on first sign-in.
 */
const usePhoneOtp = () => {
  const { t } = useTranslation()
  const Analytics = analytics()
  const navigation = useNavigation()
  const route = useRoute()
  const { phone } = route?.params || {}
  const { setTokenAsync } = useContext(AuthContext)
  const themeContext = useContext(ThemeContext)
  const currentTheme = theme[themeContext.ThemeValue]

  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState(false)
  const [seconds, setSeconds] = useState(RESEND_SECONDS)

  const [sendOtp, { loading: resendLoading }] = useMutation(SEND_OTP_TO_PHONE)
  const [login, { loading: loginLoading }] = useMutation(LOGIN_WITH_PHONE)

  // Resend countdown.
  useEffect(() => {
    if (seconds <= 0) return undefined
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [seconds])

  const onCodeFilled = useCallback(
    async (code) => {
      if (loginLoading || !phone) return
      setOtpError(false)
      try {
        const notificationToken = await getNotificationToken()
        const { data } = await login({ variables: { phone, otp: code, notificationToken } })
        const result = data?.loginWithPhone
        if (!result?.token) throw new Error(t('somethingWentWrong'))

        if (result.isActive === false) {
          FlashMessage({ message: t('accountDeactivated') })
          return
        }

        try {
          await Analytics.identify({ userId: result.userId }, result.userId)
          await Analytics.track(Analytics.events.USER_LOGGED_IN, { userId: result.userId, name: result.name, phone: result.phone })
        } catch (analyticsError) {
          // Analytics must never block signing in.
        }

        await setTokenAsync(result.token)
        navigation.navigate({ name: 'Main', merge: true })

        // New customers get a default name; invite them to set a real one.
        if (result.isNewUser) {
          navigation.navigate('EditName', { name: '', phone: result.phone })
        }
      } catch (error) {
        const message = getApolloErrorMessage(error, error?.message)
        // Wrong / expired code: keep the user on this screen so they can retry or resend.
        if (/invalid|expired|too many/i.test(message || '')) {
          setOtpError(true)
          setOtp('')
        }
        FlashMessage({ message: message || t('somethingWentWrong') })
      }
    },
    [login, loginLoading, phone, navigation, setTokenAsync, t, Analytics]
  )

  const resendOtp = async () => {
    if (!phone || seconds > 0 || resendLoading) return
    try {
      await sendOtp({ variables: { phone } })
      setOtp('')
      setOtpError(false)
      setSeconds(RESEND_SECONDS)
      FlashMessage({ message: t('otpSentToPhone') })
    } catch (error) {
      FlashMessage({ message: getApolloErrorMessage(error, t('somethingWentWrong')) })
    }
  }

  return {
    phone,
    otp,
    setOtp,
    otpError,
    seconds,
    loading: resendLoading,
    loginLoading,
    onCodeFilled,
    resendOtp,
    currentTheme,
    themeContext
  }
}

export default usePhoneOtp
