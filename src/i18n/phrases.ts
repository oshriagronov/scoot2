import type { Instruction, StreetName, TurnType } from '../navigation/instructions';
import type { StreetNames } from '../routing/graph';
import type { TravelMode } from '../routing/rules';

export type VoiceLanguage = 'en' | 'he';

export const SPEECH_LOCALE: Record<VoiceLanguage, string> = { en: 'en-US', he: 'he-IL' };

/** Rounds a distance to what people expect to hear, e.g. 237 m -> "250 meters". */
export function roundDistance(meters: number): { value: number; unit: 'm' | 'km' } {
  if (meters >= 950) return { value: Math.round(meters / 100) / 10, unit: 'km' };
  if (meters >= 100) return { value: Math.round(meters / 50) * 50, unit: 'm' };
  return { value: Math.max(10, Math.round(meters / 10) * 10), unit: 'm' };
}

export function formatDistance(meters: number, lang: VoiceLanguage = 'en'): string {
  const { value, unit } = roundDistance(meters);
  if (lang === 'he') {
    if (unit === 'km') return value === 1 ? 'קילומטר' : `${value} קילומטר`;
    return `${value} מטר`;
  }
  if (unit === 'km') return `${value} ${value === 1 ? 'kilometer' : 'kilometers'}`;
  return `${value} meters`;
}

export function formatDistanceShort(meters: number): string {
  const { value, unit } = roundDistance(meters);
  return unit === 'km' ? `${value} km` : `${value} m`;
}

export function formatDuration(seconds: number): string {
  const min = Math.max(1, Math.round(seconds / 60));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

function ownName(s: StreetNames | undefined, lang: VoiceLanguage): string | undefined {
  if (!s) return undefined;
  return (lang === 'he' ? s.nameHe : s.nameEn) ?? s.name ?? s.ref;
}

/** Street name for display, falling back to "along <road>" for unnamed paths. */
export function streetLabel(s: StreetName, lang: VoiceLanguage): string | undefined {
  const own = ownName(s, lang);
  if (own) return own;
  const along = ownName(s.along, lang);
  if (!along) return undefined;
  return lang === 'he' ? `לאורך ${along}` : `along ${along}`;
}

/** How to refer to a path with no name of its own, e.g. "the bike lane along Herzl". */
const PATH_NOUN: Partial<Record<TravelMode, { en: string; he: string }>> = {
  bike_lane: { en: 'the bike lane', he: 'שביל האופניים' },
  sidewalk: { en: 'the sidewalk', he: 'המדרכה' },
  shared_path: { en: 'the path', he: 'השביל' },
};

const ORDINAL_EN = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];
const ORDINAL_HE = ['הראשונה', 'השנייה', 'השלישית', 'הרביעית', 'החמישית', 'השישית', 'השביעית', 'השמינית'];

function ordinal(n: number, lang: VoiceLanguage) {
  const list = lang === 'he' ? ORDINAL_HE : ORDINAL_EN;
  return list[n - 1] ?? String(n);
}

const TURN_EN: Record<TurnType, string> = {
  depart: 'Head',
  straight: 'Continue straight',
  slight_left: 'Bear left',
  slight_right: 'Bear right',
  left: 'Turn left',
  right: 'Turn right',
  sharp_left: 'Turn sharp left',
  sharp_right: 'Turn sharp right',
  uturn: 'Make a U-turn',
  cross: 'Cross the road',
  roundabout: 'At the roundabout',
  arrive: 'You have arrived at your destination',
};

const TURN_HE: Record<TurnType, string> = {
  depart: 'סע',
  straight: 'המשך ישר',
  slight_left: 'פנה קלות שמאלה',
  slight_right: 'פנה קלות ימינה',
  left: 'פנה שמאלה',
  right: 'פנה ימינה',
  sharp_left: 'פנה חדות שמאלה',
  sharp_right: 'פנה חדות ימינה',
  uturn: 'בצע פניית פרסה',
  cross: 'חצה את הכביש',
  roundabout: 'בכיכר',
  arrive: 'הגעת ליעד',
};

/** What to say when the riding surface changes. */
const MODE_EN: Record<TravelMode, string> = {
  bike_lane: 'Use the bike lane',
  road_lane: 'Use the bike lane on the road',
  road: 'Ride on the road',
  sidewalk: 'Ride on the sidewalk, the road is above 50',
  shared_path: 'Use the shared path',
  crossing: 'Cross the road',
};

