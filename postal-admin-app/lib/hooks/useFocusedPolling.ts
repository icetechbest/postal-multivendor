import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { AppState } from 'react-native';

/**
 * Polls only while the screen is focused AND the app is in the foreground.
 * Tabs stay mounted in the background, so a plain `pollInterval` would keep
 * hitting the server for screens nobody is looking at.
 */
export const useFocusedPolling = (
  startPolling: (ms: number) => void,
  stopPolling: () => void,
  interval: number,
): void => {
  useFocusEffect(
    useCallback(() => {
      if (AppState.currentState === 'active') startPolling(interval);
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') startPolling(interval);
        else stopPolling();
      });
      return () => {
        subscription.remove();
        stopPolling();
      };
    }, [startPolling, stopPolling, interval]),
  );
};
