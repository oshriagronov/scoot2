import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { distanceLL, type LatLng } from '../routing/geo';
import { useStrings } from '../i18n/strings';
import { searchPlaces, type Place } from '../services/geocode';
import { GlassButton } from './controls';
import { Glass } from './Glass';
import { themed } from './theme';

/** Wait this long after the last keystroke before searching. */
const TYPING_DELAY_MS = 400;
const MIN_TYPING_CHARS = 3;

interface Props {
  near: LatLng | null;
  onSelect: (place: Place) => void;
  onOpenSettings: () => void;
  /** Shown under the bar while it is empty. */
  hint?: string;
}

export function SearchBar({ near, onSelect, onOpenSettings, hint }: Props) {
  const { t, dir, lang, distance } = useStrings();
  const { c, styles } = useStyles();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<'noResults' | 'failed' | null>(null);
  const abort = useRef<AbortController | null>(null);

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = async (text: string, mode: 'typing' | 'submit') => {
    const q = text.trim();
    if (!q) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setLoading(true);
    if (mode === 'submit') setError(null);
    try {
      const found = await searchPlaces(q, near, lang, mode, controller.signal);
      if (controller.signal.aborted) return;
      setResults(found);
      setError(found.length ? null : 'noResults');
    } catch {
      // While typing, a failed request just leaves the previous results; the next keystroke retries.
      if (!controller.signal.aborted && mode === 'submit') setError('failed');
    } finally {
      if (abort.current === controller) setLoading(false);
    }
  };

  const onChangeText = (text: string) => {
    setQuery(text);
    if (debounce.current) clearTimeout(debounce.current);
    if (text.trim().length < MIN_TYPING_CHARS) {
      abort.current?.abort();
      setLoading(false);
      setResults(null);
      setError(null);
      return;
    }
    debounce.current = setTimeout(() => search(text, 'typing'), TYPING_DELAY_MS);
  };

  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
      abort.current?.abort();
    },
    [],
  );

  const reset = () => {
    if (debounce.current) clearTimeout(debounce.current);
    abort.current?.abort();
    setQuery('');
    setResults(null);
    setError(null);
    setLoading(false);
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.top, dir.row]}>
        <Glass style={[styles.bar, dir.row]}>
          <MaterialCommunityIcons name="magnify" size={22} color={c.secondary} />
          <TextInput
            style={[styles.input, dir.text]}
            placeholder={t.search.placeholder}
            placeholderTextColor={c.muted}
            value={query}
            onChangeText={onChangeText}
            // Takes the text from the event: state may lag behind fast typing.
            onSubmitEditing={(e) => {
              if (debounce.current) clearTimeout(debounce.current);
              search(e.nativeEvent.text, 'submit');
            }}
            returnKeyType="search"
            autoCorrect={false}
            selectionColor={c.accent}
            accessibilityLabel={t.search.a11ySearch}
          />
          {loading ? (
            <ActivityIndicator color={c.ink} style={styles.trailing} />
          ) : query ? (
            <Pressable onPress={reset} hitSlop={10} style={styles.trailing} accessibilityLabel={t.search.a11yClear}>
              <View style={styles.clear}>
                <MaterialCommunityIcons name="close" size={13} color="#fff" />
              </View>
            </Pressable>
          ) : null}
        </Glass>
        <GlassButton onPress={onOpenSettings} accessibilityLabel={t.search.a11ySettings}>
          <MaterialCommunityIcons name="tune-variant" size={22} color={c.ink} />
        </GlassButton>
      </View>

      {!!hint && !query && !results && !error && (
        <Glass style={[styles.hint, dir.start]}>
          <Text style={[styles.hintText, dir.text]}>{hint}</Text>
        </Glass>
      )}

      {(results?.length || error) && (
        <Glass variant="thick" style={styles.results}>
          {error && <Text style={[styles.error, dir.text]}>{t.search[error]}</Text>}
          <FlatList
            data={results ?? []}
            keyExtractor={(p) => p.id}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => (
              <View style={[styles.separator, dir.rtl ? { marginRight: 70 } : { marginLeft: 70 }]} />
            )}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.row, dir.row, pressed && styles.rowPressed]}
                onPress={() => {
                  if (debounce.current) clearTimeout(debounce.current);
                  abort.current?.abort();
                  setQuery(item.title);
                  setResults(null);
                  onSelect(item);
                }}
              >
                <View style={styles.tile}>
                  <MaterialCommunityIcons name="map-marker-outline" size={20} color={c.ink} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.title, dir.text]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {!!item.subtitle && (
                    <Text style={[styles.subtitle, dir.text]} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  )}
                </View>
                {near && <Text style={styles.away}>{distance(distanceLL(near, item.location))}</Text>}
              </Pressable>
            )}
          />
        </Glass>
      )}
    </View>
  );
}

const useStyles = themed((c) => ({
  wrap: { marginHorizontal: 16, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 54,
    borderRadius: 27,
    paddingHorizontal: 18,
  },
  input: { flex: 1, height: '100%', fontSize: 17, color: c.text },
  trailing: { marginHorizontal: -6 },
  clear: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#8E8E93',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, maxWidth: '100%' },
  hintText: { fontSize: 13, lineHeight: 18, color: c.secondary },
  results: { borderRadius: 28, maxHeight: 340, overflow: 'hidden', paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 11 },
  rowPressed: { backgroundColor: c.fill },
  tile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: c.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '600', color: c.text },
  subtitle: { fontSize: 13, color: c.muted },
  away: { fontSize: 13, color: c.muted, fontVariant: ['tabular-nums'] },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: c.separator, marginHorizontal: 16 },
  error: { paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: c.muted },
}));