const MODE_HE: Record<TravelMode, string> = {
  bike_lane: 'עלה על שביל האופניים',
  road_lane: 'סע בנתיב האופניים שבכביש',
  road: 'סע על הכביש',
  sidewalk: 'עלה על המדרכה, המהירות בכביש מעל 50',
  shared_path: 'סע בשביל המשותף',
  crossing: 'חצה את הכביש',
};

const CARDINALS_EN = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
const CARDINALS_HE = ['צפונה', 'לצפון מזרח', 'מזרחה', 'לדרום מזרח', 'דרומה', 'לדרום מערב', 'מערבה', 'לצפון מערב'];

function cardinal(heading: number, lang: VoiceLanguage) {
  const i = Math.round(heading / 45) % 8;
  return (lang === 'he' ? CARDINALS_HE : CARDINALS_EN)[i];
}

/**
 * Where the maneuver leads, e.g. "Herzl" or "the bike lane along Herzl".
 * Returns whether the surface is already named so it need not be repeated.
 */
function destination(instr: Instruction, lang: VoiceLanguage): { text?: string; namesSurface: boolean } {
  const own = ownName(instr.street, lang);
  if (own) return { text: own, namesSurface: false };
  const along = ownName(instr.street.along, lang);
  const noun = instr.mode ? PATH_NOUN[instr.mode] : undefined;
  if (noun && along) {
    return { text: lang === 'he' ? `${noun.he} לאורך ${along}` : `${noun.en} along ${along}`, namesSurface: true };
  }
  if (noun && instr.modeChanged) return { text: lang === 'he' ? noun.he : noun.en, namesSurface: true };
  return { namesSurface: false };
}

/** The instruction as a sentence, without any distance prefix. */
export function instructionText(instr: Instruction, lang: VoiceLanguage): string {
  const he = lang === 'he';
  const modeText = (m: TravelMode) => (he ? MODE_HE : MODE_EN)[m];

  if (instr.type === 'arrive') return he ? TURN_HE.arrive : TURN_EN.arrive;
  if (instr.type === 'cross') return he ? TURN_HE.cross : TURN_EN.cross;

  const dest = destination(instr, lang);
  const modeSuffix = instr.modeChanged && instr.mode && !dest.namesSurface ? `. ${modeText(instr.mode)}` : '';

  if (instr.type === 'depart') {
    const dir = cardinal(instr.heading ?? 0, lang);
    const base = he ? `${TURN_HE.depart} ${dir}` : `${TURN_EN.depart} ${dir}`;
    const on = dest.text ? (he ? ` ב${dest.text}` : ` on ${dest.text}`) : '';
    const mode = instr.mode && !dest.namesSurface ? `. ${modeText(instr.mode)}` : '';
    return base + on + mode;
  }

  if (instr.type === 'roundabout') {
    const n = ordinal(instr.exit ?? 1, lang);
    const base = he ? `בכיכר, צא ביציאה ${n}` : `At the roundabout, take the ${n} exit`;
    const onto = dest.text ? (he ? ` אל ${dest.text}` : ` onto ${dest.text}`) : '';
    return base + onto + modeSuffix;
  }

  // Going straight onto a new surface: the surface change is the whole message.
  if (instr.type === 'straight' && instr.modeChanged && instr.mode && !dest.namesSurface) {
    const own = ownName(instr.street, lang);
    const mode = modeText(instr.mode);
    return own ? (he ? `${mode}, ${own}` : `${mode} on ${own}`) : mode;
  }

  let text = (he ? TURN_HE : TURN_EN)[instr.type];
  if (dest.text) text += he ? ` אל ${dest.text}` : ` onto ${dest.text}`;
  return text + modeSuffix;
}

/** e.g. "In 200 meters, turn left onto Herzl". */
export function instructionWithDistance(
  instr: Instruction,
  meters: number,
  lang: VoiceLanguage,
): string {
  const text = instructionText(instr, lang);
  const d = formatDistance(meters, lang);
  if (lang === 'he') return `בעוד ${d}, ${text}`;
  return `In ${d}, ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

export function thenText(instr: Instruction, lang: VoiceLanguage): string {
  const text = instructionText(instr, lang);
  return lang === 'he' ? `ואז ${text}` : `then ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

export const PHRASES = {
  rerouting: { en: 'Off route. Recalculating.', he: 'סטית מהמסלול. מחשב מסלול חדש.' },
  start: { en: 'Starting navigation.', he: 'מתחילים בניווט.' },
  noRoute: {
    en: 'Could not find a new legal route.',
    he: 'לא נמצא מסלול חוקי חדש.',
  },
} satisfies Record<string, Record<VoiceLanguage, string>>;
