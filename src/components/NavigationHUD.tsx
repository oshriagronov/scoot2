import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { instructionText } from '../i18n/phrases';
import { useStrings } from '../i18n/strings';
import type { Instruction } from '../navigation/instructions';
import type { TrackState } from '../navigation/tracker';
import type { Route } from '../routing/router';
import { colors, MODE_STYLE, turnIcon } from './theme';

interface BannerProps {
  instructions: Instruction[];
  track: TrackState | null;
  rerouting: boolean;
  topInset: number;
}

/** Next maneuver, shown at the top of the screen while riding. */
export function ManeuverBanner({ instructions, track, rerouting, topInset }: BannerProps) {
  const { t, dir, lang, distance } = useStrings();
  const index = track?.nextIndex ?? 1;
  const next = instructions[index] ?? instructions[instructions.length - 1];
  const after = instructions[index + 1];
  const dist = track?.distanceToNext ?? next?.dist ?? 0;
  const mode = track ? currentMode(instructions, index) : instructions[0]?.mode;

  if (rerouting || track?.offRoute) {
    return (
      <View style={[styles.banner, { paddingTop: topInset + 12, backgroundColor: colors.warning }]}>
        <Text style={[styles.bannerText, dir.text]}>{t.ride.recalculating}</Text>
      </View>
    );
  }
  if (!next) return null;

  return (
    <View style={[styles.banner, { paddingTop: topInset + 12 }]}>
      <View style={[styles.bannerRow, dir.row]}>
        {/* Arrows show the real turn direction, so they are never mirrored. */}
        <MaterialCommunityIcons name={turnIcon(next.type, next.angle)} size={48} color="#fff" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerDistance, dir.text]}>{distance(dist)}</Text>
          <Text style={[styles.bannerText, dir.text]} numberOfLines={2} accessibilityLiveRegion="polite">
            {instructionText(next, lang)}
          </Text>
        </View>
      </View>
      <View style={[styles.bannerFooter, dir.row]}>
        {mode && (
          <View style={[styles.modePill, { backgroundColor: MODE_STYLE[mode].color }]}>
            <Text style={styles.modePillText}>{t.ride.now(t.modes[mode])}</Text>
          </View>
        )}
        {after && after.type !== 'arrive' && (
          <Text style={[styles.then, dir.text]} numberOfLines={1}>
            {t.ride.then(instructionText(after, lang))}
          </Text>
        )}
      </View>
    </View>
  );
}

/** Mode in effect before the instruction at `nextIndex`. */
function currentMode(instructions: Instruction[], nextIndex: number) {
  for (let i = nextIndex - 1; i >= 0; i--) {
    const m = instructions[i].mode;
    if (m && m !== 'crossing') return m;
  }
  return null;
}

/** Current time, refreshed every `intervalMs`. */
function useClock(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

interface FooterProps {
  route: Route;
  track: TrackState | null;
  muted: boolean;
  following: boolean;
  bottomInset: number;
  onToggleMute: () => void;
  onRecenter: () => void;
  onEnd: () => void;
  /** Background location was refused, so guidance stops while the phone is locked. */
  lockedScreenOff?: boolean;
}

/** Remaining distance and time, with ride controls. */
export function NavigationFooter({
  route,
  track,
  muted,
  following,
  bottomInset,
  onToggleMute,
  onRecenter,
  onEnd,
  lockedScreenOff,
}: FooterProps) {
  const { t, dir, distance, duration, time } = useStrings();
  const now = useClock(15000);
  const remaining = track?.remaining ?? route.distance;
  const remainingTime = route.distance > 0 ? (route.duration * remaining) / route.distance : 0;
  const eta = new Date(now + remainingTime * 1000);
  const arrived = track?.arrived;

  return (
    <View style={[styles.footer, { paddingBottom: bottomInset + 12 }]}>
      {!following && (
        <Pressable
          style={[styles.recenter, dir.row, dir.rtl ? { left: 16 } : { right: 16 }]}
          onPress={onRecenter}
          accessibilityLabel={t.ride.a11yRecenter}
        >
          <MaterialCommunityIcons name="crosshairs-gps" size={22} color={colors.primary} />
          <Text style={styles.recenterText}>{t.ride.recenter}</Text>
        </Pressable>
      )}
      {lockedScreenOff && (
        <Pressable style={[styles.notice, dir.row]} onPress={() => Linking.openSettings()}>
          <MaterialCommunityIcons name="lock-alert-outline" size={18} color={colors.warning} />
          <Text style={[styles.noticeText, dir.text]}>{t.ride.lockedNotice}</Text>
        </Pressable>
      )}
      <View style={[styles.footerRow, dir.row]}>
        <Pressable
          onPress={onToggleMute}
          style={styles.iconButton}
          accessibilityLabel={muted ? t.ride.a11yUnmute : t.ride.a11yMute}
        >
          <MaterialCommunityIcons name={muted ? 'volume-off' : 'volume-high'} size={26} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          {arrived ? (
            <Text style={styles.eta}>{t.ride.arrived}</Text>
          ) : (
            <>
              <Text style={styles.eta}>{time(eta)}</Text>
              <Text style={styles.remaining}>
                {duration(remainingTime)} · {distance(remaining)}
              </Text>
            </>
          )}
        </View>
        <Pressable onPress={onEnd} style={[styles.iconButton, styles.end]} accessibilityLabel={t.ride.a11yEnd}>
          <Text style={styles.endText}>{arrived ? t.ride.done : t.ride.end}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.banner,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  bannerDistance: { color: '#fff', fontSize: 30, fontWeight: '800' },
  bannerText: { color: '#e2e8f0', fontSize: 18, fontWeight: '600' },
  bannerFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  modePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  modePillText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  then: { flex: 1, color: '#94a3b8', fontSize: 14 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    marginBottom: 10,
    borderRadius: 10,
    backgroundColor: colors.warningBg,
  },
  noticeText: { flex: 1, fontSize: 13, color: colors.warning },
  iconButton: {
    height: 52,
    minWidth: 52,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  end: { backgroundColor: colors.danger },
  endText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  eta: { fontSize: 24, fontWeight: '800', color: colors.text },
  remaining: { fontSize: 15, color: colors.muted, marginTop: 2 },
  recenter: {
    position: 'absolute',
    top: -56,
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 22,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  recenterText: { color: colors.primary, fontWeight: '700' },
});
