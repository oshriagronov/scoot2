import { useMemo } from 'react';
import type { TextStyle, ViewStyle } from 'react-native';
import type { RouteErrorCode } from '../navigation/useNavigation';
import type { TravelMode } from '../routing/rules';
import { MAX_TRIP_METERS } from '../routing/router';
import { useSettings } from '../state/settings';
import { formatDistanceShort, formatDuration, type Language } from './phrases';

/** Everything the screens show. Spoken phrases live in phrases.ts. */
const en = {
  search: {
    placeholder: 'Where to?',
    hint: 'Search for a place, or long-press the map to drop a pin',
    noResults: 'No places found',
    failed: 'Search failed. Check your connection.',
    a11ySearch: 'Search destination',
    a11yClear: 'Clear search',
    a11ySettings: 'Settings',
  },
  map: {
    droppedPin: 'Dropped pin',
    locationOff: 'Location is off. Tap to allow it so the app can guide you.',
    a11yMyLocation: 'Show my location',
    attribution: 'Routing data © OpenStreetMap contributors',
  },
  route: {
    a11yClose: 'Close route',
    planning:
      'Finding the best legal route… The first search in an area downloads street data and can take up to a minute.',
    retry: 'Retry',
    safest: 'Safest',
    fastest: 'Fastest',
    inferredSpeed: (distance: string) =>
      `${distance} on roads without a speed limit in the map data. Check the signs as you ride.`,
    start: 'Start',
    arrive: (time: string) => `Arrive ${time}`,
    a11yStart: 'Start navigation',
  },
  errors: {
    too_far: (km: number) => `Trips are limited to ${km} km.`,
    no_road_near_start: 'No street you are allowed to ride on is near your position.',
    no_road_near_end: 'No street you are allowed to ride on is near the destination.',
    no_route:
      'No legal route found. Some roads on the way may be above 50 km/h without a sidewalk or bike lane.',
    network: 'Could not download map data. Check your connection and try again.',
    unknown: 'Something went wrong while planning the route.',
    waiting_location: 'Waiting for your location…',
  },
  ride: {
    recalculating: 'Recalculating…',
    now: (mode: string) => `Now: ${mode}`,
    then: (text: string) => `Then: ${text}`,
    recenter: 'Recenter',
    lockedNotice: 'Guidance pauses while the phone is locked. Tap to set location access to “Always”.',
    arrived: 'You have arrived',
    end: 'End',
    done: 'Done',
    a11yMute: 'Mute voice',
    a11yUnmute: 'Unmute voice',
    a11yEnd: 'End navigation',
    a11yRecenter: 'Recenter map',
    notificationTitle: 'Scoot2 is guiding you',
    notificationTo: (place: string) => `To ${place}`,
    notificationVoice: 'Voice guidance is on',
    speedUnit: 'km/h',
    a11ySpeed: (kmh: number) => `Speed: ${kmh} kilometers per hour`,
  },
  modes: {
    bike_lane: 'Bike lane',
    road_lane: 'Lane on road',
    road: 'Road ≤ 50',
    sidewalk: 'Sidewalk',
    shared_path: 'Shared path',
    crossing: 'Crossing',
    connector: 'Walk',
  } satisfies Record<TravelMode | 'connector', string>,
  settings: {
    title: 'Settings',
    a11yClose: 'Close settings',
    sectionLanguage: 'Language and voice',
    language: 'Language',
    languageDetail: 'For the screens and the voice guidance.',
    voiceGuidance: 'Voice guidance',
    testVoice: 'Test voice',
    sectionDisplay: 'Display',
    appearance: 'Appearance',
    appearanceDetail: 'Automatic follows your phone’s light or dark mode.',
    appearanceSystem: 'Automatic',
    appearanceLight: 'Light',
    appearanceDark: 'Dark',
    sectionRoute: 'Route',
    preference: 'Preference',
    safestDetail: 'Prefers bike lanes and quiet 30 km/h streets, even if the ride is a bit longer.',
    fastestDetail: 'Shortest legal ride time. Still never uses roads above 50 km/h.',
    sectionTesting: 'Testing',
    simulate: 'Simulate ride',
    simulateDetail: 'Rides the route automatically instead of using GPS, to preview voice guidance.',
    footer:
      'Routes come from OpenStreetMap data, which may be incomplete or out of date. Always follow road signs and local law. Map data © OpenStreetMap contributors (ODbL).',
  },
};

export type Strings = typeof en;

