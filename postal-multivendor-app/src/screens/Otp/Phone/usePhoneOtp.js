import { useState, useContext, useEffect } from 'react'
import { sendOtpToPhoneNumber, updateUser, VERIFY_OTP, loginWithPhone } from '../../../apollo/mutations'
import gql from 'graphql-tag'
import { useMutation } from '@apollo/client'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import ThemeContext from '../../../ui/ThemeContext/ThemeContext'
import { theme } from '../../../utils/themeColors'
import { FlashMessage } from '../../../ui/FlashMessage/FlashMessage'
import UserContext from '../../../context/User'
import AuthContext from '../../../context/Auth'
import { useNavigation, useRoute } from '@react-navigation/native'

import useEnvVars from '../../../../environment'

import { useTranslation } from 'react-i18next'
import ConfigurationContext from '../../../context/Configuration'

const SEND_OTP_TO_PHONE = gql`
  ${sendOtpToPhoneNumber}
`
const UPDATEUSER = gql`
  ${updateUser}
`
const LOGIN_WITH_PHONE = gql`
  ${loginWithPhone}
`

const usePhoneOtp = () => {
  const { TEST_OTP } = useEnvVars()
  const { t } = useTranslation()
  const navigation = useNavigation()
  const configuration = useContext(ConfigurationContext)
  const route = useRoute()
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState(false)
  const { profile, loadingProfile } = useContext(UserContext)
  const { setTokenAsync } = useContext(AuthContext)
  const themeContext = useContext(ThemeContext)
  const currentTheme = theme[themeContext.ThemeValue]
  const [seconds, setSeconds] = useState(30)
  const { name, phone, screen, mode, prevScreen } = route?.params || {}
  const isAuthMode = mode === 'auth'

  function onError(error) {
    if (error.networkError) {
      FlashMessage({
        message: error.networkError.result.errors[0].message
      })
    } else if (error.graphQLErrors) {
      FlashMessage({
        message: error.graphQLErrors[0].message
      })
    }
  }

  function onCompleted(data) {
    FlashMessage({
      message: t('otpSentToPhone')
    })
  }

  function onUpdateUserError(error) {
    if (error.networkError) {
      FlashMessage({
        message: error.networkError.result.errors[0].message
      })
    } else if (error.graphQLErrors) {
      FlashMessage({
        message: error.graphQLErrors[0].message
      })
    }
  }

  function onUpdateUserCompleted(data) {
    FlashMessage({
      message: t('numberVerified')
    })
    if (!profile?.name) {
      navigation.navigate('Profile', { editName: true })
    } else if (screen === 'Checkout') {
      navigation.navigate('Checkout')
    } else {
      prevScreen
        ? navigation.navigate(prevScreen)
        : navigation.navigate({
            name: 'Main',
            merge: true
          })
    }
  }

  // Phone-only sign-in / sign-up. The backend creates the account the first
  // time this phone number completes the OTP challenge.
  async function onPhoneLoginCompleted(data) {
    if (data?.loginWithPhone?.isActive === false) {
      FlashMessage({ message: t('accountDeactivated') })
      return
    }
    try {
      await setTokenAsync(data.loginWithPhone.token)
      if (!data.loginWithPhone.name || data.loginWithPhone.name === 'Customer') {
        navigation.navigate('Profile', { editName: true })
      } else {
        navigation.navigate({
          name: 'Main',
          merge: true
        })
      }
    } catch (error) {
      FlashMessage({ message: t('errorInLoginError') })
    }
  }

  const [sendOTPToPhone, { loading }] = useMutation(SEND_OTP_TO_PHONE, {
    onCompleted,
    onError
  })

  const [verifyOTP] = useMutation(VERIFY_OTP, {
    onError
  })

  const [mutateUser, { loading: updateUserLoading }] = useMutation(UPDATEUSER, {
    onCompleted: onUpdateUserCompleted,
    onError: onUpdateUserError
  })

  const [phoneLogin, { loading: phoneLoginLoading }] = useMutation(LOGIN_WITH_PHONE, {
    onCompleted: onPhoneLoginCompleted,
    onError
  })

  async function notificationToken() {
    try {
      if (!Device.isDevice) return null
      const { status } = await Notifications.getPermissionsAsync()
      if (status !== 'granted') return null
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId
      })
      return token.data
    } catch (error) {
      return null
    }
  }

  const onCodeFilled = async (otp_code) => {
    if (isAuthMode) {
      const token = await notificationToken()
      phoneLogin({
        variables: {
          phone: phone ?? profile?.phone,
          otp: otp_code,
          name: name ?? profile?.name,
          notificationToken: token
        }
      })
      return
    }

    if (configuration?.skipMobileVerification) {
      mutateUser({
        variables: {
          name: name ?? profile?.name,
          phone: phone ?? profile?.phone,
          phoneIsVerified: true
        }
      })
    }

    const { data } = await verifyOTP({
      variables: {
        otp: otp_code,
        phone: phone ?? profile?.phone
      }
    })

    if (data?.verifyOtp) {
      mutateUser({
        variables: {
          name: name ?? profile?.name,
          phone: phone ?? profile?.phone,
          phoneIsVerified: true
        }
      })
    } else {
      setOtpError(true)
    }
  }

  const onSendOTPHandler = () => {
    try {
      if (!profile?.phone && !phone) {
        FlashMessage({
          message: t('mobileErr1')
        })
        return
      }

      sendOTPToPhone({ variables: { phone: profile?.phone ?? phone } })
    } catch (err) {
      FlashMessage({
        message: t('somethingWentWrong')
      })
    }
  }

  const resendOtp = () => {
    onSendOTPHandler()
    setSeconds(30)
  }

  useEffect(() => {
    const myInterval = setInterval(() => {
      if (seconds > 0) {
        setSeconds(seconds - 1)
      }
      if (seconds === 0) {
        clearInterval(myInterval)
      }
    }, 1000)
    return () => {
      clearInterval(myInterval)
    }
  })

  useEffect(() => {
    if (!configuration) return
    if (isAuthMode) return
    if (!configuration.skipMobileVerification) {
      onSendOTPHandler()
    }
  }, [configuration, phone])

  useEffect(() => {
    let timer = null
    if (!configuration || !profile) return
    if (isAuthMode) return
    if (configuration.skipMobileVerification) {
      setOtp(TEST_OTP)
      timer = setTimeout(() => {
        onCodeFilled(TEST_OTP)
      }, 3000)
    }

    return () => {
      timer && clearTimeout(timer)
    }
  }, [configuration, profile])

  return {
    otp,
    setOtp,
    otpError,
    seconds,
    profile,
    loading,
    updateUserLoading: updateUserLoading || phoneLoginLoading,
    onCodeFilled,
    resendOtp,
    currentTheme,
    themeContext,
    loadingProfile
  }
}

export default usePhoneOtp
