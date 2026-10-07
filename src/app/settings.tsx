import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassButton, Segmented } from '../components/controls';
import { colors, MODE_STYLE } from '../components/theme';
import type { Language } from '../i18n/phrases';
import { useStrings, type Direction } from '../i18n/strings';
import { speak } from '../navigation/voice';
import type { RouteProfile } from '../routing/cost';
import type { TravelMode } from '../routing/rules';
import { useSettings } from '../state/settings';

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
    <View style={styles.block}>
      <View style={[styles.row, dir.row]}>
        <Text style={[styles.rowTitle, dir.text, { flex: 1 }]}>{title}</Text>
        {children}
      </View>
      {detail && <Text style={[styles.rowDetail, dir.text]}>{detail}</Text>}
    </View>
  );
}

function Toggle({ value, onValueChange, label }: { value: boolean; onValueChange: (v: boolean) => void; label: string }) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ true: colors.ink, false: 'rgba(120,120,128,0.24)' }}
      ios_backgroundColor="rgba(120,120,128,0.24)"
      accessibilityLabel={label}
    />
  );
}

const Separator = ({ dir }: { dir: Direction }) => (
  <View style={[styles.separator, dir.rtl ? { marginRight: 16 } : { marginLeft: 16 }]} />
);

const LEGEND: TravelMode[] = ['bike_lane', 'road_lane', 'road', 'sidewalk', 'shared_path', 'crossing'];

/** A sample prompt for "Test voice", in each language. */
const TEST_PHRASE: Record<Language, string> = {
  en: 'In 200 meters, turn right onto the bike lane',
  he: 'בעוד 200 מטר, פנה ימינה אל שביל האופניים',
};

export default function SettingsScreen() {
  const { settings, update } = useSettings();
  const { t, dir } = useStrings();
  const insets = useSafeAreaInsets();
  const s = t.settings;

  return (
    <ScrollView
      style={styles.screen}
      // On iOS the screen is a sheet that already starts below the status bar.
      contentContainerStyle={[styles.content, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}
    >
      <GlassButton size={44} onPress={() => router.back()} accessibilityLabel={s.a11yClose} style={dir.start}>
        <MaterialCommunityIcons name="close" size={20} color={colors.ink} />
      </GlassButton>
      <Text style={[styles.title, dir.text]}>{s.title}</Text>

      <Text style={[styles.section, dir.text]}>{s.sectionLanguage}</Text>
      <View style={styles.card}>
        <View style={styles.block}>
          <Text style={[styles.rowTitle, dir.text]}>{s.language}</Text>
          <Text style={[styles.rowDetail, dir.text]}>{s.languageDetail}</Text>
          <View style={styles.control}>
            <Segmented<Language>
              options={[
                { value: 'he', label: 'עברית' },
                { value: 'en', label: 'English' },
              ]}
              value={settings.language}
              onChange={(v) => update({ language: v })}
              dir={dir}
            />
          </View>
        </View>
        <Separator dir={dir} />
        <Row title={s.voiceGuidance} dir={dir}>
          <Toggle
            value={settings.voiceEnabled}
            onValueChange={(v) => update({ voiceEnabled: v })}
            label={s.voiceGuidance}
          />
        </Row>
        <Separator dir={dir} />
        <Pressable
          style={({ pressed }) => [styles.block, styles.row, dir.row, pressed && styles.pressed]}
          onPress={() => speak(TEST_PHRASE[settings.language], settings.language)}
          accessibilityRole="button"
        >
          <View style={styles.tile}>
            <MaterialCommunityIcons name="play" size={18} color={colors.ink} />
          </View>
          <Text style={[styles.rowTitle, dir.text, { flex: 1 }]}>{s.testVoice}</Text>
        </Pressable>
      </View>

      <Text style={[styles.section, dir.text]}>{s.sectionRoute}</Text>
      <View style={styles.card}>
        <View style={styles.block}>
          <Text style={[styles.rowTitle, dir.text]}>{s.preference}</Text>
          <View style={styles.control}>
            <Segmented<RouteProfile>
              options={[
                { value: 'safest', label: t.route.safest },
                { value: 'fastest', label: t.route.fastest },
              ]}
              value={settings.profile}
              onChange={(v) => update({ profile: v })}
              dir={dir}
            />
          </View>
          <Text style={[styles.rowDetail, dir.text]}>
            {settings.profile === 'safest' ? s.safestDetail : s.fastestDetail}
          </Text>
        </View>
        <Separator dir={dir} />
        <View style={styles.block}>
          <View style={[styles.row, dir.row]}>
            <Text style={[styles.rowTitle, dir.text, { flex: 1 }]}>{s.cruisingSpeed}</Text>
            <Text style={styles.value}>{s.kmh(settings.cruiseSpeed)}</Text>
          </View>
          <View style={styles.control}>
            <Segmented<number>
              options={[15, 20, 25].map((v) => ({ value: v, label: s.kmh(v) }))}
              value={settings.cruiseSpeed}
              onChange={(v) => update({ cruiseSpeed: v })}
              dir={dir}
            />
          </View>
        </View>
        <Separator dir={dir} />
        <Row title={s.strict} detail={s.strictDetail} dir={dir}>
          <Toggle value={settings.strictUnknown} onValueChange={(v) => update({ strictUnknown: v })} label={s.strict} />
        </Row>
      </View>

      <Text style={[styles.section, dir.text]}>{s.sectionRules}</Text>
      <View style={[styles.card, styles.rules]}>
        {s.rules.map((rule) => {
          const numbered = /^(\d+)\.\s*(.*)$/.exec(rule);
          return (
            <View key={rule} style={[styles.ruleRow, dir.row]}>
              {numbered ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{numbered[1]}</Text>
                </View>
              ) : (
                <MaterialCommunityIcons name="cancel" size={26} color={colors.muted} />
              )}
              <Text style={[styles.rule, dir.text, !numbered && { color: colors.muted }]}>
                {numbered ? numbered[2] : rule}
              </Text>
            </View>
          );
        })}
        <View style={styles.separator} />
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
          <Toggle value={settings.simulate} onValueChange={(v) => update({ simulate: v })} label={s.simulate} />
        </Row>
      </View>

      <Text style={[styles.footer, dir.text]}>{s.footer}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { paddingHorizontal: 16, paddingBottom: 48 },
  title: { fontSize: 34, fontWeight: '700', letterSpacing: -0.6, color: colors.text, marginTop: 14, marginHorizontal: 4 },
  section: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 26, marginBottom: 8, marginHorizontal: 16 },
  card: { backgroundColor: colors.surface, borderRadius: 26, overflow: 'hidden' },
  block: { paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 28 },
  pressed: { backgroundColor: colors.fill },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator },
  rowTitle: { fontSize: 17, color: colors.text },
  rowDetail: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  control: { marginVertical: 8 },
  value: { fontSize: 17, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  tile: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rules: { paddingHorizontal: 16, paddingVertical: 18, gap: 16 },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  rule: { flex: 1, fontSize: 15, lineHeight: 21, color: colors.text, paddingTop: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 18, height: 6, borderRadius: 3 },
  legendText: { fontSize: 13, color: colors.text },
  footer: { fontSize: 12, color: colors.muted, marginTop: 22, marginHorizontal: 16, lineHeight: 18 },
});
