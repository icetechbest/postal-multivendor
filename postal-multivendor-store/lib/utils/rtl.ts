import { DevSettings, I18nManager } from "react-native";
import * as Updates from "expo-updates";

const RTL_LANGUAGES = ["ar", "he", "fa", "ur", "ps", "ku"];

/**
 * Flips the native layout direction for right-to-left languages (Arabic...).
 * React Native applies it only after a restart, so the bundle is reloaded once
 * when the direction actually changed.
 */
export function syncLayoutDirection(lang: string) {
  const rtl = RTL_LANGUAGES.includes(lang);
  I18nManager.allowRTL(rtl);
  if (I18nManager.isRTL === rtl) return;
  I18nManager.forceRTL(rtl);
  setTimeout(async () => {
    try {
      if (__DEV__) DevSettings.reload();
      else await Updates.reloadAsync();
    } catch (e) {
      console.log("Reload after direction change failed", e);
    }
  }, 150);
}
