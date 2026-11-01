import React from 'react'
import { Platform, Text, View } from 'react-native'
import { UrlTile } from 'react-native-maps'
import useEnvVars from '../../../environment'

export const OSM_ATTRIBUTION = '© OpenStreetMap contributors'

// On Android the default provider is Google Maps, so we disable the basemap
// ("none") and render OSM tiles on top. On iOS the default is Apple Maps.
export const OSM_MAP_TYPE = Platform.OS === 'android' ? 'none' : 'standard'

// Drop-in replacement for Google basemaps: renders the configured OSM tile
// layer plus the required attribution on every map.
export default function OsmTiles({ maximumZ = 19 }) {
  const { MAP_TILE_URL } = useEnvVars()

  return (
    <>
      <UrlTile
        urlTemplate={MAP_TILE_URL}
        maximumZ={maximumZ}
        flipY={false}
        tileSize={256}
      />
      <View
        pointerEvents='none'
        style={{
          position: 'absolute',
          left: 4,
          bottom: 4,
          backgroundColor: 'rgba(255,255,255,0.7)',
          paddingHorizontal: 4,
          paddingVertical: 1,
          borderRadius: 3
        }}
      >
        <Text style={{ fontSize: 9, color: '#333' }}>{OSM_ATTRIBUTION}</Text>
      </View>
    </>
  )
}
