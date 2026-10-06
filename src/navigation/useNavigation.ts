import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useRef, useState } from 'react';
import { instructionText, PHRASES } from '../i18n/phrases';
import type { LatLng } from '../routing/geo';
import { Router, RoutingError, type Route } from '../routing/router';
import type { Place } from '../services/geocode';
import { createRoadDataFetcher } from '../services/roadData';
import type { Settings } from '../state/settings';
import { buildInstructions, type Instruction } from './instructions';
import { NavigationTracker, type Fix, type TrackState } from './tracker';
import { announcementText, speak, stopSpeaking } from './voice';

const KEEP_AWAKE_TAG = 'navigation';
/** Minimum seconds between automatic re-routes. */
const REROUTE_COOLDOWN_MS = 10000;

/** Why a route couldn't be planned; screens turn this into text in the app language. */
export type RouteErrorCode =
  | RoutingError['code']
  | 'network'
  | 'unknown'
  | 'waiting_location';

function errorCode(err: unknown): RouteErrorCode {
  if (err instanceof RoutingError) return err.code;
  if (err instanceof Error && /network|fetch|Map data|Aborted|timed? ?out/i.test(err.message)) {
    return 'network';
  }
  return 'unknown';
}

export function useNavigation(settings: Settings) {
  const [router] = useState(() => new Router(createRoadDataFetcher()));
  const abort = useRef<AbortController | null>(null);
  const tracker = useRef<NavigationTracker | null>(null);
  const lastReroute = useRef(0);
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const [destination, setDestination] = useState<Place | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<RouteErrorCode | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [rerouting, setRerouting] = useState(false);
  const [track, setTrack] = useState<TrackState | null>(null);
  const navigatingRef = useRef(false);

  const say = useCallback((text: string) => {
    const s = settingsRef.current;
    if (s.voiceEnabled) speak(text, s.language);
  }, []);

  const plan = useCallback(async (from: LatLng, to: LatLng): Promise<Route | null> => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setPlanning(true);
    setError(null);
    try {
      const s = settingsRef.current;
      const r = await router.plan(
        from,
        to,
        { profile: s.profile, cruiseSpeed: s.cruiseSpeed, strictUnknown: s.strictUnknown },
        controller.signal,
      );
      if (controller.signal.aborted) return null;
      const ins = buildInstructions(r);
      setRoute(r);
      setInstructions(ins);
      if (navigatingRef.current) tracker.current = new NavigationTracker(r, ins);
      return r;
    } catch (err) {
      if (controller.signal.aborted) return null;
      setError(errorCode(err));
      return null;
    } finally {
      if (abort.current === controller) setPlanning(false);
    }
  }, [router]);

  const chooseDestination = useCallback(
    (place: Place, from: LatLng | null) => {
      setDestination(place);
      setRoute(null);
      setInstructions([]);
      if (from) plan(from, place.location);
      else setError('waiting_location');
    },
    [plan],
  );

  /**
   * Updates the destination's label without re-planning, e.g. when a dropped pin's
   * address arrives. Ignored if the rider has since picked a different place.
   */
  const renameDestination = useCallback((place: Place) => {
    setDestination((current) =>
      current &&
      current.location.latitude === place.location.latitude &&
      current.location.longitude === place.location.longitude
        ? place
        : current,
    );
  }, []);

  const clear = useCallback(() => {
    abort.current?.abort();
    setDestination(null);
    setRoute(null);
    setInstructions([]);
    setError(null);
    setPlanning(false);
  }, []);

  const start = useCallback(() => {
    if (!route) return;
    tracker.current = new NavigationTracker(route, instructions);
    navigatingRef.current = true;
    setNavigating(true);
    setTrack(null);
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    const lang = settingsRef.current.language;
    const first = instructions[0];
    say(first ? `${PHRASES.start[lang]} ${instructionText(first, lang)}` : PHRASES.start[lang]);
  }, [route, instructions, say]);

  const stop = useCallback(() => {
    navigatingRef.current = false;
    tracker.current = null;
    setNavigating(false);
    setRerouting(false);
    setTrack(null);
    stopSpeaking();
    deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
  }, []);

  const handleFix = useCallback(
    async (fix: Fix) => {
      const t = tracker.current;
      if (!navigatingRef.current || !t || !destination) return;
      const { state, announcements } = t.update(fix);
      setTrack(state);
      const lang = settingsRef.current.language;
      for (const a of announcements) say(announcementText(a, lang));

      const now = Date.now();
      if (state.offRoute && now - lastReroute.current > REROUTE_COOLDOWN_MS) {
        lastReroute.current = now;
        setRerouting(true);
        say(PHRASES.rerouting[lang]);
        const r = await plan(fix, destination.location);
        setRerouting(false);
        if (!r) say(PHRASES.noRoute[lang]);
        else {
          const ins = buildInstructions(r);
          const next = ins[1];
          if (next) say(instructionText(next, lang));
        }
      }
    },
    [destination, plan, say],
  );

  // Re-plan when routing preferences change while previewing a route.
  const lastPlanKey = useRef('');
  useEffect(() => {
    const key = `${settings.profile}|${settings.strictUnknown}|${settings.cruiseSpeed}`;
    if (lastPlanKey.current && key !== lastPlanKey.current && destination && route && !navigating) {
      plan(route.from, destination.location);
    }
    lastPlanKey.current = key;
  }, [settings.profile, settings.strictUnknown, settings.cruiseSpeed, destination, route, navigating, plan]);

  useEffect(() => () => stop(), [stop]);

  return {
    destination,
    route,
    instructions,
    planning,
    error,
    navigating,
    rerouting,
    track,
    chooseDestination,
    renameDestination,
    retry: (from: LatLng) => {
      if (destination) plan(from, destination.location);
    },
    clear,
    start,
    stop,
    handleFix,
  };
}
