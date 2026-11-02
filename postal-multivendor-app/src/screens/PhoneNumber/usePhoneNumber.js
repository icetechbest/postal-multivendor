import { useState, useContext } from 'react'
import { useMutation } from '@apollo/client'
import gql from 'graphql-tag'
import { updateUser, sendOtpToPhoneNumber } from '../../apollo/mutations'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import { theme } from '../../utils/themeColors'
import { FlashMessage } from '../../ui/FlashMessage/FlashMessage'
import { phoneRegex } from '../../utils/regex'
import { useNavigation, useRoute } from '@react-navigation/native'
import UserContext from '../../context/User'
import { useTranslation } from 'react-i18next'
import { useCountryFromIP } from '../../utils/useCountryFromIP'

const UPDATEUSER = gql`
  ${updateUser}
`
const SEND_OTP_TO_PHONE = gql`
  ${sendOtpToPhoneNumber}
`

/**
 * Phone number screen.
 *
 * Two modes:
 *  - `mode === 'auth'`: the phone number is the only way to sign in or create
 *    an account. We send an OTP and continue to the OTP screen, which calls
 *    the `loginWithPhone` mutation.
 *  - default (profile mode): the signed-in customer is attaching/updating the
 *    phone number on their existing account.
 */
const usePhoneNumber = () => {
  const { t, i18n } = useTranslation()
  const navigation = useNavigation()
  const route = useRoute()
  const mode = route?.params?.mode
  const isAuthMode = mode === 'auth'
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState(null)
  const { name, screen, prevScreen } = route?.params || {}

  const {
    country,
    setCountry,
    currentCountry: countryCode,
    setCurrentCountry: setCountryCode,
    isLoading: isCountryLoading
  } = useCountryFromIP()

  const onCountrySelect = (country) => {
    setCountryCode(country.cca2)
    setCountry(country)
  }

  const { profile } = useContext(UserContext)
  const themeContext = useContext(ThemeContext)
  const currentTheme = { isRTL: i18n.dir() === 'rtl', ...theme[themeContext.ThemeValue] }

  const fullPhone = () => '+'.concat(country?.callingCode?.[0] ?? '').concat(phone ?? '')

  function validateCredentials() {
    let result = true
    setPhoneError(null)

    if (!phone) {
      setPhoneError(t('mobileErr1'))
      result = false
    } else if (!phoneRegex.test(phone)) {
      setPhoneError(t('mobileErr2'))
      result = false
    }
    return result
  }

  function onError(error) {
    if (error.networkError) {
      FlashMessage({ message: error.networkError.result.errors[0].message })
    } else if (error.graphQLErrors) {
      FlashMessage({ message: error.graphQLErrors[0].message })
    } else {
      FlashMessage({ message: t('somethingWentWrong') })
    }
  }

  // ---- Profile mode: attach the phone number to the current account ----
  function onUpdateCompleted() {
    if (navigation && route && profile) {
      navigation.navigate({
        name: 'PhoneOtp',
        merge: true,
        params: { name, phone: fullPhone(), screen }
      })
    }
  }

  const [mutate, { loading: updateLoading }] = useMutation(UPDATEUSER, {
    onCompleted: onUpdateCompleted,
    onError
  })

  // ---- Auth mode: send the OTP that will be verified by `loginWithPhone` ----
  const [sendOtp, { loading: otpLoading }] = useMutation(SEND_OTP_TO_PHONE, {
    onCompleted: () => {
      navigation.navigate({
        name: 'PhoneOtp',
        merge: true,
        params: { phone: fullPhone(), mode: 'auth', name, prevScreen }
      })
    },
    onError
  })

  function registerAction() {
    if (!validateCredentials()) return
    if (isAuthMode) {
      sendOtp({ variables: { phone: fullPhone() } })
      return
    }
    mutate({
      variables: {
        name: profile?.name,
        phone: fullPhone(),
        phoneIsVerified: false
      }
    })
  }

  return {
    phone,
    setPhone,
    phoneError,
    country,
    countryCode,
    onCountrySelect,
    themeContext,
    currentTheme,
    loading: isAuthMode ? otpLoading : updateLoading,
    registerAction,
    setPhoneError,
    isCountryLoading,
    isAuthMode
  }
}

export default usePhoneNumber
