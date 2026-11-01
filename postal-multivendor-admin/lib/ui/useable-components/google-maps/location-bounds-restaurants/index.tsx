'use client';

import dynamic from 'next/dynamic';
import { useContext } from 'react';

import { RestaurantsContext } from '@/lib/context/super-admin/restaurants.context';
import { ICustomGoogleMapsLocationBoundsComponentProps } from '@/lib/utils/interfaces';
import CustomLoader from '../../custom-progress-indicator';

// Leaflet touches `window`, so it must never be server-rendered.
const LocationBoundsCore = dynamic(() => import('../../osm-maps/location-bounds'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '400px',
        width: '100%',
      }}
    >
      <CustomLoader />
    </div>
  ),
});

/**
 * Super-admin store form: delivery bounds + location for the store selected in
 * RestaurantsContext.
 */
const CustomGoogleMapsLocationBounds: React.FC<
  ICustomGoogleMapsLocationBoundsComponentProps
> = ({ onStepChange, hideControls, height }) => {
  const { restaurantsContextData } = useContext(RestaurantsContext);

  return (
    <LocationBoundsCore
      restaurantId={restaurantsContextData?.restaurant?._id?.code ?? ''}
      initialAddress={
        restaurantsContextData?.restaurant?.autoCompleteAddress ?? ''
      }
      onStepChange={onStepChange}
      successStep={3}
      height={height}
      hideControls={hideControls}
      defaultZoneType="radius"
      showZones
      showRadiusInput
    />
  );
};

export default CustomGoogleMapsLocationBounds;
