import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { TurnType } from '../navigation/instructions';
import type { TravelMode } from '../routing/rules';

export const colors = {
  primary: '#0f766e',
  primaryDark: '#115e59',
  text: '#0f172a',
  muted: '#64748b',
  surface: '#ffffff',
  border: '#e2e8f0',
  danger: '#dc2626',
  warning: '#b45309',
  warningBg: '#fef3c7',
  banner: '#0f172a',
};

/** Route line colors by travel mode. Labels are in i18n/strings.ts (`t.modes`). */
export const MODE_STYLE: Record<TravelMode | 'connector', { color: string; dashed?: boolean }> = {
  bike_lane: { color: '#16a34a' },
  road_lane: { color: '#0891b2' },
  road: { color: '#2563eb' },
  sidewalk: { color: '#f59e0b' },
  shared_path: { color: '#14b8a6' },
  crossing: { color: '#a855f7' },
  connector: { color: '#94a3b8', dashed: true },
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
