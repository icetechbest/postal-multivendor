'use client';

/* eslint-disable react-hooks/exhaustive-deps */
import { useContext } from 'react';

import { ILocation } from '../utils/interfaces';
import { useConfiguration } from './useConfiguration';
import { ToastContext } from '@/lib/context/global/toast.context';
import { reverseGeocode } from '@/lib/utils/methods/osm';

type LocationCallback = (error: string | null, location?: ILocation) => void;

export default function useLocation() {
  // Toast Context
  const { showToast } = useContext(ToastContext);

  const { GEOCODING_URL } = useConfiguration();

  // Reverse geocoding via Nominatim (no API key / no billing).
  const latLngToGeoString = async ({
    latitude,
    longitude,
  }: {
    latitude: number;
    longitude: number;
  }): Promise<string> => {
    return reverseGeocode(GEOCODING_URL, latitude, longitude);
  };

  const getCurrentLocation = (callback: LocationCallback): void => {
    navigator.geolocation.getCurrentPosition(
      async (position: GeolocationPosition) => {
        const { latitude, longitude } = position.coords;
        try {
          const address = await reverseGeocode(
            GEOCODING_URL,
            latitude,
            longitude
          );
          callback(null, {
            label: 'Home',
            latitude,
            longitude,
            deliveryAddress: address,
          });
        } catch (error) {
          callback(error instanceof Error ? error.message : String(error));
        }
      },
      (error: GeolocationPositionError) => {
        callback(error.message);
        showToast({
          type: 'error',
          title: 'Current Location',
          message: error.message,
        });
      }
    );
  };

  return {
    getCurrentLocation,
    latLngToGeoString,
  };
}
