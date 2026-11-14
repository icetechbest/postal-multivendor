'use client';

import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';

import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import { useEffect, useMemo, useRef, useState } from 'react';
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

function MapFocus({
  path,
  version,
}: {
  path: ILocationPoint[];
  version: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!path.length) return;
    if (path.length === 1) {
      map.setView([path[0].lat, path[0].lng], 17);
      return;
    }
    const bounds = L.latLngBounds(
      path.map((p) => [p.lat, p.lng] as [number, number])
    );
    map.fitBounds(bounds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  return null;
}

// Editable polygon. Lives inside <MapContainer>, so it only mounts once the
// map exists and geoman can be enabled on the real layer. The polygon is
// remounted (key=version) only when the path changes from outside (search,
// shape switch); user edits are reported through onChange without touching
// the layer's positions, so geoman's edit handles are never reset.
function EditablePolygon({
  positions,
  version,
  onChange,
}: {
  positions: ILocationPoint[];
  version: number;
  onChange: (path: ILocationPoint[]) => void;
}) {
  const polygonRef = useRef<PmPolygon | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initial = useMemo(
    () => positions.map((point) => [point.lat, point.lng] as [number, number]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version]
  );

  useEffect(() => {
    const polygon = polygonRef.current;
    if (!polygon || !polygon.pm) return;

    const sync = () => {
      const latlngs = polygon.getLatLngs()[0] as L.LatLng[];
      onChangeRef.current(
        latlngs.map((latLng) => ({ lat: latLng.lat, lng: latLng.lng }))
      );
    };

    polygon.pm.enable({ allowSelfIntersection: false, snappable: true });
    polygon.pm.enableLayerDrag();

    polygon.on('pm:edit', sync);
    polygon.on('pm:vertexadded', sync);
    polygon.on('pm:vertexremoved', sync);
    polygon.on('pm:dragend', sync);

    return () => {
      polygon.off('pm:edit', sync);
      polygon.off('pm:vertexadded', sync);
      polygon.off('pm:vertexremoved', sync);
      polygon.off('pm:dragend', sync);
      polygon.pm.disable();
    };
  }, [version]);

  return (
    <Polygon
      key={version}
      ref={(instance) => {
        polygonRef.current = (instance as unknown as PmPolygon) ?? null;
      }}
      positions={initial}
      pathOptions={{
        color: 'black',
        weight: 2,
        fillColor: '#000000',
        fillOpacity: 0.35,
      }}
    />
  );
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

  const [version, setVersion] = useState(0);

  // Path changed from outside (search, shape switch, initial load): remount polygon + refocus
  const setPathExternal = (next: ILocationPoint[]) => {
    setPath(next);
    setVersion((v) => v + 1);
  };

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
      setPathExternal(createPolygonAroundPoint(centerPoint));
    } else if (deliveryZoneType === 'point') {
      setPathExternal([centerPoint]);
    } else {
      setPathExternal([]);
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
      setPathExternal(transformPolygon(_path[0]));
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
            <MapFocus path={path} version={version} />
            <MapClickHandler
              enabled={deliveryZoneType === 'point'}
              onClick={onMapClick}
            />

            {path.length > 1 && (
              <EditablePolygon
                positions={path}
                version={version}
                onChange={setPath}
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
              setPathExternal(createPolygonAroundPoint(lastSelectedLocation));
            } else if (val === 'point') {
              setPathExternal([lastSelectedLocation]);
            }
          } else {
            switch (val) {
              case 'polygon':
                setPathExternal(DEFAULT_POLYGON);
                break;
              case 'point':
                setPathExternal([]);
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
