import { useContext, useState } from 'react'
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
import { useCountryFromIP } from '../../utils/useCountryFromIP'

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

  const { country, setCountry, currentCountry: countryCode, setCurrentCountry: setCountryCode, isLoading: isCountryLoading } = useCountryFromIP()

  const onCountrySelect = (selected) => {
    setCountryCode(selected.cca2)
    setCountry(selected)
  }

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
    if (loading || !validate()) return
    const { full } = buildPhoneNumber(country?.callingCode?.[0], phone)
    try {
      await sendOtp({ variables: { phone: full } })
      FlashMessage({ message: t('otpSentToPhone') })
      goToOtp(full)
    } catch (error) {
      const message = getApolloErrorMessage(error, t('somethingWentWrong'))
      // The backend only allows one code every 30 seconds. If one was just sent, let the user enter it.
      if (/wait/i.test(message)) {
        goToOtp(full)
        return
      }
      FlashMessage({ message })
    }
  }

  const continueAsGuest = () => navigation.navigate('Discovery')

  return {
    phone,
    setPhone,
    phoneError,
    setPhoneError,
    country,
    countryCode,
    onCountrySelect,
    isCountryLoading,
    loading,
    sendCode,
    continueAsGuest,
    themeContext,
    currentTheme,
    navigation
  }
}
