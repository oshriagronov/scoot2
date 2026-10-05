import * as Speech from 'expo-speech';
import {
  instructionText,
  instructionWithDistance,
  SPEECH_LOCALE,
  thenText,
  type VoiceLanguage,
} from '../i18n/phrases';
import type { Announcement } from './tracker';

export function announcementText(a: Announcement, lang: VoiceLanguage): string {
  switch (a.kind) {
    case 'prepare':
      return instructionWithDistance(a.instruction, a.distance, lang);
    case 'now': {
      const text = instructionText(a.instruction, lang);
      return a.then ? `${text}, ${thenText(a.then, lang)}` : text;
    }
    case 'arrived':
      return lang === 'he' ? 'הגעת ליעד' : 'You have arrived at your destination';
  }
}

/**
 * Speaks navigation prompts. A newer prompt replaces anything still being
 * spoken, since stale directions are worse than cut-off ones.
 */
export function speak(text: string, lang: VoiceLanguage) {
  Speech.stop();
  Speech.speak(text, { language: SPEECH_LOCALE[lang], rate: 1.0 });
}

export function stopSpeaking() {
  Speech.stop();
}
