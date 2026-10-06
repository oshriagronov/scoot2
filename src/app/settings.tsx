import { Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, MODE_STYLE } from '../components/theme';
import type { Language } from '../i18n/phrases';
import { useStrings, type Direction } from '../i18n/strings';
import { speak } from '../navigation/voice';
import type { RouteProfile } from '../routing/cost';
import type { TravelMode } from '../routing/rules';
import { useSettings } from '../state/settings';

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  dir,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  dir: Direction;
}) {
  return (
    <View style={[styles.segmented, dir.row]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Row({
  title,
  detail,
  dir,
  children,
}: {
  title: string;
  detail?: string;
  dir: Direction;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.row, dir.row]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, dir.text]}>{title}</Text>
        {detail && <Text style={[styles.rowDetail, dir.text]}>{detail}</Text>}
      </View>
      {children}
    </View>
  );
}

const LEGEND: TravelMode[] = ['bike_lane', 'road_lane', 'road', 'sidewalk', 'shared_path', 'crossing'];

/** A sample prompt for "Test voice", in each language. */
const TEST_PHRASE: Record<Language, string> = {
  en: 'In 200 meters, turn right onto the bike lane',
  he: 'בעוד 200 מטר, פנה ימינה אל שביל האופניים',
};

export default function SettingsScreen() {
  const { settings, update } = useSettings();
  const { t, dir } = useStrings();
  const s = t.settings;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: s.title }} />

      <Text style={[styles.section, dir.text]}>{s.sectionLanguage}</Text>
      <View style={styles.card}>
        <View style={styles.block}>
          <Text style={[styles.rowTitle, dir.text]}>{s.language}</Text>
          <Segmented<Language>
            options={[
              { value: 'he', label: 'עברית' },
              { value: 'en', label: 'English' },
            ]}
            value={settings.language}
            onChange={(v) => update({ language: v })}
            dir={dir}
          />
          <Text style={[styles.rowDetail, dir.text]}>{s.languageDetail}</Text>
        </View>
        <Row title={s.voiceGuidance} dir={dir}>
          <Switch value={settings.voiceEnabled} onValueChange={(v) => update({ voiceEnabled: v })} />
        </Row>
        <View style={styles.block}>
          <Pressable style={[styles.test, dir.start]} onPress={() => speak(TEST_PHRASE[settings.language], settings.language)}>
            <Text style={styles.testText}>{s.testVoice}</Text>
          </Pressable>
        </View>
      </View>

      <Text style={[styles.section, dir.text]}>{s.sectionRoute}</Text>
      <View style={styles.card}>
        <View style={styles.block}>
          <Text style={[styles.rowTitle, dir.text]}>{s.preference}</Text>
          <Segmented<RouteProfile>
            options={[
              { value: 'safest', label: t.route.safest },
              { value: 'fastest', label: t.route.fastest },
            ]}
            value={settings.profile}
            onChange={(v) => update({ profile: v })}
            dir={dir}
          />
          <Text style={[styles.rowDetail, dir.text]}>
            {settings.profile === 'safest' ? s.safestDetail : s.fastestDetail}
          </Text>
        </View>
        <View style={styles.block}>
          <Text style={[styles.rowTitle, dir.text]}>{s.cruisingSpeed}</Text>
          <Segmented<number>
            options={[15, 20, 25].map((v) => ({ value: v, label: s.kmh(v) }))}
            value={settings.cruiseSpeed}
            onChange={(v) => update({ cruiseSpeed: v })}
            dir={dir}
          />
        </View>
        <Row title={s.strict} detail={s.strictDetail} dir={dir}>
          <Switch value={settings.strictUnknown} onValueChange={(v) => update({ strictUnknown: v })} />
        </Row>
      </View>

      <Text style={[styles.section, dir.text]}>{s.sectionRules}</Text>
      <View style={[styles.card, styles.block]}>
        {s.rules.map((rule) => (
          <Text key={rule} style={[styles.rule, dir.text]}>
            {rule}
          </Text>
        ))}
        <View style={[styles.legend, dir.row]}>
          {LEGEND.map((m) => (
            <View key={m} style={[styles.legendItem, dir.row]}>
              <View style={[styles.swatch, { backgroundColor: MODE_STYLE[m].color }]} />
              <Text style={styles.legendText}>{t.modes[m]}</Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={[styles.section, dir.text]}>{s.sectionTesting}</Text>
      <View style={styles.card}>
        <Row title={s.simulate} detail={s.simulateDetail} dir={dir}>
          <Switch value={settings.simulate} onValueChange={(v) => update({ simulate: v })} />
        </Row>
      </View>

      <Text style={styles.footer}>{s.footer}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16, paddingBottom: 48 },
  section: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
    marginHorizontal: 4,
  },
  card: { backgroundColor: colors.surface, borderRadius: 14, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  block: {
    padding: 14,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowDetail: { fontSize: 13, color: colors.muted, marginTop: 3, lineHeight: 18 },
  segmented: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 10, padding: 3 },
  segment: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.surface, elevation: 1, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2 },
  segmentText: { fontSize: 15, color: colors.muted, fontWeight: '600' },
  segmentTextActive: { color: colors.primary },
  test: { paddingVertical: 2 },
  testText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  rule: { fontSize: 15, color: colors.text, lineHeight: 21 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 18, height: 6, borderRadius: 3 },
  legendText: { fontSize: 13, color: colors.text },
  footer: { fontSize: 12, color: colors.muted, marginTop: 20, lineHeight: 17, textAlign: 'center' },
});
