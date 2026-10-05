import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDistanceShort, formatDuration } from '../i18n/phrases';
import type { TravelMode } from '../routing/rules';
import type { Route } from '../routing/router';
import type { Place } from '../services/geocode';
import { colors, MODE_STYLE } from './theme';

interface Props {
  destination: Place;
  route: Route | null;
  planning: boolean;
  error: string | null;
  profileLabel: string;
  bottomInset: number;
  onStart: () => void;
  onClose: () => void;
  onRetry: () => void;
}

const MODE_ORDER: TravelMode[] = ['bike_lane', 'road_lane', 'shared_path', 'road', 'sidewalk', 'crossing'];

export function RoutePanel({
  destination,
  route,
  planning,
  error,
  profileLabel,
  bottomInset,
  onStart,
  onClose,
  onRetry,
}: Props) {
  return (
    <View style={[styles.panel, { paddingBottom: bottomInset + 14 }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {destination.title}
          </Text>
          {!!destination.subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {destination.subtitle}
            </Text>
          )}
        </View>
        <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close route">
          <MaterialCommunityIcons name="close" size={24} color={colors.muted} />
        </Pressable>
      </View>

      {planning && (
        <View style={styles.status}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.statusText, { flex: 1 }]}>
            Finding the best legal route… The first search in an area downloads street data and can take up to a minute.
          </Text>
        </View>
      )}

      {!planning && error && (
        <View style={styles.status}>
          <Text style={[styles.statusText, { color: colors.danger, flex: 1 }]}>{error}</Text>
          <Pressable onPress={onRetry} style={styles.retry}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {!planning && !error && route && (
        <>
          <View style={styles.summary}>
            <Text style={styles.duration}>{formatDuration(route.duration)}</Text>
            <Text style={styles.distance}>
              {formatDistanceShort(route.distance)} · {profileLabel}
            </Text>
          </View>

          <View style={styles.bar}>
            {MODE_ORDER.map((m) => {
              const meters = route.byMode[m] ?? 0;
              if (meters <= 0) return null;
              return <View key={m} style={{ flex: meters, backgroundColor: MODE_STYLE[m].color }} />;
            })}
          </View>
          <View style={styles.legend}>
            {MODE_ORDER.map((m) => {
              const meters = route.byMode[m] ?? 0;
              if (meters < 1) return null;
              return (
                <View key={m} style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: MODE_STYLE[m].color }]} />
                  <Text style={styles.legendText}>
                    {MODE_STYLE[m].label} {formatDistanceShort(meters)}
                  </Text>
                </View>
              );
            })}
          </View>

          {route.inferredSpeedMeters > 50 && (
            <View style={styles.warning}>
              <MaterialCommunityIcons name="alert-outline" size={18} color={colors.warning} />
              <Text style={styles.warningText}>
                {formatDistanceShort(route.inferredSpeedMeters)} on roads without a speed limit in the map
                data. Check the signs as you ride.
              </Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [styles.start, pressed && { backgroundColor: colors.primaryDark }]}
            onPress={onStart}
            accessibilityLabel="Start navigation"
          >
            <MaterialCommunityIcons name="navigation" size={22} color="#fff" />
            <Text style={styles.startText}>Start</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { fontSize: 19, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 2 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 18 },
  statusText: { fontSize: 15, color: colors.muted },
  retry: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f1f5f9' },
  retryText: { color: colors.primary, fontWeight: '600' },
  summary: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 14 },
  duration: { fontSize: 26, fontWeight: '800', color: colors.primary },
  distance: { fontSize: 16, color: colors.muted },
  bar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 12,
    backgroundColor: colors.border,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 13, color: colors.text },
  warning: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.warningBg,
  },
  warningText: { flex: 1, fontSize: 13, color: colors.warning },
  start: {
    marginTop: 16,
    height: 54,
    borderRadius: 14,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
