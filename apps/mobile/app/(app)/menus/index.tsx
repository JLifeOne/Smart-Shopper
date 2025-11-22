import React from 'react';
import { SafeAreaView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { featureFlags } from '@/src/lib/env';
import { Toast } from '@/src/components/search/Toast';

const QUICK_ACTIONS = [
  { id: 'scan', label: 'Scan a menu', icon: 'restaurant', toast: 'Menu scan coming soon—hooking into /ingest/menu.' },
  { id: 'import', label: 'Import photo', icon: 'image-outline', toast: 'Photo picker coming soon. Use camera for now.' },
  { id: 'save', label: 'Save dish title', icon: 'bookmark-outline', toast: 'Save dish title only (no recipes) enabled.' }
] as const;

const SAMPLE_AI_MENU = [
  {
    title: 'Lemon herb salmon',
    course: 'Main',
    note: 'AI extracts ingredients and swaps sides if unavailable.',
    confidence: 0.92
  },
  {
    title: 'Charred broccoli',
    course: 'Side',
    note: 'Suggests pantry matches and cheaper substitutions.',
    confidence: 0.88
  },
  {
    title: 'Coconut panna cotta',
    course: 'Dessert',
    note: 'Flags missing items and adds them to a shopping plan.',
    confidence: 0.9
  }
] as const;

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
      <View style={styles.quickActionsRow}>
        {QUICK_ACTIONS.map((action) => (
          <Pressable
            key={action.id}
            style={({ pressed }) => [styles.quickAction, pressed && styles.quickActionPressed]}
            onPress={() => Toast.show(action.toast, 1500)}
          >
            <Ionicons name={action.icon as any} size={16} color="#0C1D37" />
            <Text style={styles.quickActionLabel}>{action.label}</Text>
          </Pressable>
        ))}
      </View>

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
          <View style={styles.intelCard}>
            <View style={styles.intelHeader}>
              <Ionicons name="sparkles" size={16} color="#0F172A" />
              <Text style={styles.intelTitle}>AI preview</Text>
            </View>
            {SAMPLE_AI_MENU.map((dish) => (
              <View key={dish.title} style={styles.intelRow}>
                <View style={styles.intelText}>
                  <Text style={styles.intelDish}>{dish.title}</Text>
                  <Text style={styles.intelMeta}>
                    {dish.course} • {dish.note}
                  </Text>
                </View>
                <View style={styles.intelBadge}>
                  <Text style={styles.intelBadgeLabel}>{Math.round(dish.confidence * 100)}%</Text>
                </View>
              </View>
            ))}
            <Text style={styles.intelFootnote}>
              We detect courses, extract ingredients, and propose a shopping plan you can edit.
            </Text>
          </View>
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
          <View style={[styles.intelCard, styles.intelCardMuted]}>
            <View style={styles.intelHeader}>
              <Ionicons name="sparkles" size={16} color="#475569" />
              <Text style={styles.intelTitle}>What AI does</Text>
            </View>
            <Text style={styles.intelMeta}>
              - Detects dishes, course type, and key ingredients.{'\n'}
              - Builds a shopping plan and suggests substitutions.{'\n'}
              - Saves recipe cards to revisit later.
            </Text>
          </View>
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
  quickActionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap'
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF'
  },
  quickActionPressed: {
    backgroundColor: '#F8FAFC'
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0C1D37'
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
  },
  intelCard: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    backgroundColor: '#F8FAFC',
    gap: 8
  },
  intelCardMuted: {
    backgroundColor: '#F1F5F9'
  },
  intelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  intelTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A'
  },
  intelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6
  },
  intelText: {
    flex: 1,
    gap: 2
  },
  intelDish: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0C1D37'
  },
  intelMeta: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18
  },
  intelBadge: {
    minWidth: 44,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    alignItems: 'center'
  },
  intelBadgeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A'
  },
  intelFootnote: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18
  }
});
