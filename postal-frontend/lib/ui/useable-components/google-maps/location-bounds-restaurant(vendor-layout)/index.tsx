'use client';

import dynamic from 'next/dynamic';
import { useContext } from 'react';

import { VendorLayoutRestaurantContext } from '@/lib/context/vendor/restaurant.context';
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
 * Vendor dashboard form: delivery bounds + location for the vendor's own
 * restaurant.
 */
const CustomGoogleMapsLocationBounds: React.FC<
  ICustomGoogleMapsLocationBoundsComponentProps
> = ({ onStepChange, hideControls, height }) => {
  const { restaurantContextData } = useContext(VendorLayoutRestaurantContext);

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
      includeAddress={false}
    />
  );
};

export default CustomGoogleMapsLocationBounds;
