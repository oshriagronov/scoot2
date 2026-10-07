import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { TurnType } from '../navigation/instructions';
import type { TravelMode } from '../routing/rules';

/**
 * Quiet ink on glass: neutrals everywhere, and color only where it means something
 * (where you are, route types, ending a ride, cautions).
 */
export const colors = {
  ink: '#0B0B0F',
  text: '#0B0B0F',
  secondary: '#3C3C43',
  muted: '#6B6B73',
  /** Grouped screen background. */
  ground: '#F2F2F7',
  surface: '#FFFFFF',
  separator: 'rgba(60,60,67,0.12)',
  /** Fill behind small controls (segmented tracks, icon tiles). */
  fill: 'rgba(118,118,128,0.14)',
  /** You: the location dot and the simulated rider. */
  accent: '#0A84FF',
  danger: '#D0281C',
  caution: '#7A4A00',
  cautionIcon: '#B86E00',
  cautionBg: 'rgba(255,159,10,0.14)',
};

/** Riding screen colors: light glass by day, night glass when the phone is in dark mode. */
export interface RidePalette {
  glass: 'thick' | 'dark';
  text: string;
  secondary: string;
  muted: string;
  fill: string;
  divider: string;
  caution: string;
  /** "Done" button once arrived, and its label. */
  done: string;
  onDone: string;
}

export const RIDE_DAY: RidePalette = {
  glass: 'thick',
  text: colors.ink,
  secondary: colors.secondary,
  muted: colors.muted,
  fill: colors.fill,
  divider: colors.separator,
  caution: colors.caution,
  done: colors.ink,
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
  done: '#FFFFFF',
  onDone: colors.ink,
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
