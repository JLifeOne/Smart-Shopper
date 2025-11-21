import React from 'react';
import { SafeAreaView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { featureFlags } from '@/src/lib/env';
import { Toast } from '@/src/components/search/Toast';

export default function MenuInboxScreen() {
  const isPremium = featureFlags.menuIngestion ?? false;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Menus</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>Beta</Text>
        </View>
      </View>
      <Text style={styles.subtitle}>
        Review menu captures. Premium unlocks recipes and shopping plans; non-premium can save dish titles only.
      </Text>

      {isPremium ? (
        <View style={styles.card}>
          <Ionicons name="restaurant" size={24} color="#0C1D37" />
          <Text style={styles.cardTitle}>Menu review</Text>
          <Text style={styles.cardBody}>No menus yet. Scan a menu to see detected dishes here.</Text>
          <Pressable
            style={styles.primary}
            onPress={() => Toast.show('Start a menu scan from the New list modal.', 1600)}
          >
            <Text style={styles.primaryLabel}>Scan a menu</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <Ionicons name="lock-closed" size={24} color="#0C1D37" />
          <Text style={styles.cardTitle}>Premium required</Text>
          <Text style={styles.cardBody}>
            Upgrade to unlock full menu parsing. Or save dish titles only to your library.
          </Text>
          <Pressable style={styles.primary} onPress={() => Toast.show('Upgrade flow coming soon.', 1500)}>
            <Text style={styles.primaryLabel}>Upgrade</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => Toast.show('Saved dish titles only.', 1500)}>
            <Text style={styles.secondaryLabel}>Save titles only</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    padding: 20,
    gap: 12
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0C1D37'
  },
  badge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#312E81'
  },
  subtitle: {
    fontSize: 14,
    color: '#475569'
  },
  card: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    gap: 8,
    shadowColor: '#101828',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0C1D37'
  },
  cardBody: {
    fontSize: 14,
    color: '#475569'
  },
  primary: {
    marginTop: 8,
    backgroundColor: '#0C1D37',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center'
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  secondary: {
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  secondaryLabel: {
    color: '#0C1D37',
    fontWeight: '700'
  }
});
