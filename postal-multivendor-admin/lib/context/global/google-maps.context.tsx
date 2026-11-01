'use client';

import React, { createContext } from 'react';

import { IGoogleMapsContext } from '../../utils/interfaces';

/**
 * Leaflet is a client-side library: there is no external script or API key to
 * load, so the map is always "ready". The context is kept (same name and
 * `isLoaded` flag) so existing consumers do not need to change.
 */
export const GoogleMapsContext = createContext<IGoogleMapsContext>({
  isLoaded: true,
});

export const GoogleMapsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const value: IGoogleMapsContext = { isLoaded: true };

  return (
    <GoogleMapsContext.Provider value={value}>
      {children}
    </GoogleMapsContext.Provider>
  );
};
