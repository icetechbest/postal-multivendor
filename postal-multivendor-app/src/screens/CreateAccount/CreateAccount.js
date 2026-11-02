import React, { useLayoutEffect, useContext } from 'react'
import { View, Image, TouchableOpacity, StatusBar } from 'react-native'
import styles from './styles'
import TextDefault from '../../components/Text/TextDefault/TextDefault'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'
import useNetworkStatus from '../../utils/useNetworkStatus'
import ErrorView from '../../components/ErrorView/ErrorView'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import { theme } from '../../utils/themeColors'

/**
 * Welcome / entry screen.
 *
 * Sign-in and sign-up are phone-number only: there is no Google, Apple or
 * email/password option anymore. Tapping "Continue with phone number" opens
 * the phone screen in `auth` mode, which sends an OTP and then signs the
 * customer in (creating the account on first use).
 */
const CreateAccount = (props) => {
  const { t } = useTranslation()
  const themeContext = useContext(ThemeContext)
  const currentTheme = theme[themeContext.ThemeValue]

  useLayoutEffect(() => {
    props?.navigation.setOptions({
      headerShown: false
    })
  }, [props?.navigation])

  const goToPhoneAuth = () => {
    props?.navigation.navigate('PhoneNumber', { mode: 'auth' })
  }

  const renderGuestButton = () => (
    <TouchableOpacity activeOpacity={0.7} style={styles(currentTheme).guestButton} onPress={() => props?.navigation.navigate('Discovery')}>
      <TextDefault H4 textColor={currentTheme.primary} center bold>
        {t('continueAsGuest')}
      </TextDefault>
    </TouchableOpacity>
  )

  const { isConnected: connect } = useNetworkStatus()
  if (!connect) return <ErrorView refetchFunctions={[]} />

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles(currentTheme).safeAreaViewStyles}>
      <StatusBar backgroundColor='transparent' translucent barStyle={themeContext.ThemeValue === 'Dark' ? 'light-content' : 'dark-content'} />

      <View style={styles().mainContainer}>
        {/* GIF Section */}
        <View style={styles().gifContainer}>
          <Image source={require('../../assets/gifs/login.gif')} style={styles().gifImage} resizeMode='cover' />
        </View>

        {/* Content Section */}
        <View>
          {/* Welcome Text */}
          <View style={styles().welcomeSection}>
            <TextDefault H1 bolder center textColor={currentTheme.newFontcolor} style={styles(currentTheme).mainTitle}>
              {t('welcomeText')}
            </TextDefault>
            <TextDefault center H5 textColor={currentTheme.newFontcolor} style={styles().subTitle}>
              {t('createAccountDesc')}
            </TextDefault>
          </View>

          {/* Phone-only entry point */}
          <View style={styles().buttonsContainer}>
            <TouchableOpacity activeOpacity={0.7} style={styles(currentTheme).primaryBtn} onPress={goToPhoneAuth}>
              <TextDefault H4 textColor={currentTheme.black} center bold>
                {t('continueWithPhone')}
              </TextDefault>
            </TouchableOpacity>
            {renderGuestButton()}
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}

export default CreateAccount
