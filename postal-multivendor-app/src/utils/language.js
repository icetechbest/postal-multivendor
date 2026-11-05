import AsyncStorage from '@react-native-async-storage/async-storage'
import i18next from 'i18next'

export const DEFAULT_LANGUAGE = 'ar'
export const LANGUAGE_KEY = 'postal-language'
export const LANGUAGE_NAME_KEY = 'postal-language-name'
export async function getSavedLanguage() {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_KEY)
    return stored || DEFAULT_LANGUAGE
  } catch (e) {
    return DEFAULT_LANGUAGE
  }
}

// The app handles right-to-left itself through i18n.dir() / the isRTL props (see Issue.md),
// with native RTL switched off in app.json, so a language change needs no restart.
export function syncLayoutDirection() {
  return false
}

// Single entry point used by every language picker.
export async function applyLanguage(code, name) {
  await AsyncStorage.setItem(LANGUAGE_KEY, code)
  if (name) await AsyncStorage.setItem(LANGUAGE_NAME_KEY, name)
  await i18next.changeLanguage(code)
  return true
}
