import React, { useContext, useLayoutEffect } from 'react'
import { View, FlatList, StyleSheet } from 'react-native'
import { useQuery } from '@apollo/client'
import gql from 'graphql-tag'
import { useTranslation } from 'react-i18next'
import { coinTransactions } from '../../apollo/queries'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import UserContext from '../../context/User'
import ConfigurationContext from '../../context/Configuration'
import { theme } from '../../utils/themeColors'
import { calculateCoins, coinsToMoney, isCoinsEnabled } from '../../utils/coins'
import TextDefault from '../../components/Text/TextDefault/TextDefault'
import Spinner from '../../components/Spinner/Spinner'
import { scale } from '../../utils/scaling'

const COIN_TRANSACTIONS = gql`
  ${coinTransactions}
`

const Coins = ({ navigation }) => {
  const { t, i18n } = useTranslation()
  const themeContext = useContext(ThemeContext)
  const currentTheme = { isRTL: i18n.dir() === 'rtl', ...theme[themeContext.ThemeValue] }
  const { profile } = useContext(UserContext)
  const configuration = useContext(ConfigurationContext)
  const { data, loading } = useQuery(COIN_TRANSACTIONS, { variables: { limit: 50 }, fetchPolicy: 'cache-and-network' })

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('myCoins') })
  }, [navigation, t])

  const balance = profile?.coins || 0
  const symbol = configuration?.currencySymbol || ''
  const rate = Number(configuration?.coinsPerCurrencyUnit ?? 0.1)
  const oneCoinOrder = rate > 0 ? Math.ceil(1 / rate) : 0

  const header = (
    <View style={[local.card, { backgroundColor: currentTheme.main }]}>
      <TextDefault H5 bold textColor={currentTheme.black}>
        {t('coinBalance')}
      </TextDefault>
      <TextDefault style={local.balance} bolder textColor={currentTheme.black}>
        🪙 {balance}
      </TextDefault>
      <TextDefault bold textColor={currentTheme.black}>
        ≈ {symbol}
        {coinsToMoney(balance, configuration).toFixed(2)}
      </TextDefault>
      {isCoinsEnabled(configuration) && oneCoinOrder > 0 && (
        <TextDefault small textColor={currentTheme.black} style={{ marginTop: scale(8) }}>
          {t('coinsEarnHint', { amount: `${symbol}${oneCoinOrder}` })}
        </TextDefault>
      )}
    </View>
  )

  if (loading && !data) return <Spinner backColor={currentTheme.themeBackground} spinnerColor={currentTheme.main} />

  return (
    <View style={{ flex: 1, backgroundColor: currentTheme.themeBackground }}>
      <FlatList
        data={data?.coinTransactions || []}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <TextDefault center textColor={currentTheme.fontSecondColor} style={{ marginTop: scale(24) }}>
            {t('noCoinsYet')}
          </TextDefault>
        }
        renderItem={({ item }) => (
          <View style={[local.row, { borderBottomColor: currentTheme.borderColor }]}>
            <View style={{ flex: 1 }}>
              <TextDefault bold textColor={currentTheme.fontMainColor} isRTL>
                {item.note || t('coinsEarned')}
              </TextDefault>
              <TextDefault small textColor={currentTheme.fontSecondColor} isRTL>
                {new Date(item.createdAt).toLocaleDateString()}
              </TextDefault>
            </View>
            <TextDefault bolder textColor={item.coins >= 0 ? '#16a34a' : '#dc2626'}>
              {item.coins >= 0 ? '+' : ''}
              {item.coins} 🪙
            </TextDefault>
          </View>
        )}
      />
    </View>
  )
}

const local = StyleSheet.create({
  card: { margin: scale(16), padding: scale(20), borderRadius: scale(16), alignItems: 'center' },
  balance: { fontSize: scale(36), marginVertical: scale(4) },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(16), paddingVertical: scale(12), borderBottomWidth: StyleSheet.hairlineWidth }
})

export default Coins
