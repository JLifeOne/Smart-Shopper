import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const QUICK_STATS = [
  { label: 'Lists', value: '0' },
  { label: 'Tracked items', value: '0' },
  { label: 'Receipts scanned', value: '0' }
] as const;

export default function HomeScreen() {
  const welcomeMessage = useMemo(
    () => 'You are ready to build your first smart list and start price tracking.',
    []
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Dashboard</Text>
      <Text style={styles.subtitle}>{welcomeMessage}</Text>
      <View style={styles.card}>
        <Text style={styles.cardHeading}>Quick stats</Text>
        <View style={styles.statRow}>
          {QUICK_STATS.map((stat) => (
            <View key={stat.label} style={styles.stat}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardHeading}>Next actions</Text>
        <Text style={styles.cardBody}>• Create a list via text, voice, or photo capture.</Text>
        <Text style={styles.cardBody}>• Scan a receipt to populate price history.</Text>
        <Text style={styles.cardBody}>
          • Review the calendar heatmap once you have transaction data.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
    gap: 24
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0C1D37'
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#4A576D'
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#101828',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
    gap: 8
  },
  cardHeading: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0C1D37',
    marginBottom: 8
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  stat: {
    alignItems: 'center',
    flex: 1,
    gap: 4
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0C1D37'
  },
  statLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#6C7A91'
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4A576D'
  }
});
