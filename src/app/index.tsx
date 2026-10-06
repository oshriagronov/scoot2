import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { Keyboard, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ManeuverBanner, NavigationFooter } from '../components/NavigationHUD';
import { RoutePanel } from '../components/RoutePanel';
import { RouteMap, type RouteMapHandle } from '../components/RouteMap';
import { SearchBar } from '../components/SearchBar';
import { colors } from '../components/theme';
import { useBackgroundLocation } from '../navigation/backgroundLocation';
import { useDeviceLocation } from '../navigation/useDeviceLocation';
import { useNavigation } from '../navigation/useNavigation';
import { useSimulatedRide } from '../navigation/useSimulatedRide';
import { bearing, type LatLng } from '../routing/geo';
import { reverseGeocode, type Place } from '../services/geocode';
import { useSettings } from '../state/settings';

/** Room for the maneuver banner when following the rider. */
const FOLLOW_TOP_PADDING = 260;

export default function MapScreen() {
  const { settings, update } = useSettings();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<RouteMapHandle>(null);
  const nav = useNavigation(settings);

  const simulating = settings.simulate && nav.navigating;
  // While riding, location comes from the background task so guidance survives a locked screen.
  const background = useBackgroundLocation(nav.navigating && !simulating, nav.destination?.title);
  const backgroundActive = background.mode === 'background';
  const device = useDeviceLocation(!simulating && !backgroundActive, nav.navigating);
  const simFix = useSimulatedRide(nav.route, simulating, settings.cruiseSpeed);
  const fix = simulating ? simFix : backgroundActive ? (background.fix ?? device.fix) : device.fix;
  const lat = fix?.latitude;
  const lon = fix?.longitude;
  const here = useMemo<LatLng | null>(
    () => (lat != null && lon != null ? { latitude: lat, longitude: lon } : null),
    [lat, lon],
  );

  const [following, setFollowing] = useState(true);
  /** Changing this clears the search box (by remounting it), e.g. when a pin replaces a searched place. */
  const [searchKey, setSearchKey] = useState(0);
  const centeredOnce = useRef(false);

  // Feed each position to the navigation session.
  const onFix = useEffectEvent((f: NonNullable<typeof fix>) => nav.handleFix(f));
  useEffect(() => {
    if (fix && nav.navigating) onFix(fix);
  }, [fix, nav.navigating]);

  // Center on the rider the first time we learn where they are.
  useEffect(() => {
    if (!here || centeredOnce.current) return;
    centeredOnce.current = true;
    mapRef.current?.centerOn(here, 15);
  }, [here]);

  // Follow the rider with a tilted, heading-up camera while navigating.
  useEffect(() => {
    if (!nav.navigating || !following || !fix) return;
    const center = nav.track && !nav.track.offRoute ? nav.track.snapped : fix;
    let heading = fix.heading ?? null;
    if (heading == null && nav.route && nav.track) {
      const pts = nav.route.points;
      const i = Math.min(nav.track.segmentIndex, pts.length - 2);
      heading = bearing(pts[i].latitude, pts[i].longitude, pts[i + 1].latitude, pts[i + 1].longitude);
    }
    mapRef.current?.follow(center, heading ?? 0, FOLLOW_TOP_PADDING);
  }, [fix, nav.navigating, following, nav.track, nav.route]);

  // Show the whole route when previewing it.
  useEffect(() => {
    if (!nav.route || nav.navigating) return;
    mapRef.current?.showRoute(nav.route, { top: insets.top + 120, bottom: 420 });
  }, [nav.route, nav.navigating, insets.top]);

  const selectPlace = (place: Place) => {
    Keyboard.dismiss();
    nav.chooseDestination(place, here);
  };

  const onLongPress = async (p: LatLng) => {
    if (nav.navigating) return;
    const pin: Place = { id: `pin-${Date.now()}`, title: 'Dropped pin', subtitle: '', location: p };
    setSearchKey((k) => k + 1);
    selectPlace(pin);
    const named = await reverseGeocode(p, settings.voiceLanguage).catch(() => null);
    if (named) nav.renameDestination({ ...named, location: p });
  };

  const recenter = () => {
    setFollowing(true);
    if (here && !nav.navigating) mapRef.current?.centerOn(here, 16);
  };

  const endNavigation = () => {
    nav.stop();
    // Otherwise the route preview effect frames the remaining route again.
    if (nav.track?.arrived) {
      nav.clear();
      if (here) mapRef.current?.centerOn(here, 16);
    }
  };

  return (
    <View style={styles.container}>
      <RouteMap
        ref={mapRef}
        route={nav.route}
        destination={nav.destination?.location ?? null}
        simulatedFix={simulating ? simFix : null}
        navigating={nav.navigating}
        onLongPress={onLongPress}
        onUserPan={() => nav.navigating && setFollowing(false)}
      />

      {nav.navigating && nav.route ? (
        <>
          <ManeuverBanner
            instructions={nav.instructions}
            track={nav.track}
            rerouting={nav.rerouting}
            language={settings.voiceLanguage}
            topInset={insets.top}
          />
          <NavigationFooter
            route={nav.route}
            track={nav.track}
            muted={!settings.voiceEnabled}
            following={following}
            bottomInset={insets.bottom}
            onToggleMute={() => update({ voiceEnabled: !settings.voiceEnabled })}
            onRecenter={recenter}
            onEnd={endNavigation}
            lockedScreenOff={!simulating && background.mode === 'foreground'}
          />
        </>
      ) : (
        <>
          <View style={[styles.top, { top: insets.top + 8 }]}>
            <SearchBar
              key={searchKey}
              near={here}
              language={settings.voiceLanguage}
              onSelect={selectPlace}
              onOpenSettings={() => router.push('/settings')}
              hint={nav.destination ? undefined : 'Search for a place, or long-press the map to drop a pin'}
            />
            {device.permission === 'denied' && (
              <Pressable style={styles.permission} onPress={() => Linking.openSettings()}>
                <MaterialCommunityIcons name="map-marker-off" size={18} color={colors.warning} />
                <Text style={styles.permissionText}>
                  Location is off. Tap to allow it so the app can guide you.
                </Text>
              </Pressable>
            )}
          </View>

          {!nav.destination && (
            <Pressable
              style={[styles.fab, { bottom: insets.bottom + 28 }]}
              onPress={recenter}
              accessibilityLabel="Show my location"
            >
              <MaterialCommunityIcons name="crosshairs-gps" size={24} color={colors.primary} />
            </Pressable>
          )}

          {nav.destination && (
            <RoutePanel
              destination={nav.destination}
              route={nav.route}
              planning={nav.planning}
              error={nav.error}
              profileLabel={settings.profile === 'safest' ? 'Safest' : 'Fastest'}
              bottomInset={insets.bottom}
              onStart={() => {
                setFollowing(true);
                nav.start();
              }}
              onClose={nav.clear}
              onRetry={() => here && nav.retry(here)}
            />
          )}
        </>
      )}

      <Text
        style={[
          styles.attribution,
          nav.navigating
            ? { top: insets.top + 170, right: 8 }
            : nav.destination
              ? { top: insets.top + 64, right: 8 }
              : { bottom: insets.bottom + 4, right: 8 },
        ]}
      >
        Routing data © OpenStreetMap contributors
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e5e7eb' },
  top: { position: 'absolute', left: 0, right: 0 },
  permission: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.warningBg,
  },
  permissionText: { flex: 1, color: colors.warning, fontSize: 14 },
  fab: {
    position: 'absolute',
    right: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  attribution: {
    position: 'absolute',
    fontSize: 10,
    color: '#334155',
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 4,
    borderRadius: 3,
    overflow: 'hidden',
  },
});
