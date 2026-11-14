import React, { useCallback, useContext, useLayoutEffect, useState } from 'react'
import { View, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native'
import { useQuery } from '@apollo/client'
import gql from 'graphql-tag'
import { useTranslation } from 'react-i18next'
import { myWallet } from '../../apollo/queries'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import UserContext from '../../context/User'
import ConfigurationContext from '../../context/Configuration'
import { theme } from '../../utils/themeColors'
import TextDefault from '../../components/Text/TextDefault/TextDefault'
import Spinner from '../../components/Spinner/Spinner'
import { scale } from '../../utils/scaling'

const MY_WALLET = gql`
  ${myWallet}
`
const PAGE_SIZE = 20

const TX_LABEL_KEYS = {
  WALLET_CREDIT: 'wl_tx_credit',
  WALLET_DEBIT: 'wl_tx_debit',
  WALLET_REFUND: 'wl_tx_refund'
}

const Wallet = ({ navigation }) => {
  const { t, i18n } = useTranslation()
  const themeContext = useContext(ThemeContext)
  const currentTheme = { isRTL: i18n.dir() === 'rtl', ...theme[themeContext.ThemeValue] }
  const { refetchProfile } = useContext(UserContext)
  const configuration = useContext(ConfigurationContext)
  const symbol = configuration?.currencySymbol || ''

  const { data, loading, error, refetch, fetchMore } = useQuery(MY_WALLET, {
    variables: { page: 1, limit: PAGE_SIZE },
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: false
  })
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('wl_title') })
  }, [navigation, t])

  const wallet = data?.myWallet
  const page = wallet?.transactions
  const items = page?.transactions || []
  const hasMore = !!page && page.page < page.totalPages

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refetch({ page: 1, limit: PAGE_SIZE })
      refetchProfile && refetchProfile()
    } catch (e) {
      // the error state below is driven by useQuery
    } finally {
      setRefreshing(false)
    }
  }, [refetch, refetchProfile])

  const onLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      await fetchMore({
        variables: { page: page.page + 1, limit: PAGE_SIZE },
        updateQuery: (prev, { fetchMoreResult }) => {
          const next = fetchMoreResult?.myWallet
          if (!next) return prev
          const known = new Set(prev.myWallet.transactions.transactions.map((x) => x._id))
          const fresh = next.transactions.transactions.filter((x) => !known.has(x._id))
          return {
            myWallet: {
              ...next,
              transactions: {
                ...next.transactions,
                transactions: [...prev.myWallet.transactions.transactions, ...fresh]
              }
            }
          }
        }
      })
    } catch (e) {
      // keep what is already shown; the user can scroll again to retry
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, fetchMore, page])

  const header = (
    <View style={[local.card, { backgroundColor: currentTheme.main }]}>
      <TextDefault H5 bold textColor={currentTheme.black}>
        {t('wl_balance')}
      </TextDefault>
      <TextDefault style={local.balance} bolder textColor={currentTheme.black}>
        {symbol}
        {Number(wallet?.balance || 0).toFixed(2)}
      </TextDefault>
      <TextDefault small textColor={currentTheme.black} center>
        {t('wl_hint')}
      </TextDefault>
    </View>
  )

  if (loading && !data) return <Spinner backColor={currentTheme.themeBackground} spinnerColor={currentTheme.main} />

  if (error && !data) {
    return (
      <View style={[local.center, { backgroundColor: currentTheme.themeBackground }]}>
        <TextDefault center textColor={currentTheme.fontSecondColor}>
          {t('wl_load_error')}
        </TextDefault>
        <TouchableOpacity onPress={() => refetch()} style={{ marginTop: scale(12) }}>
          <TextDefault bolder textColor={currentTheme.lightBlue}>
            {t('wl_retry')}
          </TextDefault>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: currentTheme.themeBackground }}>
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={currentTheme.main} />}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: scale(16) }} color={currentTheme.main} /> : null}
        ListEmptyComponent={
          <TextDefault center textColor={currentTheme.fontSecondColor} style={{ marginTop: scale(24) }}>
            {t('wl_empty')}
          </TextDefault>
        }
        renderItem={({ item }) => {
          const positive = item.direction >= 0
          return (
            <View style={[local.row, { borderBottomColor: currentTheme.borderColor, flexDirection: currentTheme.isRTL ? 'row-reverse' : 'row' }]}>
              <View style={{ flex: 1 }}>
                <TextDefault bold textColor={currentTheme.fontMainColor} isRTL>
                  {t(TX_LABEL_KEYS[item.type] || 'wl_tx_other')}
                  {item.orderId ? `  #${item.orderId}` : ''}
                </TextDefault>
                {!!item.note && (
                  <TextDefault small textColor={currentTheme.fontSecondColor} isRTL>
                    {item.note}
                  </TextDefault>
                )}
                <TextDefault small textColor={currentTheme.fontSecondColor} isRTL>
                  {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                </TextDefault>
              </View>
              <View style={{ alignItems: currentTheme.isRTL ? 'flex-start' : 'flex-end' }}>
                <TextDefault bolder textColor={positive ? '#16a34a' : '#dc2626'}>
                  {positive ? '+' : '−'}
                  {symbol}
                  {Math.abs(Number(item.amount || 0)).toFixed(2)}
                </TextDefault>
                {item.walletAfter != null && (
                  <TextDefault small textColor={currentTheme.fontSecondColor}>
                    {t('wl_after')}: {symbol}
                    {Number(item.walletAfter).toFixed(2)}
                  </TextDefault>
                )}
              </View>
            </View>
          )
        }}
      />
    </View>
  )
}

const local = StyleSheet.create({
  card: { margin: scale(16), padding: scale(20), borderRadius: scale(16), alignItems: 'center' },
  balance: { fontSize: scale(36), marginVertical: scale(4) },
  row: { alignItems: 'center', paddingHorizontal: scale(16), paddingVertical: scale(12), borderBottomWidth: StyleSheet.hairlineWidth },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: scale(24) }
})

export default Wallet
