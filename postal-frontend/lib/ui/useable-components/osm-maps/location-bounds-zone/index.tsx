'use client';

import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';

import L from 'leaflet';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MapContainer,
  Marker,
  Polygon,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { useTranslations } from 'next-intl';

import { useConfiguration } from '@/lib/hooks/useConfiguration';
import { ILocationPoint } from '@/lib/utils/interfaces';
import {
  calculatePolygonCentroid,
  transformPath,
  transformPolygon,
} from '@/lib/utils/methods';
import { IOsmPlace } from '@/lib/utils/methods/osm';
import { DEFAULT_CENTER, DEFAULT_POLYGON } from '@/lib/utils/constants';
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

function MapFocus({ path }: { path: ILocationPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (!path.length) return;
    if (path.length === 1) {
      map.setView([path[0].lat, path[0].lng], 17);
      return;
    }
    const bounds = L.latLngBounds(path.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path.length, path[0]?.lat, path[0]?.lng]);

  return null;
}

export interface ILocationBoundsZoneCoreProps {
  _id?: string;
  _path?: number[][][];
  onSetZoneCoordinates: (path: number[][][]) => void;
}

const LocationBoundsZoneCore: React.FC<ILocationBoundsZoneCoreProps> = ({
  _path,
  onSetZoneCoordinates,
}) => {
  const t = useTranslations();
  const { MAP_TILE_URL } = useConfiguration();

  const [isMounted, setIsMounted] = useState(false);
  const [deliveryZoneType, setDeliveryZoneType] = useState('polygon');
  const [center, setCenter] = useState<ILocationPoint>(DEFAULT_CENTER);
  const [path, setPath] = useState<ILocationPoint[]>(DEFAULT_POLYGON);
  const [inputValue, setInputValue] = useState('');
  const [lastSelectedLocation, setLastSelectedLocation] =
    useState<ILocationPoint | null>(null);

  const polygonRef = useRef<PmPolygon | null>(null);

  const createPolygonAroundPoint = (
    centerPoint: ILocationPoint,
    sizeMeters = 100
  ): ILocationPoint[] => {
    const latOffset = sizeMeters * 0.0000089;
    const lngOffset =
      (sizeMeters * 0.0000089) / Math.cos((centerPoint.lat * Math.PI) / 180);
    return [
      { lat: centerPoint.lat + latOffset, lng: centerPoint.lng - lngOffset },
      { lat: centerPoint.lat + latOffset, lng: centerPoint.lng + lngOffset },
      { lat: centerPoint.lat - latOffset, lng: centerPoint.lng + lngOffset },
      { lat: centerPoint.lat - latOffset, lng: centerPoint.lng - lngOffset },
      { lat: centerPoint.lat + latOffset, lng: centerPoint.lng - lngOffset },
    ];
  };

  const onSelectPlace = (place: IOsmPlace) => {
    const centerPoint = { lat: place.lat, lng: place.lng };
    setCenter(centerPoint);
    setLastSelectedLocation(centerPoint);

    if (deliveryZoneType === 'polygon') {
      setPath(createPolygonAroundPoint(centerPoint));
    } else if (deliveryZoneType === 'point') {
      setPath([centerPoint]);
    } else {
      setPath([]);
    }

    setInputValue(place.description);
  };

  const onMapClick = (point: ILocationPoint) => {
    // A single-point zone is not a valid GeoJSON polygon, so a click in
    // "point" mode replaces the point instead of appending a vertex.
    if (deliveryZoneType === 'point') {
      setPath([point]);
      return;
    }
    setPath((prev) => [...prev, point]);
  };

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
      const centroid = calculatePolygonCentroid(
        nextPath.map((point) => [point.lng, point.lat])
      );
      if (centroid.lat !== 0 || centroid.lng !== 0) {
        setCenter(centroid);
      }
    }
  }, []);

  const isPolygonMounted = path.length > 1;

  useEffect(() => {
    const polygon = polygonRef.current;
    if (!polygon) return;

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
  }, [isPolygonMounted, syncPathFromPolygon]);

  // Push coordinates up to the form.
  useEffect(() => {
    if (!isMounted) return;
    onSetZoneCoordinates(transformPath(path ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, isMounted]);

  useEffect(() => {
    if (
      Array.isArray(_path) &&
      _path.length > 0 &&
      Array.isArray(_path[0]) &&
      _path[0].length > 0 &&
      _path[0][0].length > 0
    ) {
      setPath(transformPolygon(_path[0]));
      setCenter(calculatePolygonCentroid(_path[0]));
    }
    setIsMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="relative overflow-hidden">
        <div className="h-[600px] w-full object-cover">
          <div className="absolute left-0 right-0 top-0 z-[1000]">
            <div className="flex w-full flex-col justify-center gap-y-1 p-2">
              <AddressSearch
                value={inputValue}
                onChange={setInputValue}
                onSelect={onSelectPlace}
                placeholder={t('Enter your full address')}
              />
            </div>
          </div>

          <MapContainer
            center={[center.lat, center.lng]}
            zoom={14}
            style={{ height: '100%', width: '100%', borderRadius: 10 }}
          >
            <TileLayer
              url={MAP_TILE_URL}
              maxZoom={19}
              attribution="&copy; OpenStreetMap contributors"
            />
            <MapFocus path={path} />
            <MapClickHandler
              enabled={deliveryZoneType === 'point'}
              onClick={onMapClick}
            />

            {path.length > 1 && (
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

            {deliveryZoneType === 'point' && path.length === 1 && (
              <Marker
                position={[path[0].lat, path[0].lng]}
                icon={markerIcon}
                draggable
                eventHandlers={{
                  dragend: (event) => {
                    const latLng = (event.target as L.Marker).getLatLng();
                    setPath([{ lat: latLng.lat, lng: latLng.lng }]);
                  },
                }}
              />
            )}
          </MapContainer>
        </div>
      </div>

      <CustomShape
        selected={deliveryZoneType}
        hidenNames={['radius', 'point']}
        onClick={(val: string) => {
          setDeliveryZoneType(val);
          if (lastSelectedLocation) {
            if (val === 'polygon') {
              setPath(createPolygonAroundPoint(lastSelectedLocation));
            } else if (val === 'point') {
              setPath([lastSelectedLocation]);
            }
          } else {
            switch (val) {
              case 'polygon':
                setPath(DEFAULT_POLYGON);
                break;
              case 'point':
                setPath([]);
                break;
              default:
                break;
            }
          }
        }}
      />
    </div>
  );
};

export default LocationBoundsZoneCore;
