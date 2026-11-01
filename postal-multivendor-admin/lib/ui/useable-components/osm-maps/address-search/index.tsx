'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AutoComplete, AutoCompleteSelectEvent } from 'primereact/autocomplete';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronDown,
  faMapMarker,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';
import { useTranslations } from 'next-intl';

import { useConfiguration } from '@/lib/hooks/useConfiguration';
import { IOsmPlace, searchPlaces } from '@/lib/utils/methods/osm';

export interface IAddressSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: IOsmPlace) => void;
  placeholder?: string;
  disabled?: boolean;
}

const DEBOUNCE_MS = 500;

/**
 * Address search backed by Nominatim. Replaces the Google Places
 * AutocompleteService. Debounced (>=500ms) and throttled to 1 req/s by the
 * shared OSM helper.
 */
export default function AddressSearch({
  value,
  onChange,
  onSelect,
  placeholder,
  disabled,
}: IAddressSearchProps) {
  const t = useTranslations();
  const { GEOCODING_URL } = useConfiguration();

  const [options, setOptions] = useState<IOsmPlace[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  // Debounce the query so we do not hit Nominatim on every keystroke.
  const debouncedQuery = useMemo(() => query, [query]);

  useEffect(() => {
    if (debouncedQuery.trim().length < 3) {
      setOptions([]);
      setLoading(false);
      return;
    }

    const id = ++requestId.current;
    setLoading(true);

    const timer = setTimeout(async () => {
      const results = await searchPlaces(GEOCODING_URL, debouncedQuery);
      // Ignore stale responses.
      if (id !== requestId.current) return;
      setOptions(results);
      setLoading(false);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [debouncedQuery, GEOCODING_URL]);

  const handleSelect = (event: AutoCompleteSelectEvent) => {
    const place = event?.value as IOsmPlace | undefined;
    if (!place) return;
    onSelect(place);
    setQuery('');
  };

  return (
    <div className="relative">
      <AutoComplete
        id="osm-map"
        disabled={disabled}
        className="p h-11 w-full border border-gray-300 px-2 text-sm focus:shadow-none focus:outline-none"
        value={value}
        dropdownIcon={
          <FontAwesomeIcon
            icon={faChevronDown}
            style={{ fontSize: '1rem', color: 'gray' }}
          />
        }
        completeMethod={(event) => setQuery(event.query)}
        onChange={(e) => {
          if (typeof e.value === 'string') onChange(e.value);
        }}
        onSelect={handleSelect}
        suggestions={options}
        forceSelection={false}
        dropdown={true}
        multiple={false}
        loadingIcon={null}
        placeholder={placeholder ?? t('Search Address')}
        style={{ width: '100%' }}
        itemTemplate={(item: IOsmPlace) => (
          <div className="flex flex-col">
            <div className="flex items-center">
              <FontAwesomeIcon icon={faMapMarker} className="mr-2" />
              <span>{item.structured_formatting?.main_text}</span>
            </div>
            <small>{item.structured_formatting?.secondary_text}</small>
          </div>
        )}
      />
      {loading && (
        <div className="absolute right-16 top-0 flex h-full items-center">
          <span className="text-xs text-gray-400">…</span>
        </div>
      )}
      <div className="absolute right-8 top-0 flex h-full items-center pr-2">
        {value && (
          <FontAwesomeIcon
            icon={faTimes}
            className="mr-2 cursor-pointer text-gray-400"
            onClick={() => {
              onChange('');
              setQuery('');
            }}
          />
        )}
      </div>
    </div>
  );
}
