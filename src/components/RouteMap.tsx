import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  NativeUserLocation,
  type CameraRef,
  type LngLat,
} from '@maplibre/maplibre-react-native';
import { useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import type { DeviceFix } from '../navigation/useDeviceLocation';
import type { LatLng } from '../routing/geo';
import type { Route } from '../routing/router';
import { LIGHT, MODE_STYLE } from './theme';

/**
 * Free OpenStreetMap vector map from OpenFreeMap: no account, no API key, no usage limits.
 * The same data the routes are planned on, so bike lanes on screen match the route.
 */
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
/** Night map for dark mode. */
const DARK_MAP_STYLE = 'https://tiles.openfreemap.org/styles/dark';

/** Shown until the first location fix arrives (Tel Aviv). */
const INITIAL_CENTER: LngLat = [34.7818, 32.0853];

const FOLLOW_ZOOM = 17.5;
const FOLLOW_PITCH = 50;

const lngLat = (p: LatLng): LngLat => [p.longitude, p.latitude];

export interface RouteMapHandle {
  /** Heading-up, tilted camera that follows the rider. */
  follow(center: LatLng, heading: number, topPadding: number): void;
  /** Frames the whole route between the given screen insets. */
  showRoute(route: Route, padding: { top: number; bottom: number }): void;
  /** North-up view centred on a point. */
  centerOn(point: LatLng, zoom: number): void;
}

interface Props {
  route: Route | null;
  destination: LatLng | null;
  /** Position to draw as a navigation arrow (simulated rides); otherwise the device dot is shown. */
  simulatedFix: DeviceFix | null;
  navigating: boolean;
  onLongPress: (p: LatLng) => void;
  /** The rider moved the map by hand (stop following). */
  onUserPan: () => void;
  ref?: Ref<RouteMapHandle>;
}

export function RouteMap({ route, destination, simulatedFix, navigating, onLongPress, onUserPan, ref }: Props) {
  const camera = useRef<CameraRef>(null);
  const night = useColorScheme() === 'dark';

  useImperativeHandle(
    ref,
    () => ({
      follow(center, heading, topPadding) {
        camera.current?.easeTo({
          center: lngLat(center),
          bearing: heading,
          pitch: FOLLOW_PITCH,
          zoom: FOLLOW_ZOOM,
          // Push the rider towards the bottom so more of the road ahead is visible.
          padding: { top: topPadding, bottom: 0, left: 0, right: 0 },
          duration: 900,
          easing: 'linear',
        });
      },
      showRoute(r, padding) {
        let west = Infinity;
        let south = Infinity;
        let east = -Infinity;
        let north = -Infinity;
        for (const p of r.points) {
          west = Math.min(west, p.longitude);
          east = Math.max(east, p.longitude);
          south = Math.min(south, p.latitude);
          north = Math.max(north, p.latitude);
        }
        camera.current?.fitBounds([west, south, east, north], {
          padding: { top: padding.top, bottom: padding.bottom, left: 40, right: 40 },
          bearing: 0,
          pitch: 0,
          duration: 700,
        });
      },
      centerOn(point, zoom) {
        camera.current?.flyTo({ center: lngLat(point), zoom, bearing: 0, pitch: 0, duration: 600 });
      },
    }),
    [],
  );

  const routeShape = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      // A line needs two distinct points; skip zero-length pieces (e.g. starting exactly on a node).
      features: (route?.segments ?? [])
        .filter((seg) => new Set(seg.coordinates.map((c) => `${c.latitude},${c.longitude}`)).size > 1)
        .map((seg) => ({
        type: 'Feature',
        properties: { color: MODE_STYLE[seg.mode].color, dashed: !!MODE_STYLE[seg.mode].dashed },
        geometry: { type: 'LineString', coordinates: seg.coordinates.map(lngLat) },
      })),
    }),
    [route],
  );

  return (
    <Map
      style={StyleSheet.absoluteFill}
      mapStyle={night ? DARK_MAP_STYLE : MAP_STYLE}
      logo={false}
      compass={!navigating}
      compassPosition={{ top: 190, right: 16 }}
      // OpenFreeMap and OpenStreetMap require attribution; this shows the map's credits button.
      attribution
      attributionPosition={{ bottom: 4, left: 8 }}
      onLongPress={(e) => {
        const [longitude, latitude] = e.nativeEvent.lngLat;
        onLongPress({ latitude, longitude });
      }}
      onRegionWillChange={(e) => {
        if (e.nativeEvent.userInteraction) onUserPan();
      }}
    >
      <Camera ref={camera} initialViewState={{ center: INITIAL_CENTER, zoom: 11 }} />

      {!simulatedFix && <NativeUserLocation mode={navigating ? 'course' : 'default'} />}

      {route && (
        <GeoJSONSource id="route" data={routeShape} lineMetrics={false}>
          <Layer
            id="route-casing"
            type="line"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{ 'line-color': night ? '#0B0C0F' : '#ffffff', 'line-width': 11 }}
          />
          <Layer
            id="route-line"
            type="line"
            filter={['!', ['get', 'dashed']]}
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{ 'line-color': ['get', 'color'], 'line-width': 7 }}
          />
          <Layer
            id="route-walk"
            type="line"
            filter={['get', 'dashed']}
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{ 'line-color': ['get', 'color'], 'line-width': 5, 'line-dasharray': [1, 1.5] }}
          />
        </GeoJSONSource>
      )}

      {destination && (
        <Marker id="destination" lngLat={lngLat(destination)} anchor="bottom">
          <View style={styles.pin}>
            <View style={styles.pinHead}>
              <View style={styles.pinDot} />
            </View>
            <View style={styles.pinStem} />
          </View>
        </Marker>
      )}

      {simulatedFix && (
        <Marker id="simulated-rider" lngLat={lngLat(simulatedFix)} anchor="center">
          {/* The camera turns with the rider, so the arrow always points up. */}
          <View style={styles.simDot}>
            <MaterialCommunityIcons name="navigation" size={20} color="#fff" />
          </View>
        </Marker>
      )}
    </Map>
  );
}

const styles = StyleSheet.create({
  simDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: LIGHT.accent,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  pin: { alignItems: 'center' },
  pinHead: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: LIGHT.ink,
    borderWidth: 2.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  pinDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#fff' },
  pinStem: { width: 3, height: 10, marginTop: -1, borderRadius: 1.5, backgroundColor: LIGHT.ink },
});
