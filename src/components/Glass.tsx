import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, useColorScheme, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Liquid Glass (iOS 26+) where the system has it, otherwise a frosted-looking
 * translucent surface with a hairline and soft shadow.
 */
const LIQUID = Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

export type GlassVariant =
  /** Floating controls over the map. */
  | 'regular'
  /** Sheets and lists that hold a lot of text. */
  | 'thick'
  /** The riding screen. */
  | 'dark';

interface Props {
  variant?: GlassVariant;
  /** Native press feedback on Liquid Glass; use for buttons. */
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

export function Glass({ variant = 'regular', interactive, style, children }: Props) {
  const appearance = useColorScheme();
  // The riding screen's night glass is always dark; the rest follows the appearance.
  const scheme = variant === 'dark' || appearance === 'dark' ? 'dark' : 'light';
  if (LIQUID) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme={scheme}
        tintColor={TINT[scheme][variant]}
        isInteractive={interactive}
        style={style}
      >
        {children}
      </GlassView>
    );
  }
  return <View style={[styles.fallback, FALLBACK[scheme][variant], style]}>{children}</View>;
}

const TINT: Record<'light' | 'dark', Record<GlassVariant, string | undefined>> = {
  light: {
    regular: undefined,
    thick: 'rgba(255,255,255,0.55)',
    dark: undefined,
  },
  dark: {
    regular: undefined,
    thick: 'rgba(28,28,30,0.55)',
    dark: 'rgba(20,21,25,0.45)',
  },
};

const styles = StyleSheet.create({
  fallback: {
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#11161F',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
});

const NIGHT: ViewStyle = {
  backgroundColor: 'rgba(28,29,33,0.92)',
  borderColor: 'rgba(255,255,255,0.12)',
  shadowColor: '#000',
  shadowOpacity: 0.45,
};

const FALLBACK: Record<'light' | 'dark', Record<GlassVariant, ViewStyle>> = {
  light: {
    regular: { backgroundColor: 'rgba(255,255,255,0.9)', borderColor: 'rgba(255,255,255,0.9)' },
    thick: { backgroundColor: 'rgba(255,255,255,0.96)', borderColor: 'rgba(255,255,255,1)' },
    dark: NIGHT,
  },
  dark: {
    regular: { ...NIGHT, backgroundColor: 'rgba(44,44,46,0.9)' },
    thick: { ...NIGHT, backgroundColor: 'rgba(28,28,30,0.96)' },
    dark: NIGHT,
  },
};
