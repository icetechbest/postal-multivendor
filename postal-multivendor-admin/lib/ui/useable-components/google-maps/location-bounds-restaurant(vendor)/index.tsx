'use client';

import dynamic from 'next/dynamic';
import { useContext } from 'react';

import { RestaurantContext } from '@/lib/context/super-admin/restaurant.context';
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
 * Super-admin vendor form: delivery bounds + location for the restaurant in
 * RestaurantContext.
 */
const CustomGoogleMapsLocationBounds: React.FC<
  ICustomGoogleMapsLocationBoundsComponentProps
> = ({ onStepChange, hideControls, height }) => {
  const { restaurantContextData } = useContext(RestaurantContext);

  return (
    <LocationBoundsCore
      restaurantId={restaurantContextData?.id ?? ''}
      initialAddress={restaurantContextData?.autoCompleteAddress ?? ''}
      onStepChange={onStepChange}
      successStep={2}
      height={height}
      hideControls={hideControls}
      defaultZoneType="radius"
      showZones
      showRadiusInput
    />
  );
};

export default CustomGoogleMapsLocationBounds;
