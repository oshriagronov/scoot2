import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, MODE_STYLE } from '../components/theme';
import type { VoiceLanguage } from '../i18n/phrases';
import { speak } from '../navigation/voice';
import type { RouteProfile } from '../routing/cost';
import type { TravelMode } from '../routing/rules';
import { useSettings } from '../state/settings';

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
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

function Row({ title, detail, children }: { title: string; detail?: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {detail && <Text style={styles.rowDetail}>{detail}</Text>}
      </View>
      {children}
    </View>
  );
}

const LEGEND: TravelMode[] = ['bike_lane', 'road_lane', 'road', 'sidewalk', 'shared_path', 'crossing'];

export default function SettingsScreen() {
  const { settings, update } = useSettings();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.section}>Voice</Text>
      <View style={styles.card}>
        <Row title="Voice guidance">
          <Switch value={settings.voiceEnabled} onValueChange={(v) => update({ voiceEnabled: v })} />
        </Row>
        <View style={styles.block}>
          <Text style={styles.rowTitle}>Language</Text>
          <Segmented<VoiceLanguage>
            options={[
              { value: 'en', label: 'English' },
              { value: 'he', label: 'עברית' },
            ]}
            value={settings.voiceLanguage}
            onChange={(v) => update({ voiceLanguage: v })}
          />
          <Pressable
            style={styles.test}
            onPress={() =>
              speak(
                settings.voiceLanguage === 'he'
                  ? 'בעוד 200 מטר, פנה ימינה אל שביל האופניים'
                  : 'In 200 meters, turn right onto the bike lane',
                settings.voiceLanguage,
              )
            }
          >
            <Text style={styles.testText}>Test voice</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.section}>Route</Text>
      <View style={styles.card}>
        <View style={styles.block}>
          <Text style={styles.rowTitle}>Preference</Text>
          <Segmented<RouteProfile>
            options={[
              { value: 'safest', label: 'Safest' },
              { value: 'fastest', label: 'Fastest' },
            ]}
            value={settings.profile}
            onChange={(v) => update({ profile: v })}
          />
          <Text style={styles.rowDetail}>
            {settings.profile === 'safest'
              ? 'Prefers bike lanes and quiet 30 km/h streets, even if the ride is a bit longer.'
              : 'Shortest legal ride time. Still never uses roads above 50 km/h.'}
          </Text>
        </View>
        <View style={styles.block}>
          <Text style={styles.rowTitle}>Your cruising speed</Text>
          <Segmented<number>
            options={[15, 20, 25].map((v) => ({ value: v, label: `${v} km/h` }))}
            value={settings.cruiseSpeed}
            onChange={(v) => update({ cruiseSpeed: v })}
          />
        </View>
        <Row
          title="Strict speed limits"
          detail="Main roads with no speed limit in the map data are treated as above 50 km/h, so you ride the sidewalk or avoid them."
        >
          <Switch value={settings.strictUnknown} onValueChange={(v) => update({ strictUnknown: v })} />
        </Row>
      </View>

      <Text style={styles.section}>Riding rules applied</Text>
      <View style={[styles.card, styles.block]}>
        <Text style={styles.rule}>1. Roads only when the speed limit is 50 km/h or less.</Text>
        <Text style={styles.rule}>2. Sidewalks only beside roads whose limit is above 50 km/h.</Text>
        <Text style={styles.rule}>3. Sidewalks with a marked lane for bikes and scooters are always allowed.</Text>
        <Text style={styles.rule}>Motorways, steps and roads closed to bikes are never used.</Text>
        <View style={styles.legend}>
          {LEGEND.map((m) => (
            <View key={m} style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: MODE_STYLE[m].color }]} />
              <Text style={styles.legendText}>{MODE_STYLE[m].label}</Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={styles.section}>Testing</Text>
      <View style={styles.card}>
        <Row title="Simulate ride" detail="Rides the route automatically instead of using GPS, to preview voice guidance.">
          <Switch value={settings.simulate} onValueChange={(v) => update({ simulate: v })} />
        </Row>
      </View>

      <Text style={styles.footer}>
        Routes come from OpenStreetMap data, which may be incomplete or out of date. Always follow
        road signs and local law. Map data © OpenStreetMap contributors (ODbL).
      </Text>
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
    marginLeft: 4,
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
  test: { alignSelf: 'flex-start', paddingVertical: 6 },
  testText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  rule: { fontSize: 15, color: colors.text, lineHeight: 21 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 18, height: 6, borderRadius: 3 },
  legendText: { fontSize: 13, color: colors.text },
  footer: { fontSize: 12, color: colors.muted, marginTop: 20, lineHeight: 17, textAlign: 'center' },
});
