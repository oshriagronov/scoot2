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
import type { LatLng } from '../routing/geo';
import { useStrings } from '../i18n/strings';
import { searchPlaces, type Place } from '../services/geocode';
import { colors } from './theme';

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
  const { t, dir, lang } = useStrings();
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
      <View style={[styles.bar, dir.row]}>
        <MaterialCommunityIcons name="magnify" size={22} color={colors.muted} />
        <TextInput
          style={[styles.input, dir.text]}
          placeholder={t.search.placeholder}
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={onChangeText}
          // Takes the text from the event: state may lag behind fast typing.
          onSubmitEditing={(e) => {
            if (debounce.current) clearTimeout(debounce.current);
            search(e.nativeEvent.text, 'submit');
          }}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel={t.search.a11ySearch}
        />
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : query ? (
          <Pressable onPress={reset} hitSlop={10} accessibilityLabel={t.search.a11yClear}>
            <MaterialCommunityIcons name="close" size={20} color={colors.muted} />
          </Pressable>
        ) : null}
        <Pressable onPress={onOpenSettings} hitSlop={10} style={styles.gear} accessibilityLabel={t.search.a11ySettings}>
          <MaterialCommunityIcons name="cog" size={22} color={colors.text} />
        </Pressable>
      </View>

      {!!hint && !query && !results && !error && <Text style={styles.hint}>{hint}</Text>}

      {(results?.length || error) && (
        <View style={styles.results}>
          {error && <Text style={[styles.error, dir.text]}>{t.search[error]}</Text>}
          <FlatList
            data={results ?? []}
            keyExtractor={(p) => p.id}
            keyboardShouldPersistTaps="handled"
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
                <MaterialCommunityIcons name="map-marker" size={20} color={colors.primary} />
                <View style={styles.rowText}>
                  <Text style={[styles.title, dir.text]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.subtitle, dir.text]} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 12 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 50,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  input: { flex: 1, fontSize: 17, color: colors.text },
  gear: { paddingHorizontal: 2 },
  results: {
    marginTop: 6,
    backgroundColor: colors.surface,
    borderRadius: 14,
    maxHeight: 320,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  rowPressed: { backgroundColor: '#f1f5f9' },
  rowText: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  error: { padding: 14, color: colors.muted },
  hint: {
    alignSelf: 'center',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.75)',
    color: '#fff',
    fontSize: 13,
    overflow: 'hidden',
  },
});
