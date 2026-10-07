import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { Direction } from '../i18n/strings';
import { Glass, type GlassVariant } from './Glass';
import { colors } from './theme';

/** Round glass button for floating map controls. */
export function GlassButton({
  size = 54,
  variant = 'regular',
  onPress,
  accessibilityLabel,
  style,
  children,
}: {
  size?: number;
  variant?: GlassVariant;
  onPress: () => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => [style, pressed && styles.pressed]}
    >
      <Glass
        variant={variant}
        interactive
        style={[styles.round, { width: size, height: size, borderRadius: size / 2 }]}
      >
        {children}
      </Glass>
    </Pressable>
  );
}

/** Pill-shaped choice between a few options; the chosen one sits on a raised white pill. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  dir,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  dir: Direction;
}) {
  return (
    <View style={[styles.segmented, dir.row]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { transform: [{ scale: 0.96 }] },
  round: { alignItems: 'center', justifyContent: 'center' },
  segmented: { flexDirection: 'row', backgroundColor: colors.fill, borderRadius: 20, padding: 3 },
  segment: { flex: 1, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  segmentActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentText: { fontSize: 14, fontWeight: '500', color: colors.secondary },
  segmentTextActive: { fontWeight: '600', color: colors.ink },
});
