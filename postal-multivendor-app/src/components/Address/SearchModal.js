import React, { useContext, useEffect, useState, useCallback, useRef } from 'react'
import {
  Modal,
  View,
  TouchableOpacity,
  Keyboard,
  Dimensions,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert
} from 'react-native'
import Animated, {
  Easing as EasingNode,
  Extrapolation,
  interpolate,
  useSharedValue,
  withTiming,
  useAnimatedStyle
} from 'react-native-reanimated'
import useEnvVars from '../../../environment'
import { searchPlaces } from '../../services/osm'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import { alignment } from '../../utils/alignment'
import { scale } from '../../utils/scaling'
import { theme } from '../../utils/themeColors'
import TextDefault from '../Text/TextDefault/TextDefault'
import styles from './styles'

import { useTranslation } from 'react-i18next'
import { AntDesign, Ionicons } from '@expo/vector-icons'

const { height } = Dimensions.get('screen')

export default function SearchModal({
  visible = false,
  onClose = () => {},
  onSubmit = () => {}
}) {
  const { t } = useTranslation()
  const animation = useSharedValue(0)
  const { GEOCODING_URL } = useEnvVars()

  const [searchText, setSearchText] = useState('')
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const debounceTimerRef = useRef(null)
  const requestIdRef = useRef(0)

  const themeContext = useContext(ThemeContext)
  const currentTheme = theme[themeContext.ThemeValue]

  // Reset state when the modal opens.
  useEffect(() => {
    if (visible) {
      setSearchText('')
      setPredictions([])
      setLoading(false)
      setError(null)
    }
  }, [visible])

  const marginTop = useAnimatedStyle(() => {
    return {
      marginTop: interpolate(
        animation.value,
        [0, 1],
        [height * 0.4, height * 0.06],
        Extrapolation.CLAMP
      )
    }
  })

  const borderTopLeftRadius = useAnimatedStyle(() => {
    return {
      borderTopLeftRadius: interpolate(
        animation.value,
        [0, 1],
        [30, 0],
        Extrapolation.CLAMP
      )
    }
  })

  const borderTopRightRadius = useAnimatedStyle(() => {
    return {
      borderTopRightRadius: interpolate(
        animation.value,
        [0, 1],
        [30, 0],
        Extrapolation.CLAMP
      )
    }
  })

  useEffect(() => {
    const keyboardShowListener = Keyboard.addListener('keyboardDidShow', _keyboardDidShow)
    const keyboardHideListener = Keyboard.addListener('keyboardDidHide', _keyboardDidHide)

    return () => {
      keyboardShowListener.remove()
      keyboardHideListener.remove()

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  const _keyboardDidShow = () => {
    animate()
  }

  const _keyboardDidHide = () => {
    animate(true)
  }

  const animate = (hide = false) => {
    withTiming(
      (animation.value = hide ? 0 : 1),
      { duration: 300 },
      { easing: EasingNode.inOut(EasingNode.ease) }
    )
  }

  const close = () => {
    animation.value = 0

    setSearchText('')
    setPredictions([])
    setLoading(false)
    setError(null)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    onClose()
  }

  // Search for places using Nominatim (OpenStreetMap).
  const runSearch = useCallback(
    async (query) => {
      if (!query || query.length < 2) {
        setPredictions([])
        setLoading(false)
        setError(null)
        return
      }

      const requestId = ++requestIdRef.current
      setLoading(true)
      setError(null)

      try {
        const results = await searchPlaces(GEOCODING_URL, query, { limit: 5 })
        if (requestId !== requestIdRef.current) return // stale response
        setPredictions(results)
        setError(null)
      } catch (err) {
        if (requestId !== requestIdRef.current) return
        setPredictions([])
        setError('Search service unavailable')
      } finally {
        if (requestId === requestIdRef.current) setLoading(false)
      }
    },
    [GEOCODING_URL]
  )

  // Debounce text input (>= 500ms) to respect Nominatim rate limits.
  const handleTextChange = useCallback(
    (text) => {
      setSearchText(text)

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      debounceTimerRef.current = setTimeout(() => {
        runSearch(text)
      }, 500)
    },
    [runSearch]
  )

  // Handle place selection: results already carry coordinates.
  const handlePlaceSelect = useCallback(
    (place) => {
      if (
        place &&
        typeof place.latitude === 'number' &&
        typeof place.longitude === 'number'
      ) {
        onSubmit(place.description, {
          lat: place.latitude,
          lng: place.longitude
        })
        close()
      } else {
        Alert.alert('Error', 'Unable to get coordinates for this location')
      }
    },
    [onSubmit]
  )

  const renderPrediction = ({ item }) => (
    <TouchableOpacity
      style={{
        backgroundColor: currentTheme.cardBackground,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 8
      }}
      onPress={() => handlePlaceSelect(item)}
      disabled={loading}
    >
      <View style={styles(currentTheme).locationIcon}>
        <Ionicons name="location-outline" size={16} color={currentTheme.newIconColor} />
      </View>
      <TextDefault numberOfLines={1} textColor={currentTheme.newFontcolor} style={{ flex: 1 }}>
        {item.description}
      </TextDefault>
    </TouchableOpacity>
  )

  return (
    <Modal
      visible={visible}
      transparent
      animationType={'slide'}
      onRequestClose={close}
    >
      <Animated.View
        style={[
          styles(currentTheme).modalContainer,
          marginTop,
          borderTopLeftRadius,
          borderTopRightRadius,
        ]}
      >
        <View style={[styles(currentTheme).flex, alignment.MTsmall]}>
          <TouchableOpacity style={styles().modalTextBtn} onPress={close}>
            <AntDesign
              name='arrowleft'
              size={24}
              color={currentTheme.newIconColor}
            />
          </TouchableOpacity>

          {/* Full Width Container for Search */}
          <View style={{ flex: 1, paddingHorizontal: 0 }}>

            {/* Text Input Container */}
            <View style={{
              borderWidth: 1,
              borderColor: currentTheme.customBorder,
              borderRadius: scale(6),
              backgroundColor: currentTheme.themeBackground,
              flexDirection: 'row',
              alignItems: 'center',
              marginHorizontal: 0
            }}>
              <TextInput
                style={{
                  ...alignment.MTxSmall,
                  color: currentTheme.newFontcolor,
                  backgroundColor: currentTheme.themeBackground,
                  height: 38,
                  flex: 1,
                  paddingHorizontal: 12,
                  fontSize: 16
                }}
                placeholder={t('search')}
                placeholderTextColor={currentTheme.fontMainColor}
                value={searchText}
                onChangeText={handleTextChange}
                autoFocus={true}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={() => {
                  if (predictions.length > 0) {
                    handlePlaceSelect(predictions[0])
                  }
                }}
              />
              {loading && (
                <ActivityIndicator
                  size="small"
                  color={currentTheme.newIconColor}
                  style={{ marginRight: 12 }}
                />
              )}
            </View>

            {/* Results List Container */}
            {(predictions.length > 0 || error || (searchText.length > 2 && !loading)) && (
              <View style={{
                marginTop: 8,
                backgroundColor: currentTheme.cardBackground,
                borderRadius: scale(6),
                maxHeight: height * 0.4, // Limit height to 40% of screen
                elevation: 3,
                shadowColor: currentTheme.shadowColor,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
              }}>
                {error ? (
                  <View style={{
                    paddingVertical: 16,
                    paddingHorizontal: 16,
                    alignItems: 'center'
                  }}>
                    <Ionicons name="alert-circle-outline" size={24} color="#FF6B6B" />
                    <TextDefault
                      textColor="#FF6B6B"
                      style={{ fontSize: 14, marginTop: 8, textAlign: 'center' }}
                    >
                      {error}
                    </TextDefault>
                  </View>
                ) : predictions.length > 0 ? (
                  <FlatList
                    data={predictions}
                    renderItem={renderPrediction}
                    keyExtractor={(item) => item.id}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={true}
                    nestedScrollEnabled={true}
                    style={{ flexGrow: 0 }}
                  />
                ) : searchText.length > 2 && !loading ? (
                  <View style={{
                    paddingVertical: 20,
                    alignItems: 'center'
                  }}>
                    <Ionicons
                      name="search-outline"
                      size={32}
                      color={currentTheme.fontMainColor}
                    />
                    <TextDefault
                      textColor={currentTheme.fontMainColor}
                      style={{ marginTop: 8, fontSize: 16 }}
                    >
                      No places found
                    </TextDefault>
                    <TextDefault
                      textColor={currentTheme.fontMainColor}
                      style={{ marginTop: 4, fontSize: 14 }}
                    >
                      Try a different search term
                    </TextDefault>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    </Modal>
  )
}
