import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  formatDistanceShort,
  formatDuration,
  instructionText,
  type VoiceLanguage,
} from '../i18n/phrases';
import type { Instruction } from '../navigation/instructions';
import type { TrackState } from '../navigation/tracker';
import type { Route } from '../routing/router';
import { colors, MODE_STYLE, turnIcon } from './theme';

interface BannerProps {
  instructions: Instruction[];
  track: TrackState | null;
  rerouting: boolean;
  language: VoiceLanguage;
  topInset: number;
}

/** Next maneuver, shown at the top of the screen while riding. */
export function ManeuverBanner({ instructions, track, rerouting, language, topInset }: BannerProps) {
  const rtl = language === 'he';
  const index = track?.nextIndex ?? 1;
  const next = instructions[index] ?? instructions[instructions.length - 1];
  const after = instructions[index + 1];
  const dist = track?.distanceToNext ?? next?.dist ?? 0;
  const mode = track ? currentMode(instructions, index) : instructions[0]?.mode;

  if (rerouting || track?.offRoute) {
    return (
      <View style={[styles.banner, { paddingTop: topInset + 12, backgroundColor: colors.warning }]}>
        <Text style={styles.bannerText}>Recalculating…</Text>
      </View>
    );
  }
  if (!next) return null;

  return (
    <View style={[styles.banner, { paddingTop: topInset + 12 }]}>
      <View style={styles.bannerRow}>
        <MaterialCommunityIcons name={turnIcon(next.type, next.angle)} size={48} color="#fff" />
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerDistance}>{formatDistanceShort(dist)}</Text>
          <Text
            style={[styles.bannerText, rtl && styles.rtl]}
            numberOfLines={2}
            accessibilityLiveRegion="polite"
          >
            {instructionText(next, language)}
          </Text>
        </View>
      </View>
      <View style={styles.bannerFooter}>
        {mode && (
          <View style={[styles.modePill, { backgroundColor: MODE_STYLE[mode].color }]}>
            <Text style={styles.modePillText}>Now: {MODE_STYLE[mode].label}</Text>
          </View>
        )}
        {after && after.type !== 'arrive' && (
          <Text style={[styles.then, rtl && styles.rtl]} numberOfLines={1}>
            Then: {instructionText(after, language)}
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
}: FooterProps) {
  const now = useClock(15000);
  const remaining = track?.remaining ?? route.distance;
  const remainingTime = route.distance > 0 ? (route.duration * remaining) / route.distance : 0;
  const eta = new Date(now + remainingTime * 1000);
  const arrived = track?.arrived;

  return (
    <View style={[styles.footer, { paddingBottom: bottomInset + 12 }]}>
      {!following && (
        <Pressable style={styles.recenter} onPress={onRecenter} accessibilityLabel="Recenter map">
          <MaterialCommunityIcons name="crosshairs-gps" size={22} color={colors.primary} />
          <Text style={styles.recenterText}>Recenter</Text>
        </Pressable>
      )}
      <View style={styles.footerRow}>
        <Pressable onPress={onToggleMute} style={styles.iconButton} accessibilityLabel={muted ? 'Unmute voice' : 'Mute voice'}>
          <MaterialCommunityIcons name={muted ? 'volume-off' : 'volume-high'} size={26} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          {arrived ? (
            <Text style={styles.eta}>You have arrived</Text>
          ) : (
            <>
              <Text style={styles.eta}>
                {eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Text style={styles.remaining}>
                {formatDuration(remainingTime)} · {formatDistanceShort(remaining)}
              </Text>
            </>
          )}
        </View>
        <Pressable onPress={onEnd} style={[styles.iconButton, styles.end]} accessibilityLabel="End navigation">
          <Text style={styles.endText}>{arrived ? 'Done' : 'End'}</Text>
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
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
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
    right: 16,
    flexDirection: 'row',
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
