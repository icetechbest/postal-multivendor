import React, { useLayoutEffect } from 'react'
import { View, Image, TouchableOpacity, StatusBar, Platform, KeyboardAvoidingView, ScrollView, ActivityIndicator } from 'react-native'
import CountryPicker from 'react-native-country-picker-modal'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import styles from './styles'
import phoneStyles from '../PhoneNumber/styles'
import Spinner from '../../components/Spinner/Spinner'
import TextDefault from '../../components/Text/TextDefault/TextDefault'
import PhoneNumberInput from '../../components/PhoneNumberInput'
import ErrorView from '../../components/ErrorView/ErrorView'
import useNetworkStatus from '../../utils/useNetworkStatus'
import { scale } from '../../utils/scaling'
import { useCreateAccount } from './useCreateAccount'

const CreateAccount = () => {
  const { phone, setPhone, phoneError, setPhoneError, country, countryCode, onCountrySelect, isCountryLoading, loading, sendCode, continueAsGuest, themeContext, currentTheme, navigation } = useCreateAccount()
  const { t } = useTranslation()
  const { isConnected: connect } = useNetworkStatus()

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false })
  }, [navigation])

  if (!connect) return <ErrorView refetchFunctions={[]} />

  const field = phoneStyles(currentTheme)

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles(currentTheme).safeAreaViewStyles}>
      <StatusBar backgroundColor='transparent' translucent barStyle={themeContext.ThemeValue === 'Dark' ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView style={styles().flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles().flex} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps='handled' showsVerticalScrollIndicator={false}>
          <View style={styles().mainContainer}>
            <View style={styles().gifContainer}>
              <Image source={require('../../assets/gifs/login.gif')} style={styles().gifImage} resizeMode='cover' />
            </View>

            <View style={styles().welcomeSection}>
              <TextDefault H1 bolder center textColor={currentTheme.newFontcolor} style={styles(currentTheme).mainTitle}>
                {t('welcomeText')}
              </TextDefault>
              <TextDefault center H5 textColor={currentTheme.newFontcolor} style={styles().subTitle}>
                {t('phoneLoginDesc')}
              </TextDefault>
            </View>

            <View style={styles().buttonsContainer}>
              <View style={field.number}>
                <View style={[field.textField, field.countryCode, { padding: Platform.OS === 'ios' ? scale(5) : scale(12) }]}>
                  {isCountryLoading ? (
                    <ActivityIndicator size='small' color={currentTheme.newFontcolor} />
                  ) : (
                    <>
                      <CountryPicker countryCode={countryCode} onSelect={onCountrySelect} withAlphaFilter withFilter />
                      <TextDefault textColor={currentTheme.newFontcolor} style={{ marginTop: Platform.OS === 'android' ? 8 : 10 }}>
                        +{country?.callingCode?.[0]}
                      </TextDefault>
                    </>
                  )}
                </View>
                <View style={[field.textField, field.phoneNumber, phoneError && field.errorInput]}>
                  <View style={field.phoneField}>
                    <PhoneNumberInput
                      setError={setPhoneError}
                      placeholder={t('phoneNumber')}
                      placeholderTextColor={currentTheme.color6}
                      style={field.phoneNo}
                      countryCode={country?.callingCode?.[0]}
                      value={phone}
                      onChange={(value) => {
                        setPhone(value)
                        if (phoneError) setPhoneError(null)
                      }}
                    />
                  </View>
                </View>
              </View>
              {!!phoneError && (
                <TextDefault bold textColor={currentTheme.textErrorColor} isRTL>
                  {phoneError}
                </TextDefault>
              )}

              <TouchableOpacity onPress={sendCode} activeOpacity={0.7} disabled={loading} style={field.btn}>
                {loading ? (
                  <Spinner size='small' backColor='transparent' spinnerColor={currentTheme.white} />
                ) : (
                  <TextDefault H4 textColor={currentTheme.color4} bold>
                    {t('textWithCodeBtn')}
                  </TextDefault>
                )}
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.7} style={styles(currentTheme).guestButton} onPress={continueAsGuest}>
                <TextDefault H4 textColor={currentTheme.primary} center bold>
                  {t('continueAsGuest')}
                </TextDefault>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
export default CreateAccount
