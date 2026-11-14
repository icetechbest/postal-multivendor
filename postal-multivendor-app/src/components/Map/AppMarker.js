import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Marker } from "@maplibre/maplibre-react-native";
import { isValidLatLng, toLngLat } from "./geo";
const isAnimated = (v) => !!v && typeof v.addListener === "function";
const readNumber = (v) => {
    if (isAnimated(v)) {
        try {
            return Number(v.__getValue ? v.__getValue() : NaN);
        }
        catch {
            return NaN;
        }
    }
    return Number(v);
};
function useResolvedCoordinate(coordinate, animationDuration) {
    const [coord, setCoord] = useState(() => {
        if (!coordinate)
            return null;
        return {
            latitude: readNumber(coordinate.latitude),
            longitude: readNumber(coordinate.longitude),
        };
    });
    const current = useRef(coord);
    const raf = useRef(null);
    const apply = (c) => {
        current.current = c;
        setCoord(c);
    };
    const rawLat = coordinate?.latitude;
    const rawLng = coordinate?.longitude;
    useEffect(() => {
        if (rawLat === undefined || rawLng === undefined)
            return;
        // 1) Animated.Value pair -> follow the values
        if (isAnimated(rawLat) && isAnimated(rawLng)) {
            let lat = readNumber(rawLat);
            let lng = readNumber(rawLng);
            apply({ latitude: lat, longitude: lng });
            const a = rawLat.addListener(({ value }) => {
                lat = value;
                apply({ latitude: lat, longitude: lng });
            });
            const b = rawLng.addListener(({ value }) => {
                lng = value;
                apply({ latitude: lat, longitude: lng });
            });
            return () => {
                rawLat.removeListener(a);
                rawLng.removeListener(b);
            };
        }
        // 2) plain numbers
        const target = {
            latitude: readNumber(rawLat),
            longitude: readNumber(rawLng),
        };
        const from = current.current;
        if (!animationDuration ||
            !from ||
            !isValidLatLng(from) ||
            !isValidLatLng(target)) {
            apply(target);
            return;
        }
        const start = Date.now();
        const step = () => {
            const t = Math.min(1, (Date.now() - start) / animationDuration);
            apply({
                latitude: from.latitude + (target.latitude - from.latitude) * t,
                longitude: from.longitude + (target.longitude - from.longitude) * t,
            });
            raf.current = t < 1 ? requestAnimationFrame(step) : null;
        };
        step();
        return () => {
            if (raf.current !== null)
                cancelAnimationFrame(raf.current);
            raf.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rawLat, rawLng, animationDuration]);
    return coord;
}
/** Marker with the react-native-maps style API ({latitude, longitude}) on top of MapLibre. */
export function AppMarker({ coordinate, onPress, children, anchor = "center", offset, style, animationDuration, }) {
    const coord = useResolvedCoordinate(coordinate, animationDuration);
    if (!isValidLatLng(coord))
        return null;
    return (<Marker lngLat={toLngLat(coord)} anchor={anchor} offset={offset} onPress={onPress}>
      {/* Marker accepts exactly one child -> always wrap */}
      <View collapsable={false} style={style}>
        {children ?? <View style={styles.defaultPin}/>}
      </View>
    </Marker>);
}
/** Drop-in for `Marker.Animated` – accepts Animated.Value coordinates. */
export const AppMarkerAnimated = AppMarker;
AppMarker.Animated = AppMarker;
const styles = StyleSheet.create({
    defaultPin: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: "#E53935",
        borderWidth: 3,
        borderColor: "#fff",
    },
});
export default AppMarker;
