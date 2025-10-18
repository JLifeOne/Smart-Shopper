import { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/src/context/auth-context';

const QUICK_STATS = [
  { label: 'Lists', value: '0' },
  { label: 'Tracked items', value: '0' },
  { label: 'Receipts scanned', value: '0' }
] as const;

const NEXT_ACTIONS = [
  'Create a list via text, voice, or photo capture.',
  'Scan a receipt to populate price history.',
  'Review the calendar heatmap once you have transaction data.'
] as const;

export default function HomeScreen() {
  const { user, signOut, isAuthenticating } = useAuth();
  const welcomeMessage = useMemo(
    () =>
      user?.email
        ? `Hi ${user.email.split('@')[0]}, you are ready to build your first smart list and start price tracking.`
        : 'You are ready to build your first smart list and start price tracking.',
    [user?.email]
  );

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  const initials = useMemo(() => {
    if (!user?.email) {
      return 'SS';
    }
    return user.email
      .split('@')[0]
      .split('.')
      .map((part) => part.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  }, [user?.email]);

  const userLabel = user?.email ?? 'Guest';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.heading}>Dashboard</Text>
          <Text style={styles.subtitle}>{userLabel}</Text>
        </View>
        <Pressable
          onPress={handleSignOut}
          accessibilityRole="button"
          style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutButtonPressed]}
          disabled={isAuthenticating}
        >
          <Text style={styles.signOutLabel}>Sign out</Text>
        </Pressable>
      </View>
      <Text style={styles.welcome}>{welcomeMessage}</Text>
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
        {NEXT_ACTIONS.map((action) => (
          <Text key={action} style={styles.cardBody}>
            - {action}
          </Text>
        ))}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerCopy: {
    flex: 1,
    marginHorizontal: 16
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
  welcome: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 24,
    color: '#0C1D37'
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4FD1C5',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    color: '#0C1D37',
    fontWeight: '700',
    fontSize: 16
  },
  signOutButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#E2E8F0'
  },
  signOutButtonPressed: {
    opacity: 0.75
  },
  signOutLabel: {
    color: '#0C1D37',
    fontWeight: '600',
    fontSize: 14
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
