import { useContext, useState } from 'react'
import { Keyboard } from 'react-native'
import { useMutation } from '@apollo/client'
import gql from 'graphql-tag'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { sendOtpToPhoneNumber } from '../../apollo/mutations'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import { theme } from '../../utils/themeColors'
import { FlashMessage } from '../../ui/FlashMessage/FlashMessage'
import { phoneRegex } from '../../utils/regex'
import { buildPhoneNumber, getApolloErrorMessage } from '../../utils/phone'

const EGYPT = { cca2: 'EG', name: 'Egypt', callingCode: ['20'], flag: 'flag-EG', currency: [], region: '', subregion: '' }

const SEND_OTP_TO_PHONE = gql`
  ${sendOtpToPhoneNumber}
`

/**
 * Phone-number-only sign in / sign up.
 * Step 1 (this hook): collect the number and ask the backend to text a code.
 * Step 2 (PhoneOtp screen): verify the code, which signs in or creates the account.
 */
export const useCreateAccount = () => {
  const { t, i18n } = useTranslation()
  const navigation = useNavigation()
  const themeContext = useContext(ThemeContext)
  const currentTheme = { isRTL: i18n.dir() === 'rtl', ...theme[themeContext.ThemeValue] }

  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState(null)

  // The service runs in Egypt only: the country is fixed (+20), nothing to detect or pick.
  const countryCode = 'EG'
  const country = EGYPT

  const goToOtp = (fullPhone) => navigation.navigate('PhoneOtp', { phone: fullPhone })

  const [sendOtp, { loading }] = useMutation(SEND_OTP_TO_PHONE)

  const validate = () => {
    const { digits } = buildPhoneNumber(country?.callingCode?.[0], phone)
    if (!digits) {
      setPhoneError(t('mobileErr1'))
      return false
    }
    if (!phoneRegex.test(digits)) {
      setPhoneError(t('mobileErr2'))
      return false
    }
    setPhoneError(null)
    return true
  }

  const sendCode = async () => {
    Keyboard.dismiss()
    if (loading) return
    if (!validate()) {
      FlashMessage({ message: t('mobileErr1'), duration: 3000 })
      return
    }
    const { full } = buildPhoneNumber(country?.callingCode?.[0], phone)
    try {
      await sendOtp({ variables: { phone: full } })
      FlashMessage({ message: t('otpSentToPhone') })
      goToOtp(full)
    } catch (error) {
      console.log('sendOtpToPhoneNumber failed', JSON.stringify({ message: error?.message, graphQL: error?.graphQLErrors, network: error?.networkError?.message }))
      const message = getApolloErrorMessage(error, error?.networkError ? `${t('somethingWentWrong')} (${error.networkError.message})` : error?.message || t('somethingWentWrong'))
      // The backend only allows one code every 30 seconds. If one was just sent, let the user enter it.
      if (/wait/i.test(message)) {
        goToOtp(full)
        return
      }
      // Keep the reason on screen (the flash message disappears in a second).
      setPhoneError(message)
      FlashMessage({ message, duration: 4000 })
    }
  }

  return {
    phone,
    setPhone,
    phoneError,
    setPhoneError,
    country,
    countryCode,
    loading,
    sendCode,
    themeContext,
    currentTheme,
    navigation
  }
}
