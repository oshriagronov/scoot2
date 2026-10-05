import { setAudioModeAsync, setIsAudioActiveAsync } from 'expo-audio';
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

let session: Promise<void> | null = null;

/**
 * Audio session for prompts: audible with the silent switch on and while the
 * phone is locked, and lowering (not pausing) the rider's music while speaking.
 */
function prepareSession() {
  session ??= setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'duckOthers',
  }).catch(() => {});
  return session;
}

/** Increases with every prompt, so callbacks from replaced prompts are ignored. */
let current = 0;

/** Gives the audio back once the latest prompt is over, so music returns to full volume. */
function release(id: number) {
  if (id === current) setIsAudioActiveAsync(false).catch(() => {});
}

/**
 * Speaks a navigation prompt. A newer prompt replaces anything still being
 * spoken, since stale directions are worse than cut-off ones.
 */
export function speak(text: string, lang: VoiceLanguage) {
  const id = ++current;
  Speech.stop();
  void prepareSession().then(async () => {
    if (id !== current) return;
    await setIsAudioActiveAsync(true).catch(() => {});
    Speech.speak(text, {
      language: SPEECH_LOCALE[lang],
      rate: 1.0,
      useApplicationAudioSession: true,
      onDone: () => release(id),
      onStopped: () => release(id),
      onError: () => release(id),
    });
  });
}

export function stopSpeaking() {
  current++;
  Speech.stop();
  setIsAudioActiveAsync(false).catch(() => {});
}
