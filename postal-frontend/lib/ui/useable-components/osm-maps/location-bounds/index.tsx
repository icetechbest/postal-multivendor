'use client';

import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';

import L from 'leaflet';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Circle,
  MapContainer,
  Marker,
  Polygon,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { useTranslations } from 'next-intl';
import { ApolloCache, ApolloError, useMutation, useQuery } from '@apollo/client';

import {
  GET_RESTAURANT_DELIVERY_ZONE_INFO,
  GET_RESTAURANT_PROFILE,
  GET_ZONES,
  UPDATE_DELIVERY_BOUNDS_AND_LOCATION,
} from '@/lib/api/graphql';
import { ToastContext } from '@/lib/context/global/toast.context';
import { useConfiguration } from '@/lib/hooks/useConfiguration';
import {
  ILocationPoint,
  IRestaurantDeliveryZoneInfo,
  IRestaurantProfile,
  IRestaurantProfileResponseGQL,
  IUpdateRestaurantDeliveryZoneVariables,
  IZoneResponse,
  IZonesResponse,
} from '@/lib/utils/interfaces';
import {
  calculatePolygonCentroid,
  transformPath,
  transformPolygon,
} from '@/lib/utils/methods';
import calculateZoom from '@/lib/utils/methods/zoom-calculator';
import { reverseGeocode } from '@/lib/utils/methods/osm';
import { IOsmPlace } from '@/lib/utils/methods/osm';
import CustomButton from '../../button';
import CustomRadiusInputField from '../../custom-radius-input';
import CustomShape from '../../google-maps/shapes';
import AddressSearch from '../address-search';

type PmPolygon = L.Polygon & {
  pm: {
    enable: (options?: Record<string, unknown>) => void;
    disable: () => void;
    enableLayerDrag: () => void;
  };
};

const markerIcon = L.divIcon({
  className: 'osm-marker',
  html: '<div style="width:18px;height:18px;border-radius:50% 50% 50% 0;background:#111;transform:rotate(-45deg);border:2px solid #fff"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 18],
});

