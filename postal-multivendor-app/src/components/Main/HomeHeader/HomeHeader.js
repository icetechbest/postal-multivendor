import React, { useContext } from 'react'
import { View, TouchableOpacity, StyleSheet } from 'react-native'
import { AntDesign, Feather, Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import TextDefault from '../../Text/TextDefault/TextDefault'
import ThemeContext from '../../../ui/ThemeContext/ThemeContext'
import UserContext from '../../../context/User'
import { LocationContext } from '../../../context/Location'
import { FlashMessage } from '../../../ui/FlashMessage/FlashMessage'
import { theme } from '../../../utils/themeColors'
import { scale } from '../../../utils/scaling'

const YELLOW = '#F0B400'

/**
 * Top of the home screen: delivery location + cart, yellow welcome card,
 * search bar with filter button and the two main categories.
 */
function HomeHeader({ onOpenLocation }) {
  const { t, i18n } = useTranslation()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const themeContext = useContext(ThemeContext)
  const isDark = themeContext.ThemeValue === 'Dark'
  const isRTL = i18n.dir() === 'rtl'
  const currentTheme = theme[themeContext.ThemeValue]
  const { cartCount } = useContext(UserContext)
  const { location } = useContext(LocationContext)

  const card = isDark ? '#17171B' : '#F6F6F6'
  const border = isDark ? '#26262C' : '#E6E6E6'
  const muted = isDark ? '#9A9AA3' : '#6B6B73'
  const text = isDark ? '#FFFFFF' : '#111111'
  const row = isRTL ? 'row-reverse' : 'row'

  const address = location?.deliveryAddress === 'Current Location' ? t('currentLocation') : location?.deliveryAddress

  const openCart = () => {
    if (cartCount > 0) navigation.navigate('Cart')
    else FlashMessage({ message: t('cartIsEmpty') })
  }

  return (
    <View style={{ paddingTop: insets.top + scale(10), paddingHorizontal: scale(16), gap: scale(16) }}>
      {/* location + cart */}
      <View style={[s.row, { flexDirection: row }]}>
        <TouchableOpacity activeOpacity={0.8} onPress={onOpenLocation} accessibilityRole='button' accessibilityLabel={t('deliverTo')} style={[s.locationCard, { flexDirection: row, backgroundColor: card, borderColor: border }]}>
          <View style={[s.locationIcon, { backgroundColor: 'rgba(240,180,0,0.18)' }]}>
            <Ionicons name='location-sharp' size={scale(22)} color={YELLOW} />
          </View>
          <View style={s.flex}>
            <TextDefault small textColor={muted} isRTL numberOfLines={1}>
              {t('deliverTo')}
            </TextDefault>
            <TextDefault bolder textColor={text} isRTL numberOfLines={1}>
              {address || t('selectLocation')}
            </TextDefault>
          </View>
          <Feather name='chevron-down' size={scale(18)} color={YELLOW} />
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.8} onPress={openCart} accessibilityRole='button' accessibilityLabel={t('cart')} style={[s.cartButton, { backgroundColor: card, borderColor: border }]}>
          <Ionicons name='bag-handle' size={scale(24)} color={YELLOW} />
          <View style={s.badge}>
            <TextDefault bolder textColor='#000' style={{ fontSize: scale(11) }} center>
              {cartCount || 0}
            </TextDefault>
          </View>
        </TouchableOpacity>
      </View>

      {/* welcome card */}
      <LinearGradient colors={['#D9A400', '#F7BC12', '#FFC800']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={s.hero}>
        <View style={[s.chip, { flexDirection: row, alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
          <AntDesign name='thunderbolt' size={scale(14)} color='#5A3E00' />
          <TextDefault bold textColor='#3A2800' small>
            {t('heroBadge')}
          </TextDefault>
          <AntDesign name='thunderbolt' size={scale(14)} color='#5A3E00' />
        </View>
        <TextDefault bolder H1 textColor='#000' isRTL>
          {t('heroGreeting')}
        </TextDefault>
        <TextDefault bolder H3 textColor='#000' isRTL>
          {t('heroTitle')}
        </TextDefault>
      </LinearGradient>

      {/* search + filter */}
      <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('Search')} accessibilityRole='search' accessibilityLabel={t('heroSearch')} style={[s.search, { flexDirection: row, backgroundColor: card, borderColor: border }]}>
        <AntDesign name='search1' size={scale(22)} color={YELLOW} />
        <View style={s.flex}>
          <TextDefault textColor={muted} isRTL numberOfLines={1}>
            {t('heroSearch')}
          </TextDefault>
        </View>
        <View style={[s.filter, { borderColor: border, backgroundColor: isDark ? '#1F1F25' : '#FFFFFF' }]}>
          <Ionicons name='options-outline' size={scale(20)} color={text} />
        </View>
      </TouchableOpacity>

      {/* main categories */}
      <View style={[s.row, { flexDirection: row }]}>
        <TextDefault bolder H4 textColor={text} isRTL>
          {t('mainCategories')}
        </TextDefault>
        <TouchableOpacity onPress={() => navigation.navigate('Restaurants')} accessibilityRole='button'>
          <TextDefault bold textColor={YELLOW}>
            {t('viewAll')}
          </TextDefault>
        </TouchableOpacity>
      </View>
      <View style={[s.row, { flexDirection: row, gap: scale(12) }]}>
        {[
          { key: 'Restaurants', label: t('Restaurants'), icon: 'restaurant' },
          { key: 'Store', label: t('Store'), icon: 'storefront' }
        ].map((c) => (
          <TouchableOpacity key={c.key} activeOpacity={0.85} onPress={() => navigation.navigate(c.key)} accessibilityRole='button' style={[s.category, { backgroundColor: card, borderColor: border }]}>
            <View style={[s.categoryIcon, { backgroundColor: YELLOW }]}>
              <Ionicons name={c.icon} size={scale(24)} color='#000' />
            </View>
            <TextDefault bolder textColor={text}>
              {c.label}
            </TextDefault>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  row: { alignItems: 'center', justifyContent: 'space-between' },
  locationCard: { flex: 1, alignItems: 'center', gap: scale(10), borderWidth: 1, borderRadius: scale(22), paddingVertical: scale(8), paddingHorizontal: scale(10), marginHorizontal: scale(0) },
  locationIcon: { width: scale(44), height: scale(44), borderRadius: scale(14), alignItems: 'center', justifyContent: 'center' },
  cartButton: { width: scale(56), height: scale(56), borderRadius: scale(20), borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginHorizontal: scale(10) },
  badge: { position: 'absolute', top: -scale(6), right: -scale(6), minWidth: scale(22), height: scale(22), borderRadius: scale(11), backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  hero: { borderRadius: scale(30), padding: scale(22), gap: scale(6) },
  chip: { alignItems: 'center', gap: scale(6), backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: scale(20), paddingVertical: scale(6), paddingHorizontal: scale(14), marginBottom: scale(8) },
  search: { alignItems: 'center', gap: scale(12), borderWidth: 1, borderRadius: scale(22), height: scale(60), paddingHorizontal: scale(16) },
  filter: { width: scale(40), height: scale(40), borderRadius: scale(12), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  category: { flex: 1, borderWidth: 1, borderRadius: scale(22), padding: scale(14), alignItems: 'center', gap: scale(10) },
  categoryIcon: { width: scale(52), height: scale(52), borderRadius: scale(18), alignItems: 'center', justifyContent: 'center' }
})

export default HomeHeader
