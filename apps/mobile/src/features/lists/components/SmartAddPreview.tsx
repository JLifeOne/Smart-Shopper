import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import type { EnrichedListEntry } from '@/src/features/lists/parse-list-input';

export type SmartAddPreviewProps = {
  entries: EnrichedListEntry[];
  loading: boolean;
  onCategoryChange: (
    index: number,
    suggestion: { category: string; label: string; confidence: number }
  ) => void;
  theme: {
    accent: string;
    accentDark: string;
    subtitle: string;
    border: string;
    card: string;
  };
};

export function SmartAddPreview({ entries, loading, onCategoryChange, theme }: SmartAddPreviewProps) {
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!entries.length) {
    return null;
  }

  return (
    <View style={styles.preview}>
      <View style={styles.previewHeaderRow}>
        <Text style={styles.previewTitle}>Ready to add</Text>
        {loading ? (
          <View style={styles.previewLoader}>
            <ActivityIndicator size="small" color={theme.accentDark} />
            <Text style={styles.previewLoaderLabel}>Categorizing…</Text>
          </View>
        ) : null}
      </View>
      {entries.map((entry, index) => (
        <View key={`${entry.normalized}-${index}`} style={styles.previewCard}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewItemLabel}>{entry.label}</Text>
            <Text style={styles.previewBadge}>
              Qty {entry.quantity}
              {entry.unit ? ` ${entry.unit}` : ''}
            </Text>
          </View>
          <View style={styles.previewCategoryRow}>
            <Text style={styles.previewCategoryLabel}>Section</Text>
            <Pressable
              style={styles.previewCategoryChip}
              onPress={() =>
                onCategoryChange(index, {
                  category: entry.category,
                  label: entry.categoryLabel,
                  confidence: entry.confidence
                })
              }
            >
              <Text style={styles.previewCategoryChipLabel}>{entry.categoryLabel}</Text>
            </Pressable>
          </View>
          {entry.confidence < 0.6 && entry.suggestions.length ? (
            <View style={styles.previewChips}>
              <Text style={styles.previewSuggestLabel}>Likely:</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.previewChipsScroll}
              >
                {entry.suggestions.map((suggestion) => (
                  <Pressable
                    key={`${entry.normalized}-${suggestion.category}`}
                    style={[
                      styles.previewChip,
                      suggestion.category === entry.category && styles.previewChipActive
                    ]}
                    onPress={() => onCategoryChange(index, suggestion)}
                  >
                    <Text style={styles.previewChipLabel}>{suggestion.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function createStyles(theme: SmartAddPreviewProps['theme']) {
  return StyleSheet.create({
    preview: {
      backgroundColor: theme.card,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 12
    },
    previewHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    previewTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.accentDark
    },
    previewLoader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8
    },
    previewLoaderLabel: {
      fontSize: 12,
      color: theme.subtitle
    },
    previewCard: {
      backgroundColor: '#F8FAFC',
      borderRadius: 16,
      padding: 12,
      gap: 8
    },
    previewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    previewItemLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.accentDark,
      flexShrink: 1,
      marginRight: 12
    },
    previewBadge: {
      fontSize: 12,
      fontWeight: '600',
      color: '#0F172A',
      backgroundColor: '#E6FFFA',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12
    },
    previewCategoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8
    },
    previewCategoryLabel: {
      fontSize: 12,
      color: theme.subtitle,
      fontWeight: '600'
    },
    previewCategoryChip: {
      backgroundColor: '#FFFFFF',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 10,
      paddingVertical: 4
    },
    previewCategoryChipLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.accentDark
    },
    previewChips: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8
    },
    previewSuggestLabel: {
      fontSize: 12,
      color: theme.subtitle,
      fontWeight: '600'
    },
    previewChipsScroll: {
      gap: 8,
      paddingRight: 6
    },
    previewChip: {
      backgroundColor: '#E2E8F0',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12
    },
    previewChipActive: {
      backgroundColor: theme.accent
    },
    previewChipLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: '#0C1D37'
    }
  });
}

