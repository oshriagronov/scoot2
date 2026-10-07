import type { ComponentProps } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { TurnType } from '../navigation/instructions';
import type { TravelMode } from '../routing/rules';

/**
 * Quiet ink on glass: neutrals everywhere, and color only where it means something
 * (where you are, route types, ending a ride, cautions).
 */
export const LIGHT = {
  /** Strongest emphasis: icons, primary buttons, switches. */
  ink: '#0B0B0F',
  /** Text and icons on an `ink` background. */
  onInk: '#FFFFFF',
  inkPressed: '#26262B',
  text: '#0B0B0F',
  secondary: '#3C3C43',
  muted: '#6B6B73',
  /** Grouped screen background. */
  ground: '#F2F2F7',
  surface: '#FFFFFF',
  /** The chosen option of a segmented control. */
  raised: '#FFFFFF',
  separator: 'rgba(60,60,67,0.12)',
  /** Fill behind small controls (segmented tracks, icon tiles). */
  fill: 'rgba(118,118,128,0.14)',
  grabber: 'rgba(60,60,67,0.22)',
  /** Track of a switch that is on. */
  switchOn: '#0B0B0F',
  /** Behind the map until its tiles load. */
  mapGround: '#EDECE8',
  attributionBg: 'rgba(255,255,255,0.78)',
  /** You: the location dot and the simulated rider. */
  accent: '#0A84FF',
  danger: '#D0281C',
  caution: '#7A4A00',
  cautionIcon: '#B86E00',
  cautionBg: 'rgba(255,159,10,0.14)',
};

export type Palette = typeof LIGHT;

export const DARK: Palette = {
  ink: '#F5F5F7',
  onInk: '#0B0B0F',
  inkPressed: '#D1D1D6',
  text: '#FFFFFF',
  secondary: 'rgba(235,235,245,0.8)',
  muted: 'rgba(235,235,245,0.6)',
  ground: '#000000',
  surface: '#1C1C1E',
  raised: '#636366',
  separator: 'rgba(84,84,88,0.6)',
  fill: 'rgba(118,118,128,0.24)',
  grabber: 'rgba(235,235,245,0.3)',
  switchOn: '#30D158',
  mapGround: '#1C1C1E',
  attributionBg: 'rgba(28,28,30,0.78)',
  accent: '#0A84FF',
  danger: '#FF453A',
  caution: '#FFC861',
  cautionIcon: '#FF9F0A',
  cautionBg: 'rgba(255,159,10,0.18)',
};

/** Palette for the current appearance (the app setting, or the phone's when set to automatic). */
export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? DARK : LIGHT;
}

/**
 * Builds a style sheet for each palette once; the returned hook gives the palette
 * and the styles for the current appearance.
 */
export function themed<T extends StyleSheet.NamedStyles<T>>(make: (c: Palette) => T) {
  const light = StyleSheet.create(make(LIGHT));
  const dark = StyleSheet.create(make(DARK));
  return function useThemedStyles() {
    const c = useTheme();
    return { c, styles: c === DARK ? dark : light };
  };
}

/** Riding screen colors: light glass in light mode, night glass in dark mode. */
export interface RidePalette {
  glass: 'thick' | 'dark';
  text: string;
  secondary: string;
  muted: string;
  fill: string;
  divider: string;
  caution: string;
  danger: string;
  /** "Done" button once arrived, and its label. */
  done: string;
  onDone: string;
}

export const RIDE_DAY: RidePalette = {
  glass: 'thick',
  text: LIGHT.ink,
  secondary: LIGHT.secondary,
  muted: LIGHT.muted,
  fill: LIGHT.fill,
  divider: LIGHT.separator,
  caution: LIGHT.caution,
  danger: LIGHT.danger,
  done: LIGHT.ink,
  onDone: '#FFFFFF',
};

export const RIDE_NIGHT: RidePalette = {
  glass: 'dark',
  text: '#FFFFFF',
  secondary: 'rgba(255,255,255,0.8)',
  muted: 'rgba(255,255,255,0.62)',
  fill: 'rgba(255,255,255,0.12)',
  divider: 'rgba(255,255,255,0.16)',
  caution: '#FFC861',
  danger: LIGHT.danger,
  done: '#FFFFFF',
  onDone: LIGHT.ink,
};

/** Route line colors by travel mode (iOS system colors). Labels are in i18n/strings.ts (`t.modes`). */
export const MODE_STYLE: Record<TravelMode | 'connector', { color: string; dashed?: boolean }> = {
  bike_lane: { color: '#34C759' },
  road_lane: { color: '#30B0C7' },
  road: { color: '#0A84FF' },
  sidewalk: { color: '#FF9F0A' },
  shared_path: { color: '#5E5CE6' },
  crossing: { color: '#BF5AF2' },
  connector: { color: '#8E8E93', dashed: true },
};

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function turnIcon(type: TurnType, angle = 0): IconName {
  switch (type) {
    case 'depart':
    case 'straight':
      return 'arrow-up';
    case 'slight_left':
      return 'arrow-top-left';
    case 'slight_right':
      return 'arrow-top-right';
    case 'left':
      return 'arrow-left-top';
    case 'right':
      return 'arrow-right-top';
    case 'sharp_left':
      return 'arrow-left-bottom';
    case 'sharp_right':
      return 'arrow-right-bottom';
    case 'uturn':
      return 'arrow-u-left-top';
    case 'cross':
      return 'walk';
    case 'roundabout':
      return angle < 0 ? 'rotate-left' : 'rotate-right';
    case 'arrive':
      return 'flag-checkered';
  }
}
