'use client';

import dynamic from 'next/dynamic';
import { useContext } from 'react';

import { RestaurantLayoutContext } from '@/lib/context/restaurant/layout-restaurant.context';
import { ICustomGoogleMapsLocationBoundsComponentProps } from '@/lib/utils/interfaces';
import CustomLoader from '../../custom-progress-indicator';

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
 * Restaurant dashboard: delivery bounds + location for the logged-in
 * restaurant.
 */
const UpdateRestaurantLocationBounds: React.FC<
  ICustomGoogleMapsLocationBoundsComponentProps
> = ({ onStepChange, hideControls, height }) => {
  const { restaurantLayoutContextData } = useContext(RestaurantLayoutContext);

  return (
    <LocationBoundsCore
      restaurantId={restaurantLayoutContextData?.restaurantId ?? ''}
      onStepChange={onStepChange}
      successStep={2}
      height={height}
      hideControls={hideControls}
      defaultZoneType="point"
      showZones
      showRadiusInput
    />
  );
};

export default UpdateRestaurantLocationBounds;
