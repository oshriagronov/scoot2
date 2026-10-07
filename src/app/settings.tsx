import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassButton, Segmented } from '../components/controls';
import { themed } from '../components/theme';
import type { Language } from '../i18n/phrases';
import { useStrings, type Direction } from '../i18n/strings';
import { speak } from '../navigation/voice';
import type { RouteProfile } from '../routing/cost';
import { useSettings, type Appearance } from '../state/settings';

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
  const { styles } = useStyles();
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
  const { c } = useStyles();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ true: c.switchOn, false: c.fill }}
      ios_backgroundColor={c.fill}
      accessibilityLabel={label}
    />
  );
}

function Separator({ dir }: { dir: Direction }) {
  const { styles } = useStyles();
  return <View style={[styles.separator, dir.rtl ? { marginRight: 16 } : { marginLeft: 16 }]} />;
}

/** A sample prompt for "Test voice", in each language. */
const TEST_PHRASE: Record<Language, string> = {
  en: 'In 200 meters, turn right onto the bike lane',
  he: 'בעוד 200 מטר, פנה ימינה אל שביל האופניים',
};

export default function SettingsScreen() {
  const { settings, update } = useSettings();
  const { t, dir } = useStrings();
  const insets = useSafeAreaInsets();
  const { c, styles } = useStyles();
  const s = t.settings;

  return (
    <ScrollView
      style={styles.screen}
      // On iOS the screen is a sheet that already starts below the status bar.
      contentContainerStyle={[styles.content, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}
    >
      <GlassButton size={44} onPress={() => router.back()} accessibilityLabel={s.a11yClose} style={dir.start}>
        <MaterialCommunityIcons name="close" size={20} color={c.ink} />
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
            <MaterialCommunityIcons name="play" size={18} color={c.ink} />
          </View>
          <Text style={[styles.rowTitle, dir.text, { flex: 1 }]}>{s.testVoice}</Text>
        </Pressable>
      </View>

      <Text style={[styles.section, dir.text]}>{s.sectionDisplay}</Text>
      <View style={styles.card}>
        <View style={styles.block}>
          <Text style={[styles.rowTitle, dir.text]}>{s.appearance}</Text>
          <View style={styles.control}>
            <Segmented<Appearance>
              options={[
                { value: 'system', label: s.appearanceSystem },
                { value: 'light', label: s.appearanceLight },
                { value: 'dark', label: s.appearanceDark },
              ]}
              value={settings.appearance}
              onChange={(v) => update({ appearance: v })}
              dir={dir}
            />
          </View>
          <Text style={[styles.rowDetail, dir.text]}>{s.appearanceDetail}</Text>
        </View>
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

const useStyles = themed((c) => ({
  screen: { flex: 1, backgroundColor: c.ground },
  content: { paddingHorizontal: 16, paddingBottom: 48 },
  title: { fontSize: 34, fontWeight: '700', letterSpacing: -0.6, color: c.text, marginTop: 14, marginHorizontal: 4 },
  section: { fontSize: 13, fontWeight: '600', color: c.muted, marginTop: 26, marginBottom: 8, marginHorizontal: 16 },
  card: { backgroundColor: c.surface, borderRadius: 26, overflow: 'hidden' },
  block: { paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 28 },
  pressed: { backgroundColor: c.fill },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: c.separator },
  rowTitle: { fontSize: 17, color: c.text },
  rowDetail: { fontSize: 13, color: c.muted, lineHeight: 19 },
  control: { marginVertical: 8 },
  tile: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: c.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { fontSize: 12, color: c.muted, marginTop: 22, marginHorizontal: 16, lineHeight: 18 },
}));
