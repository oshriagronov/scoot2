import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { Keyboard, Linking, Pressable, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassButton } from '../components/controls';
import { Glass } from '../components/Glass';
import { ManeuverBanner, NavigationFooter } from '../components/NavigationHUD';
import { RoutePanel } from '../components/RoutePanel';
import { RouteMap, type RouteMapHandle } from '../components/RouteMap';
import { SearchBar } from '../components/SearchBar';
import { themed } from '../components/theme';
import { useStrings } from '../i18n/strings';
import { useBackgroundLocation } from '../navigation/backgroundLocation';
import { useDeviceLocation } from '../navigation/useDeviceLocation';
import { useSpeedometer } from '../navigation/speedometer';
import { useNavigation } from '../navigation/useNavigation';
import { useSimulatedRide } from '../navigation/useSimulatedRide';
import { CRUISE_SPEED_KMH } from '../routing/cost';
import { bearing, type LatLng } from '../routing/geo';
import { reverseGeocode, type Place } from '../services/geocode';
import { useSettings } from '../state/settings';

/** Room for the maneuver banner when following the rider. */
const FOLLOW_TOP_PADDING = 260;

export default function MapScreen() {
  const { settings, update } = useSettings();
  const insets = useSafeAreaInsets();
  const darkMode = useColorScheme() === 'dark';
  const { c, styles } = useStyles();
  const mapRef = useRef<RouteMapHandle>(null);
  const nav = useNavigation(settings);

  const simulating = settings.simulate && nav.navigating;
  // While riding, location comes from the background task so guidance survives a locked screen.
  const { t, dir } = useStrings();
  const background = useBackgroundLocation(nav.navigating && !simulating, {
    title: t.ride.notificationTitle,
    body: nav.destination ? t.ride.notificationTo(nav.destination.title) : t.ride.notificationVoice,
  });
  const backgroundActive = background.mode === 'background';
  const device = useDeviceLocation(!simulating && !backgroundActive, nav.navigating);
  const simFix = useSimulatedRide(nav.route, simulating, CRUISE_SPEED_KMH);
  const fix = simulating ? simFix : backgroundActive ? (background.fix ?? device.fix) : device.fix;
  const speed = useSpeedometer(nav.navigating ? fix : null);
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
    mapRef.current?.showRoute(nav.route, { top: insets.top + 60, bottom: 470 });
  }, [nav.route, nav.navigating, insets.top]);

  const selectPlace = (place: Place) => {
    Keyboard.dismiss();
    nav.chooseDestination(place, here);
  };

  const onLongPress = async (p: LatLng) => {
    if (nav.navigating) return;
    const pin: Place = { id: `pin-${Date.now()}`, title: t.map.droppedPin, subtitle: '', location: p };
    setSearchKey((k) => k + 1);
    selectPlace(pin);
    const named = await reverseGeocode(p, settings.language).catch(() => null);
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
      <StatusBar style={darkMode ? 'light' : 'dark'} />
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
            topInset={insets.top}
          />
          <NavigationFooter
            route={nav.route}
            track={nav.track}
            muted={!settings.voiceEnabled}
            following={following}
            speed={speed}
            bottomInset={insets.bottom}
            onToggleMute={() => update({ voiceEnabled: !settings.voiceEnabled })}
            onRecenter={recenter}
            onEnd={endNavigation}
            lockedScreenOff={!simulating && background.mode === 'foreground'}
          />
        </>
      ) : (
        <>
          {!nav.destination && (
            <View style={[styles.top, { top: insets.top + 8 }]}>
              <SearchBar
                key={searchKey}
                near={here}
                onSelect={selectPlace}
                onOpenSettings={() => router.push('/settings')}
                hint={t.search.hint}
              />
              {device.permission === 'denied' && (
                <Pressable onPress={() => Linking.openSettings()} style={styles.permissionWrap}>
                  <Glass style={[styles.permission, dir.row]}>
                    <MaterialCommunityIcons name="map-marker-off-outline" size={18} color={c.cautionIcon} />
                    <Text style={[styles.permissionText, dir.text]}>{t.map.locationOff}</Text>
                  </Glass>
                </Pressable>
              )}
            </View>
          )}

          {!nav.destination && (
            <GlassButton
              size={56}
              onPress={recenter}
              accessibilityLabel={t.map.a11yMyLocation}
              style={[styles.fab, { bottom: insets.bottom + 28 }, dir.rtl ? { left: 16 } : { right: 16 }]}
            >
              <MaterialCommunityIcons name="near-me" size={24} color={c.accent} />
            </GlassButton>
          )}

          {nav.destination && (
            <RoutePanel
              destination={nav.destination}
              route={nav.route}
              planning={nav.planning}
              error={nav.error}
              profile={settings.profile}
              bottomInset={insets.bottom}
              onProfileChange={(profile) => update({ profile })}
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
            ? [darkMode && styles.attributionNight, { top: insets.top + 215 }, dir.rtl ? { right: 16 } : { left: 16 }]
            : nav.destination
              ? { top: insets.top + 12, right: 16 }
              : { bottom: insets.bottom + 4, right: 16 },
        ]}
      >
        {t.map.attribution}
      </Text>
    </View>
  );
}

const useStyles = themed((c) => ({
  container: { flex: 1, backgroundColor: c.mapGround },
  top: { position: 'absolute', left: 0, right: 0, gap: 10 },
  permissionWrap: { marginHorizontal: 16 },
  permission: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  permissionText: { flex: 1, color: c.caution, fontSize: 14, lineHeight: 19 },
  fab: { position: 'absolute' },
  attribution: {
    position: 'absolute',
    fontSize: 10.5,
    color: c.secondary,
    backgroundColor: c.attributionBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  attributionNight: { color: 'rgba(255,255,255,0.55)', backgroundColor: 'transparent', paddingHorizontal: 0 },
}));
