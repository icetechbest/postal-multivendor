import { useEffect, useState } from "react";
import * as Location from "expo-location";

export type LiveLocation = {
  latitude: number;
  longitude: number;
  heading: number | null;
  accuracy: number | null;
};

type Options = {
  /** start / stop watching */
  enabled?: boolean;
  /** ask for the foreground permission if it was not decided yet (default: false) */
  requestPermission?: boolean;
  accuracy?: Location.Accuracy;
  /** metres between updates */
  distanceInterval?: number;
  /** ms between updates (Android) */
  timeInterval?: number;
};

/**
 * Live device location (expo-location watchPositionAsync).
 * Used by <AppMap showsUserLocation /> to draw the "blue dot".
 */
export function useLiveLocation({
  enabled = true,
  requestPermission = false,
  accuracy = Location.Accuracy.High,
  distanceInterval = 5,
  timeInterval = 2000,
}: Options = {}) {
  const [location, setLocation] = useState<LiveLocation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      try {
        let perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted && requestPermission && perm.canAskAgain) {
          perm = await Location.requestForegroundPermissionsAsync();
        }
        if (!perm.granted) {
          if (!cancelled) setError("permission-denied");
          return;
        }
        const sub = await Location.watchPositionAsync(
          { accuracy, distanceInterval, timeInterval },
          ({ coords }) => {
            if (cancelled) return;
            setError(null);
            setLocation({
              latitude: coords.latitude,
              longitude: coords.longitude,
              heading: coords.heading ?? null,
              accuracy: coords.accuracy ?? null,
            });
          },
        );
        if (cancelled) sub.remove();
        else subscription = sub;
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled, requestPermission, accuracy, distanceInterval, timeInterval]);

  return { location, error };
}

export default useLiveLocation;
