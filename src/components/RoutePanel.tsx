import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useStrings } from '../i18n/strings';
import type { RouteErrorCode } from '../navigation/useNavigation';
import type { RouteProfile } from '../routing/cost';
import type { TravelMode } from '../routing/rules';
import type { Route } from '../routing/router';
import type { Place } from '../services/geocode';
import { Segmented } from './controls';
import { Glass } from './Glass';
import { useClock } from './useClock';
import { MODE_STYLE, themed } from './theme';

interface Props {
  destination: Place;
  route: Route | null;
  planning: boolean;
  error: RouteErrorCode | null;
  profile: RouteProfile;
  bottomInset: number;
  onProfileChange: (profile: RouteProfile) => void;
  onStart: () => void;
  onClose: () => void;
  onRetry: () => void;
}

const MODE_ORDER: TravelMode[] = ['bike_lane', 'road_lane', 'shared_path', 'road', 'sidewalk', 'crossing'];

/** Floating sheet with the chosen place, the route summary and the Start button. */
export function RoutePanel({
  destination,
  route,
  planning,
  error,
  profile,
  bottomInset,
  onProfileChange,
  onStart,
  onClose,
  onRetry,
}: Props) {
  const { t, dir, distance, duration, time, errorText } = useStrings();
  const now = useClock(15000);
  const { c, styles } = useStyles();
  return (
    <Glass variant="thick" style={[styles.panel, { paddingBottom: Math.max(bottomInset - 8, 16) }]}>
      <View style={styles.grabber} />

      <View style={[styles.header, dir.row]}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.title, dir.text]} numberOfLines={1}>
            {destination.title}
          </Text>
          {!!destination.subtitle && (
            <Text style={[styles.subtitle, dir.text]} numberOfLines={1}>
              {destination.subtitle}
            </Text>
          )}
        </View>
        <Pressable onPress={onClose} hitSlop={8} style={styles.close} accessibilityLabel={t.route.a11yClose}>
          <MaterialCommunityIcons name="close" size={18} color={c.secondary} />
        </Pressable>
      </View>

      <Segmented<RouteProfile>
        options={[
          { value: 'safest', label: t.route.safest },
          { value: 'fastest', label: t.route.fastest },
        ]}
        value={profile}
        onChange={onProfileChange}
        dir={dir}
      />

      {planning && (
        <View style={[styles.status, dir.row]}>
          <ActivityIndicator color={c.ink} />
          <Text style={[styles.statusText, dir.text, { flex: 1 }]}>{t.route.planning}</Text>
        </View>
      )}

      {!planning && error && (
        <View style={[styles.status, dir.row]}>
          <Text style={[styles.statusText, dir.text, { color: c.danger, flex: 1 }]}>{errorText(error)}</Text>
          <Pressable onPress={onRetry} style={styles.retry}>
            <Text style={styles.retryText}>{t.route.retry}</Text>
          </Pressable>
        </View>
      )}

      {!planning && !error && route && (
        <>
          <View style={[styles.summary, dir.row]}>
            <Text style={styles.duration}>{duration(route.duration)}</Text>
            <Text style={styles.distance}>{distance(route.distance)}</Text>
            <View style={{ flex: 1 }} />
            <Text style={styles.distance}>{t.route.arrive(time(new Date(now + route.duration * 1000)))}</Text>
          </View>

          <View style={{ gap: 12 }}>
            <View style={[styles.bar, dir.row]}>
              {MODE_ORDER.map((m) => {
                const meters = route.byMode[m] ?? 0;
                if (meters <= 0) return null;
                return <View key={m} style={[styles.barPart, { flex: meters, backgroundColor: MODE_STYLE[m].color }]} />;
              })}
            </View>
            <View style={[styles.legend, dir.row]}>
              {MODE_ORDER.map((m) => {
                const meters = route.byMode[m] ?? 0;
                if (meters < 1) return null;
                return (
                  <View key={m} style={[styles.legendItem, dir.row]}>
                    <View style={[styles.dot, { backgroundColor: MODE_STYLE[m].color }]} />
                    <Text style={styles.legendText}>{t.modes[m]}</Text>
                    <Text style={styles.legendDistance}>{distance(meters)}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {route.inferredSpeedMeters > 50 && (
            <View style={[styles.warning, dir.row]}>
              <MaterialCommunityIcons name="alert-outline" size={18} color={c.cautionIcon} />
              <Text style={[styles.warningText, dir.text]}>
                {t.route.inferredSpeed(distance(route.inferredSpeedMeters))}
              </Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [styles.start, dir.row, pressed && styles.startPressed]}
            onPress={onStart}
            accessibilityLabel={t.route.a11yStart}
          >
            <MaterialCommunityIcons name="navigation-variant" size={22} color={c.onInk} />
            <Text style={styles.startText}>{t.route.start}</Text>
          </Pressable>
        </>
      )}
    </Glass>
  );
}

const useStyles = themed((c) => ({
  panel: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    borderRadius: 40,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 16,
  },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: c.grabber },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { fontSize: 21, fontWeight: '700', letterSpacing: -0.2, color: c.text },
  subtitle: { fontSize: 14, color: c.muted },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: c.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  statusText: { fontSize: 15, lineHeight: 21, color: c.muted },
  retry: { paddingHorizontal: 16, height: 36, justifyContent: 'center', borderRadius: 18, backgroundColor: c.fill },
  retryText: { color: c.ink, fontWeight: '600', fontSize: 15 },
  summary: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  duration: { fontSize: 38, fontWeight: '700', letterSpacing: -0.8, color: c.text, fontVariant: ['tabular-nums'] },
  distance: { fontSize: 16, color: c.muted, fontVariant: ['tabular-nums'] },
  bar: { flexDirection: 'row', height: 6, gap: 3 },
  barPart: { borderRadius: 3 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 13, color: c.text },
  legendDistance: { fontSize: 13, color: c.muted, fontVariant: ['tabular-nums'] },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: c.cautionBg,
  },
  warningText: { flex: 1, fontSize: 13, lineHeight: 18, color: c.caution },
  start: {
    height: 58,
    borderRadius: 29,
    backgroundColor: c.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  startPressed: { transform: [{ scale: 0.98 }], backgroundColor: c.inkPressed },
  startText: { color: c.onInk, fontSize: 18, fontWeight: '600' },
}));
