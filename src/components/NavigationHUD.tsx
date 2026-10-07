import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { instructionText } from '../i18n/phrases';
import { useStrings } from '../i18n/strings';
import type { Instruction } from '../navigation/instructions';
import type { TrackState } from '../navigation/tracker';
import type { Route } from '../routing/router';
import { Glass } from './Glass';
import { useClock } from './useClock';
import { colors, MODE_STYLE, RIDE_DAY, RIDE_NIGHT, turnIcon, type RidePalette } from './theme';

interface BannerProps {
  instructions: Instruction[];
  track: TrackState | null;
  rerouting: boolean;
  topInset: number;
}

/** Next maneuver, shown at the top of the screen while riding. */
export function ManeuverBanner({ instructions, track, rerouting, topInset }: BannerProps) {
  const { t, dir, lang, distance } = useStrings();
  const { p, styles } = useRideStyle();
  const index = track?.nextIndex ?? 1;
  const next = instructions[index] ?? instructions[instructions.length - 1];
  const after = instructions[index + 1];
  const dist = track?.distanceToNext ?? next?.dist ?? 0;
  const mode = track ? currentMode(instructions, index) : instructions[0]?.mode;

  if (rerouting || track?.offRoute) {
    return (
      <Glass variant={p.glass} style={[styles.banner, styles.bannerCompact, dir.row, { top: topInset + 4 }]}>
        <ActivityIndicator color={p.caution} />
        <Text style={[styles.bannerText, dir.text, { flex: 1, color: p.text }]}>{t.ride.recalculating}</Text>
      </Glass>
    );
  }
  if (!next) return null;

  return (
    <Glass variant={p.glass} style={[styles.banner, { top: topInset + 4 }]}>
      <View style={[styles.bannerRow, dir.row]}>
        {/* Arrows show the real turn direction, so they are never mirrored. */}
        <MaterialCommunityIcons name={turnIcon(next.type, next.angle)} size={56} color={p.text} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerDistance, dir.text]}>{distance(dist)}</Text>
          <Text style={[styles.bannerText, dir.text]} numberOfLines={2} accessibilityLiveRegion="polite">
            {instructionText(next, lang)}
          </Text>
        </View>
      </View>
      {(mode || (after && after.type !== 'arrive')) && (
        <>
          <View style={styles.divider} />
          <View style={[styles.bannerFooter, dir.row]}>
            {mode && (
              <View style={[styles.modeChip, dir.row]}>
                <View style={[styles.modeDot, { backgroundColor: MODE_STYLE[mode].color }]} />
                <Text style={styles.modeChipText}>{t.ride.now(t.modes[mode])}</Text>
              </View>
            )}
            {after && after.type !== 'arrive' && (
              <Text style={[styles.then, dir.text]} numberOfLines={1}>
                {t.ride.then(instructionText(after, lang))}
              </Text>
            )}
          </View>
        </>
      )}
    </Glass>
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
  const { p, styles } = useRideStyle();
  const now = useClock(15000);
  const remaining = track?.remaining ?? route.distance;
  const remainingTime = route.distance > 0 ? (route.duration * remaining) / route.distance : 0;
  const eta = new Date(now + remainingTime * 1000);
  const arrived = track?.arrived;

  return (
    <View style={[styles.footer, { bottom: Math.max(bottomInset - 16, 12) }]}>
      {!following && (
        <Pressable
          style={({ pressed }) => [dir.rtl ? styles.alignLeft : styles.alignRight, pressed && styles.pressed]}
          onPress={onRecenter}
          accessibilityLabel={t.ride.a11yRecenter}
        >
          <Glass variant={p.glass} interactive style={[styles.recenter, dir.row]}>
            <MaterialCommunityIcons name="navigation-variant" size={18} color={colors.accent} />
            <Text style={styles.recenterText}>{t.ride.recenter}</Text>
          </Glass>
        </Pressable>
      )}
      <Glass variant={p.glass} style={styles.footerBar}>
        {lockedScreenOff && (
          <Pressable style={[styles.notice, dir.row]} onPress={() => Linking.openSettings()}>
            <MaterialCommunityIcons name="lock-alert-outline" size={18} color={p.caution} />
            <Text style={[styles.noticeText, dir.text]}>{t.ride.lockedNotice}</Text>
          </Pressable>
        )}
        <View style={[styles.footerRow, dir.row]}>
          <Pressable
            onPress={onToggleMute}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            accessibilityLabel={muted ? t.ride.a11yUnmute : t.ride.a11yMute}
          >
            <MaterialCommunityIcons name={muted ? 'volume-off' : 'volume-high'} size={24} color={p.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            {arrived ? (
              <Text style={styles.arrived}>{t.ride.arrived}</Text>
            ) : (
              <>
                <Text style={styles.eta}>{time(eta)}</Text>
                <Text style={styles.remaining}>
                  {duration(remainingTime)} · {distance(remaining)}
                </Text>
              </>
            )}
          </View>
          <Pressable
            onPress={onEnd}
            style={({ pressed }) => [styles.end, arrived && styles.done, pressed && styles.pressed]}
            accessibilityLabel={t.ride.a11yEnd}
          >
            <Text style={[styles.endText, arrived && { color: p.onDone }]}>{arrived ? t.ride.done : t.ride.end}</Text>
          </Pressable>
        </View>
      </Glass>
    </View>
  );
}

/** Day or night riding style, following the phone's appearance. */
function useRideStyle() {
  return useColorScheme() === 'dark' ? NIGHT : DAY;
}

function createStyles(p: RidePalette) {
  return StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 10,
    right: 10,
    borderRadius: 34,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
  },
  bannerCompact: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 18 },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  bannerDistance: {
    color: p.text,
    fontSize: 44,
    fontWeight: '600',
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
  },
  bannerText: { color: p.secondary, fontSize: 19, fontWeight: '500', lineHeight: 25 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: p.divider, marginVertical: 14 },
  bannerFooter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: p.fill,
  },
  modeDot: { width: 8, height: 8, borderRadius: 4 },
  modeChipText: { color: p.text, fontWeight: '600', fontSize: 13 },
  then: { flex: 1, color: p.muted, fontSize: 13 },
  footer: { position: 'absolute', left: 10, right: 10, gap: 10 },
  footerBar: { borderRadius: 40, padding: 12, gap: 10 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingTop: 4 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 18, color: p.caution },
  iconButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: p.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  end: {
    height: 56,
    paddingHorizontal: 26,
    borderRadius: 28,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  done: { backgroundColor: p.done },
  endText: { color: p.text, fontWeight: '600', fontSize: 17 },
  eta: { fontSize: 28, fontWeight: '600', letterSpacing: -0.5, color: p.text, fontVariant: ['tabular-nums'] },
  remaining: { fontSize: 14, color: p.muted, marginTop: 1, fontVariant: ['tabular-nums'] },
  arrived: { fontSize: 20, fontWeight: '600', color: p.text },
  pressed: { transform: [{ scale: 0.96 }] },
  alignLeft: { alignSelf: 'flex-start' },
  alignRight: { alignSelf: 'flex-end' },
  recenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 22,
  },
  recenterText: { color: p.text, fontWeight: '600', fontSize: 15 },
});
}

const DAY = { p: RIDE_DAY, styles: createStyles(RIDE_DAY) };
const NIGHT = { p: RIDE_NIGHT, styles: createStyles(RIDE_NIGHT) };
