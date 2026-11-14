'use client';

import dynamic from 'next/dynamic';

import { IZoneCustomGoogleMapsBoundComponentProps } from '@/lib/utils/interfaces';
import CustomLoader from '../../custom-progress-indicator';

const LocationBoundsZoneCore = dynamic(
  () => import('../../osm-maps/location-bounds-zone'),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '600px',
          width: '100%',
        }}
      >
        <CustomLoader />
      </div>
    ),
  }
);

/**
 * Super-admin zone form: draws/edits the zone polygon and reports the
 * coordinates back to Formik.
 */
const CustomGoogleMapsLocationZoneBounds: React.FC<
  IZoneCustomGoogleMapsBoundComponentProps
> = ({ _id, _path, onSetZoneCoordinates }) => {
  return (
    <LocationBoundsZoneCore
      _id={_id}
      _path={_path as number[][][]}
      onSetZoneCoordinates={onSetZoneCoordinates}
    />
  );
};

export default CustomGoogleMapsLocationZoneBounds;