// Click handler: only active in "point" mode.
function MapClickHandler({
  enabled,
  onClick,
}: {
  enabled: boolean;
  onClick: (point: ILocationPoint) => void;
}) {
  useMapEvents({
    click(event) {
      if (!enabled) return;
      onClick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

// Keeps the viewport in sync with the selected centre / zoom.
function MapViewController({
  center,
  zoom,
}: {
  center: ILocationPoint;
  zoom: number;
}) {
  const map = useMap();

  useEffect(() => {
    map.setView([center.lat, center.lng], zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng, zoom]);

  return null;
}

export interface ILocationBoundsCoreProps {
  restaurantId: string;
  initialAddress?: string;
  /** Send the address with the update mutation. */
  includeAddress?: boolean;
  onAddressChange?: (address: string) => void;
  onStepChange?: (step: number) => void;
  successStep?: number;
  height?: string;
  hideControls?: boolean;
  defaultZoneType?: string;
  showZones?: boolean;
  showRadiusInput?: boolean;
}

const LocationBoundsCore: React.FC<ILocationBoundsCoreProps> = ({
  restaurantId,
  initialAddress = '',
  includeAddress = true,
  onAddressChange,
  onStepChange,
  successStep = 3,
  height = '400px',
  hideControls = false,
  defaultZoneType = 'radius',
  showZones = true,
  showRadiusInput = true,
}) => {
  const t = useTranslations();
  const { showToast } = useContext(ToastContext);
  const { MAP_TILE_URL, GEOCODING_URL } = useConfiguration();

  // States
  const [zoom, setZoom] = useState(14);
  const [deliveryZoneType, setDeliveryZoneType] = useState(defaultZoneType);
  const [center, setCenter] = useState<ILocationPoint>({
    lat: -25.2744,
    lng: 133.7751,
  });
  const [marker, setMarker] = useState<ILocationPoint>({
    lat: -25.2744,
    lng: 133.7751,
  });
  const [path, setPath] = useState<ILocationPoint[]>([]);
  const [distance, setDistance] = useState(1);
  const [address, setAddress] = useState(initialAddress);
  const [inputValue, setInputValue] = useState(initialAddress);
  const [zones, setZones] = useState<IZoneResponse[]>([]);

  // Refs
  const polygonRef = useRef<PmPolygon | null>(null);

  // API
  const { loading: isFetchingRestaurantProfile } = useQuery(
    GET_RESTAURANT_PROFILE,
    {
      variables: { id: restaurantId ?? '' },
      fetchPolicy: 'network-only',
      skip: !restaurantId,
      onCompleted: onRestaurantProfileFetchCompleted,
      onError: onErrorFetchRestaurantProfile,
    }
  );

  const { loading: isFetchingRestaurantDeliveryZoneInfo } = useQuery(
    GET_RESTAURANT_DELIVERY_ZONE_INFO,
    {
      variables: { id: restaurantId ?? '' },
      fetchPolicy: 'network-only',
      skip: !restaurantId,
      onCompleted: onRestaurantZoneInfoFetchCompleted,
      onError: onErrorFetchRestaurantZoneInfo,
    }
  );

  const [updateRestaurantDeliveryZone, { loading: isSubmitting }] = useMutation(
    UPDATE_DELIVERY_BOUNDS_AND_LOCATION,
    {
      update: (cache, { data }) => {
        if (data) updateCache(cache, data);
      },
      onCompleted: onRestaurantZoneUpdateCompleted,
      onError: onErrorLocationZoneUpdate,
    }
  );

  useQuery<IZonesResponse>(GET_ZONES, {
    skip: !showZones,
    onCompleted: (data) => {
      if (data) setZones(data.zones);
    },
  });

  // Memos
  const radiusInMeter = useMemo(() => distance * 1000, [distance]);

  // API Handlers
  // The mutation is aliased as `result`, so the payload is
  // `{ result: { success, message, data: { _id, deliveryBounds, location } } }`.
  // The previous implementation read `data.restaurant`, which never exists, and
  // therefore overwrote the cached profile with an empty object.
  function updateCache(
    cache: ApolloCache<unknown>,
    data: {
      result?: {
        data?: {
          _id?: string;
          deliveryBounds?: { coordinates: number[][][] };
          location?: { coordinates: number[] };
        };
      };
    }
  ) {
    const updated = data?.result?.data;
    if (!updated) return;

    const cachedData = cache.readQuery<IRestaurantProfileResponseGQL>({
      query: GET_RESTAURANT_PROFILE,
      variables: { id: restaurantId ?? '' },
    });
    if (!cachedData?.restaurant) return;

    cache.writeQuery({
      query: GET_RESTAURANT_PROFILE,
      variables: { id: restaurantId ?? '' },
      data: {
        restaurant: {
          ...cachedData.restaurant,
          ...updated,
        },
      },
    });
  }

  function onErrorFetchRestaurantProfile({
    graphQLErrors,
    networkError,
  }: ApolloError) {
    showToast({
      type: 'error',
      title: t('Store Profile'),
      message:
        graphQLErrors[0]?.message ??
        networkError?.message ??
        t('Store Profile Fetch Failed'),
      duration: 2500,
    });
  }

  function onRestaurantProfileFetchCompleted({
    restaurant,
  }: {
    restaurant: IRestaurantProfile;
  }) {
    const isLocationZero =
      +restaurant?.location?.coordinates[0] === 0 &&
      +restaurant?.location?.coordinates[1] === 0;
    if (!restaurant || isLocationZero) return;

    setCenter({
      lat: +restaurant.location.coordinates[1],
      lng: +restaurant.location.coordinates[0],
    });
    setMarker({
      lat: +restaurant.location.coordinates[1],
      lng: +restaurant.location.coordinates[0],
    });
    setPath(
      restaurant?.deliveryBounds
        ? transformPolygon(restaurant.deliveryBounds.coordinates[0])
        : []
    );
  }

  function onErrorFetchRestaurantZoneInfo({
    graphQLErrors,
    networkError,
  }: ApolloError) {
    showToast({
      type: 'error',
      title: t('Store Location & Zone'),
      message:
        graphQLErrors[0]?.message ??
        networkError?.message ??
        t('Store Location & Zone fetch failed'),
      duration: 2500,
    });
  }

  function onRestaurantZoneInfoFetchCompleted({
    getRestaurantDeliveryZoneInfo,
  }: {
    getRestaurantDeliveryZoneInfo: IRestaurantDeliveryZoneInfo;
  }) {
    const { address: zoneAddress, deliveryBounds, circleBounds, location, boundType } =
      getRestaurantDeliveryZoneInfo;

    const coordinates = {
      lng: location.coordinates[0],
      lat: location.coordinates[1],
    };

    if (!hideControls && zoneAddress) {
      setInputValue(zoneAddress);
      setAddress(zoneAddress);
    }

    const isLocationZero =
      +location?.coordinates[0] === 0 && +location?.coordinates[1] === 0;

    if (!isLocationZero) {
      setCenter(coordinates);
      setMarker(coordinates);
    }

    // The API stores `polygon` / `circle`; the editor uses
    // `polygon` / `radius` / `point`. Without this mapping a saved circle came
    // back as the unknown zone type `circle`, so neither the circle nor the
    // radius input was rendered.
    if (boundType) {
      setDeliveryZoneType(boundType === 'circle' ? 'radius' : boundType);
    }
    if (circleBounds?.radius) setDistance(circleBounds.radius);

    setPath(
      deliveryBounds?.coordinates?.[0]?.map((coordinate: number[]) => ({
        lat: coordinate[1],
        lng: coordinate[0],
      })) || []
    );
  }

  function onErrorLocationZoneUpdate({
    graphQLErrors,
    networkError,
  }: ApolloError) {
    showToast({
      type: 'error',
      title: t('Store Location & Zone'),
      message:
        graphQLErrors[0]?.message ??
        networkError?.message ??
        t('Store Location & Zone update failed'),
      duration: 2500,
    });
  }

  function onRestaurantZoneUpdateCompleted({
    result,
  }: {
    result?: {
      data?: {
        location?: { coordinates: number[] };
        deliveryBounds?: { coordinates: number[][][] };
      };
    };
  }) {
    const updated = result?.data;
    if (updated?.location?.coordinates?.length) {
      setCenter({
        lat: +updated.location.coordinates[1],
        lng: +updated.location.coordinates[0],
      });
      setMarker({
        lat: +updated.location.coordinates[1],
        lng: +updated.location.coordinates[0],
      });
      setPath(
        updated.deliveryBounds?.coordinates?.[0]
          ? transformPolygon(updated.deliveryBounds.coordinates[0])
          : []
      );
    }

    showToast({
      type: 'success',
      title: t('Zone Update'),
      message: `${t('Store Zone has been updated successfully')}.`,
    });

    if (onStepChange) onStepChange(successStep);
  }

  // Other Handlers
  const onSelectPlace = async (place: IOsmPlace) => {
    const nextCenter = { lat: place.lat, lng: place.lng };
    setCenter(nextCenter);
    setMarker(nextCenter);
    setInputValue(place.description);
    setAddress(place.description);
    onAddressChange?.(place.description);

    if (deliveryZoneType === 'polygon') {
      setPath(getPolygonPathFromCircle(nextCenter, radiusInMeter));
    } else if (deliveryZoneType === 'point') {
      setPath([nextCenter]);
    }
  };

  const resolveAddressAt = async (next: ILocationPoint) => {
    const resolved = await reverseGeocode(GEOCODING_URL, next.lat, next.lng);
    if (resolved) {
      setInputValue(resolved);
      setAddress(resolved);
      onAddressChange?.(resolved);
    }
  };

  const onMapClick = (point: ILocationPoint) => {
    // "Point" means a single location, so a click moves the pin instead of
    // appending another polygon vertex.
    if (deliveryZoneType === 'point') {
      setMarker(point);
      setCenter(point);
      setPath([point]);
      void resolveAddressAt(point);
      return;
    }

    setPath((prev) => [...prev, point]);
  };

  const getPolygonPathFromCircle = (
    centerPoint: ILocationPoint,
    radius: number
  ) => {
    try {
      const points = 4;
      const angleStep = (2 * Math.PI) / points;
      const result: ILocationPoint[] = [];

      for (let i = 0; i < points; i++) {
        const angle = i * angleStep;
        const lat = centerPoint.lat + (radius / 111300) * Math.cos(angle);
        const lng =
          centerPoint.lng +
          (radius / (111300 * Math.cos(centerPoint.lat * (Math.PI / 180)))) *
            Math.sin(angle);
        result.push({ lat, lng });
      }

      return result;
    } catch {
      return [];
    }
  };

  const getPolygonPath = (
    centerPoint: ILocationPoint,
    radius: number,
    numPoints = 4
  ) => {
    try {
      const ring: number[][] = [];

      for (let i = 0; i < numPoints; i++) {
        const angle = (i * 2 * Math.PI) / numPoints;
        const lat = centerPoint.lat + (radius / 111320) * Math.cos(angle);
        const lng =
          centerPoint.lng +
          (radius / (111320 * Math.cos((centerPoint.lat * Math.PI) / 180))) *
            Math.sin(angle);
        ring.push([lng, lat]);
      }

      ring.push(ring[0]);
      return [ring];
    } catch {
      return [];
    }
  };

  const handleDistanceChange = (val: number) => setDistance(val || 0);

  const onMarkerDragEnd = async (
    event: L.LeafletEvent & { target: L.Marker }
  ) => {
    const latLng = event.target.getLatLng();
    const next = { lat: latLng.lat, lng: latLng.lng };

    setMarker(next);
    setCenter(next);

    if (deliveryZoneType === 'polygon') {
      setPath(getPolygonPathFromCircle(next, radiusInMeter || 1));
    }

    await resolveAddressAt(next);
  };

  // Polygon editing (Leaflet-Geoman)
  const syncPathFromPolygon = useCallback(() => {
    const polygon = polygonRef.current;
    if (!polygon) return;

    const latlngs = polygon.getLatLngs()[0] as L.LatLng[];
    const nextPath = latlngs.map((latLng) => ({
      lat: latLng.lat,
      lng: latLng.lng,
    }));

    setPath(nextPath);

    if (nextPath.length >= 3) {
      // Use the real polygon centroid (shoelace formula) instead of the
      // average of the vertices, which is skewed by uneven vertex spacing.
      const centroid = calculatePolygonCentroid(
        nextPath.map((point) => [point.lng, point.lat])
      );
      if (centroid.lat !== 0 || centroid.lng !== 0) {
        setCenter(centroid);
        setMarker(centroid);
      }
    }
  }, []);

  // True only while the editable polygon is mounted. Using `path.length > 0`
  // directly as a dependency meant the effect never re-ran when the polygon
  // unmounted and remounted with the same number of points.
  const isPolygonMounted =
    (deliveryZoneType === 'polygon' || deliveryZoneType === 'point') &&
    path.length > 1;

  useEffect(() => {
    const polygon = polygonRef.current;
    if (!polygon || hideControls || !isPolygonMounted) return;

    polygon.pm.enable({ allowSelfIntersection: false, snappable: true });
    polygon.pm.enableLayerDrag();

    polygon.on('pm:edit', syncPathFromPolygon);
    polygon.on('pm:vertexadded', syncPathFromPolygon);
    polygon.on('pm:vertexremoved', syncPathFromPolygon);
    polygon.on('pm:dragend', syncPathFromPolygon);

    return () => {
      polygon.off('pm:edit', syncPathFromPolygon);
      polygon.off('pm:vertexadded', syncPathFromPolygon);
      polygon.off('pm:vertexremoved', syncPathFromPolygon);
      polygon.off('pm:dragend', syncPathFromPolygon);
      polygon.pm.disable();
    };
    // Re-run when the polygon is mounted/unmounted or editability changes.
  }, [hideControls, isPolygonMounted, syncPathFromPolygon]);

  // Submit Handler
  const onLocationSubmitHandler = () => {
    try {
      if (!restaurantId) {
        showToast({
          type: 'error',
          title: t('Location & Zone'),
          message: t('No restaurnat is selected'),
        });
        return;
      }

      const location = {
        latitude: marker?.lat ?? 0,
        longitude: marker?.lng ?? 0,
      };

      // Translate the editor's zone types into the API contract:
      //   radius  -> boundType "circle" + circleBounds.radius
      //   polygon -> boundType "polygon" + bounds
      //   point   -> boundType "point" (location only, existing zone kept)
      let variables: IUpdateRestaurantDeliveryZoneVariables;

      if (deliveryZoneType === 'radius') {
        variables = {
          id: restaurantId,
          location,
          boundType: 'circle',
          bounds: getPolygonPath(center, radiusInMeter),
          circleBounds: { radius: distance },
        };
      } else if (deliveryZoneType === 'point') {
        variables = {
          id: restaurantId,
          location,
          boundType: 'point',
        };
      } else {
        if (path.length < 3) {
          showToast({
            type: 'error',
            title: t('Location & Zone'),
            message: t('Draw at least 3 points on the map'),
          });
          return;
        }
        variables = {
          id: restaurantId,
          location,
          boundType: 'polygon',
          bounds: transformPath(path),
        };
      }

      if (includeAddress) variables.address = address;

      updateRestaurantDeliveryZone({ variables });
    } catch {
      showToast({
        type: 'error',
        title: t('Location & Zone'),
        message: t('Location & Zone update failed'),
      });
    }
  };

  // Use Effects
  useEffect(() => {
    setZoom(calculateZoom(distance));
  }, [distance]);

  return (
    <div>
      <div className="relative overflow-hidden">
        <div style={{ height }} className="h-[600px] w-full object-cover">
          {!hideControls && (
            <div className="absolute left-0 right-0 top-0 z-[1000]">
              <div className="flex w-full flex-col justify-center gap-y-1 p-2">
                <AddressSearch
                  value={inputValue}
                  onChange={setInputValue}
                  onSelect={onSelectPlace}
                  disabled={
                    isFetchingRestaurantDeliveryZoneInfo ||
                    isFetchingRestaurantProfile
                  }
                />
              </div>
            </div>
          )}

          <MapContainer
            center={[center.lat, center.lng]}
            zoom={zoom}
            scrollWheelZoom={!hideControls}
            dragging={!hideControls}
            style={{ height: '100%', width: '100%', borderRadius: 10 }}
          >
            <TileLayer
              url={MAP_TILE_URL}
              maxZoom={19}
              attribution="&copy; OpenStreetMap contributors"
            />
            <MapViewController center={center} zoom={zoom} />
            <MapClickHandler
              enabled={!hideControls && deliveryZoneType === 'point'}
              onClick={onMapClick}
            />

            {showZones &&
              zones.map(
                (zone) =>
                  zone.location && (
                    <Polygon
                      key={zone._id}
                      positions={zone.location.coordinates[0].map(
                        (coords: number[]) => [coords[1], coords[0]] as [number, number]
                      )}
                      pathOptions={{
                        color: 'blue',
                        weight: 2,
                        fillColor: 'lightblue',
                        fillOpacity: 0.3,
                      }}
                    />
                  )
              )}

            {(deliveryZoneType === 'polygon' ||
              deliveryZoneType === 'point') &&
              isPolygonMounted && (
                <Polygon
                  ref={(instance) => {
                    polygonRef.current = (instance as unknown as PmPolygon) ?? null;
                  }}
                  positions={path.map((point) => [point.lat, point.lng] as [number, number])}
                  pathOptions={{
                    color: 'black',
                    weight: 2,
                    fillColor: '#000000',
                    fillOpacity: 0.35,
                  }}
                />
              )}

            {deliveryZoneType === 'radius' && (
              <Circle
                center={[center.lat, center.lng]}
                radius={radiusInMeter}
                pathOptions={{
                  color: 'black',
                  weight: 2,
                  fillColor: 'black',
                  fillOpacity: 0.2,
                }}
              />
            )}

            {marker && (
              <Marker
                position={[marker.lat, marker.lng]}
                icon={markerIcon}
                draggable={!hideControls}
                eventHandlers={{ dragend: onMarkerDragEnd }}
              />
            )}
          </MapContainer>
        </div>
      </div>

      {!hideControls && (
        <>
          {showRadiusInput && deliveryZoneType === 'radius' && (
            <div className="mt-2 w-[8rem]">
              <CustomRadiusInputField
                type="number"
                name="radius"
                placeholder={t('Radius')}
                maxLength={35}
                min={0}
                max={100}
                value={distance}
                onChange={handleDistanceChange}
                showLabel={true}
                loading={false}
              />
            </div>
          )}

          <CustomShape
            selected={deliveryZoneType}
            onClick={(val: string) => {
              switch (val) {
                case 'polygon':
                  setPath(getPolygonPathFromCircle(center, radiusInMeter));
                  break;
                case 'point':
                  setPath([]);
                  break;
                default:
                  break;
              }
              setDeliveryZoneType(val);
            }}
          />

          <div className="mt-4 flex justify-end">
            <CustomButton
              className="h-10 w-fit border-gray-300 border dark:border-dark-600 bg-black px-8 text-white"
              label={t('Save')}
              type="button"
              loading={isSubmitting}
              onClick={onLocationSubmitHandler}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default LocationBoundsCore;