const he: Strings = {
  search: {
    placeholder: 'לאן נוסעים?',
    hint: 'חיפוש מקום, או לחיצה ארוכה על המפה לסימון נקודה',
    noResults: 'לא נמצאו מקומות',
    failed: 'החיפוש נכשל. בדקו את החיבור לאינטרנט.',
    a11ySearch: 'חיפוש יעד',
    a11yClear: 'ניקוי החיפוש',
    a11ySettings: 'הגדרות',
  },
  map: {
    droppedPin: 'נקודה שסימנת',
    locationOff: 'המיקום כבוי. הקישו כאן כדי לאפשר אותו, כך שהאפליקציה תוכל לנווט אתכם.',
    a11yMyLocation: 'הצגת המיקום שלי',
    attribution: 'נתוני ניווט © תורמי OpenStreetMap',
  },
  route: {
    a11yClose: 'סגירת המסלול',
    planning:
      'מחפש את המסלול החוקי הטוב ביותר… בחיפוש הראשון באזור מורידים נתוני רחובות, וזה יכול לקחת עד דקה.',
    retry: 'ניסיון חוזר',
    safest: 'הבטוח ביותר',
    fastest: 'המהיר ביותר',
    inferredSpeed: (distance: string) =>
      `${distance} בכבישים ללא מגבלת מהירות בנתוני המפה. שימו לב לשלטים בדרך.`,
    start: 'יוצאים',
    arrive: (time: string) => `הגעה ${time}`,
    a11yStart: 'התחלת ניווט',
  },
  errors: {
    too_far: (km: number) => `אפשר לתכנן נסיעות של עד ${km} ק״מ.`,
    no_road_near_start: 'אין ליד המיקום שלך רחוב שמותר לרכוב בו.',
    no_road_near_end: 'אין ליד היעד רחוב שמותר לרכוב בו.',
    no_route: 'לא נמצא מסלול חוקי. ייתכן שבדרך יש כבישים מעל 50 קמ״ש בלי מדרכה או שביל אופניים.',
    network: 'לא ניתן להוריד את נתוני המפה. בדקו את החיבור ונסו שוב.',
    unknown: 'משהו השתבש בתכנון המסלול.',
    waiting_location: 'ממתין למיקום שלך…',
  },
  ride: {
    recalculating: 'מחשב מסלול מחדש…',
    now: (mode: string) => `עכשיו: ${mode}`,
    then: (text: string) => `אחר כך: ${text}`,
    recenter: 'חזרה למיקום',
    lockedNotice: 'ההנחיות נעצרות כשהטלפון נעול. הקישו כאן כדי לשנות את הרשאת המיקום ל"תמיד".',
    arrived: 'הגעת ליעד',
    end: 'סיום',
    done: 'סיום',
    a11yMute: 'השתקת הקול',
    a11yUnmute: 'ביטול ההשתקה',
    a11yEnd: 'סיום הניווט',
    a11yRecenter: 'מרכוז המפה',
    notificationTitle: 'Scoot2 מנווט אותך',
    notificationTo: (place: string) => `אל ${place}`,
    notificationVoice: 'ההנחיות הקוליות פעילות',
    speedUnit: 'קמ״ש',
    a11ySpeed: (kmh: number) => `מהירות: ${kmh} קילומטר לשעה`,
  },
  modes: {
    bike_lane: 'שביל אופניים',
    road_lane: 'נתיב אופניים בכביש',
    road: 'כביש עד 50',
    sidewalk: 'מדרכה',
    shared_path: 'שביל משותף',
    crossing: 'מעבר חצייה',
    connector: 'הליכה',
  },
  settings: {
    title: 'הגדרות',
    a11yClose: 'סגירת ההגדרות',
    sectionLanguage: 'שפה וקול',
    language: 'שפה',
    languageDetail: 'למסכים ולהנחיות הקוליות.',
    voiceGuidance: 'הנחיות קוליות',
    testVoice: 'בדיקת קול',
    sectionDisplay: 'תצוגה',
    appearance: 'מראה',
    appearanceDetail: 'אוטומטי לפי מצב בהיר או כהה בטלפון.',
    appearanceSystem: 'אוטומטי',
    appearanceLight: 'בהיר',
    appearanceDark: 'כהה',
    sectionRoute: 'מסלול',
    preference: 'העדפה',
    safestDetail: 'מעדיף שבילי אופניים ורחובות שקטים של 30 קמ״ש, גם אם הדרך קצת ארוכה יותר.',
    fastestDetail: 'זמן הרכיבה החוקי הקצר ביותר. גם כך לא נוסעים בכבישים מעל 50 קמ״ש.',
    sectionTesting: 'בדיקות',
    simulate: 'הדמיית רכיבה',
    simulateDetail: 'רוכב במסלול אוטומטית במקום להשתמש ב-GPS, כדי לשמוע את ההנחיות הקוליות מראש.',
    footer:
      'המסלולים מבוססים על נתוני OpenStreetMap, שעשויים להיות חסרים או לא מעודכנים. תמיד צייתו לשלטים ולחוק. נתוני מפה © תורמי OpenStreetMap ‏(ODbL).',
  },
};

const STRINGS: Record<Language, Strings> = { en, he };

/** Layout styles that follow the reading direction. */
export interface Direction {
  rtl: boolean;
  /** For horizontal rows: items start from the right in Hebrew. */
  row: ViewStyle;
  /** For blocks of text: aligned to the reading start. */
  text: TextStyle;
  /** Aligns a single child to the reading start. */
  start: ViewStyle;
}

const DIRECTION: Record<'ltr' | 'rtl', Direction> = {
  ltr: {
    rtl: false,
    row: { flexDirection: 'row' },
    text: { textAlign: 'left', writingDirection: 'ltr' },
    start: { alignSelf: 'flex-start' },
  },
  rtl: {
    rtl: true,
    row: { flexDirection: 'row-reverse' },
    text: { textAlign: 'right', writingDirection: 'rtl' },
    start: { alignSelf: 'flex-end' },
  },
};

export function stringsFor(lang: Language) {
  return {
    lang,
    t: STRINGS[lang],
    dir: DIRECTION[lang === 'he' ? 'rtl' : 'ltr'],
    distance: (meters: number) => formatDistanceShort(meters, lang),
    duration: (seconds: number) => formatDuration(seconds, lang),
    /** Clock time like 14:05, in the language's format. */
    time: (date: Date) =>
      date.toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
    errorText: (code: RouteErrorCode) =>
      code === 'too_far' ? STRINGS[lang].errors.too_far(MAX_TRIP_METERS / 1000) : STRINGS[lang].errors[code],
  };
}

/** Screen text and layout direction for the current app language. */
export function useStrings() {
  const { settings } = useSettings();
  return useMemo(() => stringsFor(settings.language), [settings.language]);
}
