import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EnrichedListEntry } from '@/src/features/lists/parse-list-input';
import taxonomy from '@/src/categorization/taxonomy.json';

export type SmartAddPreviewProps = {
  entries: EnrichedListEntry[];
  loading: boolean;
  onCategoryChange: (
    index: number,
    suggestion: EnrichedListEntry['suggestions'][number]
  ) => void;
  onUnitChange?: (index: number, unit: string) => void;
  theme: {
    accent: string;
    accentDark: string;
    subtitle: string;
    border: string;
    card: string;
  };
};

type CategoryOption = { id: string; label: string; isCustom?: boolean };

const UNIT_OPTIONS = ['qty', 'kg', 'g', 'lb', 'oz', 'l', 'ml', 'gal', 'pk', 'bx', 'case', 'btl'];
const CUSTOM_CATEGORY_STORAGE_KEY = '@smart-shopper:custom-categories';

export function SmartAddPreview({
  entries,
  loading,
  onCategoryChange,
  onUnitChange,
  theme
}: SmartAddPreviewProps) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [categoryModalIndex, setCategoryModalIndex] = useState<number | null>(null);
  const [unitModalIndex, setUnitModalIndex] = useState<number | null>(null);
  const [customCategories, setCustomCategories] = useState<CategoryOption[]>([]);
  const [customCategoryName, setCustomCategoryName] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(CUSTOM_CATEGORY_STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as CategoryOption[];
        if (Array.isArray(parsed)) {
          setCustomCategories(parsed);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(CUSTOM_CATEGORY_STORAGE_KEY, JSON.stringify(customCategories)).catch(
      () => undefined
    );
  }, [customCategories]);

  const categoryOptions = useMemo(() => {
    const baseOptions: CategoryOption[] = taxonomy.categories.map((category) => ({
      id: category.id,
      label: category.label
    }));
    const combined = [...baseOptions, ...customCategories];
    return combined.sort((a, b) => a.label.localeCompare(b.label));
  }, [customCategories]);

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
            <View style={styles.previewItemLabelWrap}>
              <Text style={styles.previewItemLabel}>{entry.label}</Text>
              <Text
                style={[
                  styles.previewAssignment,
                  entry.assignment === 'auto'
                    ? styles.assignmentAuto
                    : entry.assignment === 'needs_review'
                      ? styles.assignmentReview
                      : styles.assignmentNeedsInput
                ]}
              >
                {entry.assignment === 'auto'
                  ? 'Auto'
                  : entry.assignment === 'needs_review'
                    ? 'Needs review'
                    : 'Needs input'}
              </Text>
            </View>
            <Pressable
              style={styles.previewQtyChip}
              onPress={() => setUnitModalIndex(index)}
            >
              <Text style={styles.previewQtyChipLabel}>
                {entry.unit ? `${entry.unit.toUpperCase()} ${entry.quantity}` : `Qty ${entry.quantity}`}
              </Text>
            </Pressable>
          </View>
          <View style={styles.previewCategoryRow}>
            <Text style={styles.previewCategoryLabel}>Section</Text>
            <Pressable
              style={styles.previewCategoryChip}
              onPress={() =>
                onCategoryChange(index, {
                  category: entry.category,
                  label: entry.categoryLabel,
                  confidence: entry.confidence,
                  band: entry.assignment,
                  source: entry.categorySource ?? null,
                  canonicalName: entry.categoryCanonical ?? null
                })
              }
            >
              <Text style={styles.previewCategoryChipLabel}>{entry.categoryLabel}</Text>
            </Pressable>
            <Pressable
              style={styles.previewEditChip}
              onPress={() => {
                setCustomCategoryName('');
                setCategoryModalIndex(index);
              }}
            >
              <Text style={styles.previewEditChipLabel}>Edit</Text>
            </Pressable>
          </View>
          {entry.assignment !== 'auto' && entry.suggestions.length ? (
            <View style={styles.previewChips}>
              <Text style={styles.previewSuggestLabel}>
                {entry.assignment === 'needs_review' ? 'Likely:' : 'Try:'}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.previewChipsScroll}
              >
                {entry.suggestions.map((suggestion, idx) => (
                  <Pressable
                    key={`${entry.normalized}-${suggestion.category}-${idx}`}
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
      <CategoryPickerModal
        visible={categoryModalIndex !== null}
        options={categoryOptions}
        customName={customCategoryName}
        onChangeCustomName={setCustomCategoryName}
        onSelect={(option) => {
          if (categoryModalIndex === null) return;
          onCategoryChange(categoryModalIndex, {
            category: option.id,
            label: option.label,
            confidence: 0.95,
            band: 'needs_review',
            source: option.isCustom ? 'manual' : 'dictionary',
            canonicalName: option.label
          });
          setCategoryModalIndex(null);
        }}
        onAddCustom={() => {
          if (!customCategoryName.trim()) {
            return;
          }
          const label = customCategoryName.trim();
          const id = `custom:${label.toLowerCase().replace(/\s+/g, '-')}`;
          const next = { id, label, isCustom: true };
          setCustomCategories((current) => {
            if (current.some((entry) => entry.id === id)) {
              return current;
            }
            return [...current, next];
          });
          setCustomCategoryName('');
        }}
        onClose={() => setCategoryModalIndex(null)}
      />
      <UnitPickerModal
        visible={unitModalIndex !== null}
        units={UNIT_OPTIONS}
        onSelect={(unit) => {
          if (unitModalIndex !== null && onUnitChange) {
            onUnitChange(unitModalIndex, unit);
          }
          setUnitModalIndex(null);
        }}
        onClose={() => setUnitModalIndex(null)}
      />
    </View>
  );
}

function CategoryPickerModal({
  visible,
  options,
  customName,
  onChangeCustomName,
  onSelect,
  onAddCustom,
  onClose
}: {
  visible: boolean;
  options: CategoryOption[];
  customName: string;
  onChangeCustomName: (value: string) => void;
  onSelect: (option: CategoryOption) => void;
  onAddCustom: () => void;
  onClose: () => void;
}) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={modalStyles.backdrop}>
        <View style={modalStyles.card}>
          <Text style={modalStyles.title}>Select category</Text>
          <FlatList
            data={options}
            keyExtractor={(item) => item.id}
            style={modalStyles.list}
            renderItem={({ item }) => (
              <Pressable style={modalStyles.listItem} onPress={() => onSelect(item)}>
                <Text style={modalStyles.listItemLabel}>{item.label}</Text>
              </Pressable>
            )}
          />
          <View style={modalStyles.customRow}>
            <TextInput
              style={modalStyles.input}
              placeholder="Add new category"
              value={customName}
              onChangeText={onChangeCustomName}
            />
            <Pressable style={modalStyles.addButton} onPress={onAddCustom}>
              <Text style={modalStyles.addButtonLabel}>Save</Text>
            </Pressable>
          </View>
          <Pressable style={modalStyles.closeButton} onPress={onClose}>
            <Text style={modalStyles.closeButtonLabel}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function UnitPickerModal({
  visible,
  units,
  onSelect,
  onClose
}: {
  visible: boolean;
  units: string[];
  onSelect: (unit: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={modalStyles.backdrop}>
        <View style={modalStyles.card}>
          <Text style={modalStyles.title}>Select unit</Text>
          <FlatList
            data={units}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <Pressable style={modalStyles.listItem} onPress={() => onSelect(item)}>
                <Text style={modalStyles.listItemLabel}>{item.toUpperCase()}</Text>
              </Pressable>
            )}
          />
          <Pressable style={modalStyles.closeButton} onPress={onClose}>
            <Text style={modalStyles.closeButtonLabel}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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
    previewItemLabelWrap: {
      flex: 1,
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center'
    },
    previewItemLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.accentDark,
      flexShrink: 1
    },
    previewAssignment: {
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999
    },
    assignmentAuto: {
      backgroundColor: '#DCFCE7',
      color: '#0F9D58'
    },
    assignmentReview: {
      backgroundColor: '#FEF9C3',
      color: '#A16207'
    },
    assignmentNeedsInput: {
      backgroundColor: '#FFE4E6',
      color: '#B91C1C'
    },
    previewQtyChip: {
      backgroundColor: '#E0F2FE',
      borderRadius: 16,
      paddingHorizontal: 10,
      paddingVertical: 4
    },
    previewQtyChipLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.accentDark
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
    previewEditChip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 14,
      backgroundColor: '#EEF2FF'
    },
    previewEditChipLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: '#1D4ED8'
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

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    maxHeight: '80%'
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    color: '#0C1D37'
  },
  list: {
    maxHeight: 240,
    marginBottom: 12
  },
  listItem: {
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0'
  },
  listItemLabel: {
    fontSize: 14,
    color: '#0C1D37'
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  addButton: {
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12
  },
  addButtonLabel: {
    color: '#FFFFFF',
    fontWeight: '600'
  },
  closeButton: {
    marginTop: 12,
    alignSelf: 'flex-end'
  },
  closeButtonLabel: {
    color: '#1D4ED8',
    fontWeight: '600'
  }
});
