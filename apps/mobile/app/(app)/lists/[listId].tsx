import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useList } from '@/src/features/lists/use-list';
import type { List } from '@/src/database/models/list';
import { useListItems, type ListItemSummary } from '@/src/features/list-items/use-list-items';
import {
  adjustListItemQuantity,
  createListItem,
  deleteListItem,
  setListItemChecked,
  updateListItemDetails
} from '@/src/features/list-items/mutations';
import { setListStore } from '@/src/features/lists/mutations';
import { useSearchOverlay } from '@/src/providers/SearchOverlayProvider';
import { trackEvent } from '@/src/lib/analytics';
import { parseListInput, enrichParsedEntries, type EnrichedListEntry } from '@/src/features/lists/parse-list-input';
import { defaultAisleOrderFor, storeSuggestionsFor, stores, type StoreDefinition } from '@/src/data/stores';
import { SmartAddPreview } from '@/src/features/lists/components/SmartAddPreview';
import { Toast } from '@/src/components/search/Toast';

const palette = {
  background: '#F5F7FA',
  card: '#FFFFFF',
  accent: '#4FD1C5',
  accentDark: '#0C1D37',
  border: '#E2E8F0',
  subtitle: '#4A576D'
};

const OTHER_CATEGORY = 'OTHER';

type SectionRow = {
  title: string;
  categoryId: string;
  data: ListItemSummary[];
};

function compareItems(a: ListItemSummary, b: ListItemSummary) {
  const baseCompare = a.baseName.localeCompare(b.baseName);
  if (baseCompare !== 0) {
    return baseCompare;
  }
  const variantA = a.variant ?? '';
  const variantB = b.variant ?? '';
  const variantCompare = variantA.localeCompare(variantB);
  if (variantCompare !== 0) {
    return variantCompare;
  }
  return a.label.localeCompare(b.label);
}

function formatPrice(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function formatRelative(timestamp: number | null | undefined) {
  if (!timestamp) {
    return 'recently';
  }
  const diff = Date.now() - timestamp;
  const day = 1000 * 60 * 60 * 24;
  if (diff < day) {
    const hours = Math.max(1, Math.round(diff / (1000 * 60 * 60)));
    return `${hours}h ago`;
  }
  const days = Math.round(diff / day);
  if (days < 30) {
    return `${days}d ago`;
  }
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

function formatItemTitle(item: ListItemSummary) {
  if (item.variant) {
    return `${item.baseName} ${item.variant}`;
  }
  return item.baseName;
}

function parseAisleOrder(list: List | null | undefined) {
  if (!list) {
    return null;
  }
  if (list.aisleOrder) {
    try {
      const parsed = JSON.parse(list.aisleOrder) as string[];
      if (Array.isArray(parsed) && parsed.length) {
        return parsed;
      }
    } catch (error) {
      console.warn('Failed to parse aisle order', error);
    }
  }
  return defaultAisleOrderFor(list.storeId);
}

function sectionSortOrder(categoryId: string, aisleOrder: string[] | null | undefined): number {
  if (!aisleOrder?.length) {
    return Number.MAX_SAFE_INTEGER;
  }
  const idx = aisleOrder.findIndex((entry) => entry === categoryId);
  return idx === -1 ? aisleOrder.length + 1 : idx;
}

export default function ListDetailScreen() {
  const { listId } = useLocalSearchParams<{ listId?: string }>();
  const router = useRouter();
  const { list, loading, error } = useList(listId);
  const { items, loading: itemsLoading, mutateItem, removeItem, restoreItem } = useListItems(listId ?? null);
  const [draft, setDraft] = useState('');
  const [parsedEntries, setParsedEntries] = useState<EnrichedListEntry[]>([]);
  const [parsing, setParsing] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [storePickerVisible, setStorePickerVisible] = useState(false);
  const [editorItem, setEditorItem] = useState<ListItemSummary | null>(null);
  const [editorNote, setEditorNote] = useState('');
  const [editorQty, setEditorQty] = useState(1);
  const { setActiveListId } = useSearchOverlay();

  useEffect(() => {
    if (listId) {
      setActiveListId(String(listId));
    }
    return () => setActiveListId(null);
  }, [listId, setActiveListId]);

  useEffect(() => {
    if (!draft.trim()) {
      setParsedEntries([]);
      setParsing(false);
      return;
    }
    const parsed = parseListInput(draft);
    if (!parsed.length) {
      setParsedEntries([]);
      setParsing(false);
      return;
    }
    let cancelled = false;
    setParsing(true);
    enrichParsedEntries(parsed, { merchantCode: list?.storeId ?? null })
      .then((entries) => {
        if (!cancelled) {
          setParsedEntries(entries);
          setParsing(false);
        }
      })
      .catch((err) => {
        console.error('Failed to enrich parsed entries', err);
        if (!cancelled) {
          setParsedEntries(
            parsed.map((entry) => ({
              ...entry,
              category: 'pantry',
              categoryLabel: 'Pantry',
              confidence: 0.2,
              suggestions: []
            }))
          );
          setParsing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [draft, list?.storeId]);

  useEffect(() => {
    if (!editorItem) {
      return;
    }
    setEditorQty(editorItem.desiredQty);
    setEditorNote(editorItem.notes ?? '');
  }, [editorItem]);

  const aisleOrder = useMemo(() => parseAisleOrder(list), [list]);
  const currentStore = useMemo(
    () => (list?.storeId ? stores.find((entry) => entry.id === list.storeId) ?? null : null),
    [list?.storeId]
  );
  const storeOptions = useMemo(
    () => storeSuggestionsFor(list?.storeRegion ?? currentStore?.region ?? undefined),
    [list?.storeRegion, currentStore?.region]
  );

  const totalQuantity = useMemo(
    () => items.reduce((total, item) => total + item.desiredQty, 0),
    [items]
  );

  const { activeSections, completedItems } = useMemo(() => {
    if (!items.length) {
      return { activeSections: [] as SectionRow[], completedItems: [] as ListItemSummary[] };
    }
    const groups = new Map<
      string,
      {
        title: string;
        categoryId: string;
        data: ListItemSummary[];
      }
    >();
    const doneItems: ListItemSummary[] = [];

    items.forEach((item) => {
      if (item.isChecked) {
        doneItems.push(item);
        return;
      }
      const categoryId = item.category ?? OTHER_CATEGORY;
      const key = categoryId.toLowerCase();
      const existing = groups.get(key);
      if (existing) {
        existing.data.push(item);
      } else {
        groups.set(key, {
          title: (item.categoryLabel || categoryId).toUpperCase(),
          categoryId,
          data: [item]
        });
      }
    });

    const sortedActive = Array.from(groups.values())
      .sort((a, b) => {
        const orderDiff =
          sectionSortOrder(a.categoryId, aisleOrder) - sectionSortOrder(b.categoryId, aisleOrder);
        if (orderDiff !== 0) {
          return orderDiff;
        }
        return a.title.localeCompare(b.title);
      })
      .map(({ title, categoryId, data }) => ({
        title,
        categoryId,
        data: data.slice().sort(compareItems)
      }));

    const sortedDone = doneItems.slice().sort(compareItems);

    return { activeSections: sortedActive, completedItems: sortedDone };
  }, [aisleOrder, items]);

  const doneCount = completedItems.length;
  const visibleSections = showCompleted && doneCount
    ? [
        ...activeSections,
        {
          title: 'DONE',
          categoryId: '__done__',
          data: completedItems
        }
      ]
    : activeSections;

  const handleAdd = useCallback(async () => {
    if (!listId) {
      return;
    }
    const sourceEntries = parsedEntries.length
      ? parsedEntries
      : parseListInput(draft).map((entry) => ({
          ...entry,
          category: 'pantry',
          categoryLabel: 'Pantry',
          confidence: 0.2,
          suggestions: []
        }));

    if (!sourceEntries.length) {
      Alert.alert('Add an item', 'Type at least one item to add.');
      return;
    }
    try {
      for (const entry of sourceEntries) {
        await createListItem(listId, entry.label, entry.quantity, {
          unit: entry.unit,
          category: entry.category,
          merchantCode: list?.storeId ?? null
        });
      }
      trackEvent('list_items_bulk_created', {
        count: sourceEntries.length,
        storeId: list?.storeId,
        categories: Array.from(new Set(sourceEntries.map((entry) => entry.category)))
      });
      Toast.show(
        sourceEntries.length === 1
          ? `Added ${sourceEntries[0].label}`
          : `Added ${sourceEntries.length} items`
      );
      setDraft('');
      setParsedEntries([]);
    } catch (err) {
      console.error('Failed to add items', err);
      Alert.alert('Could not add items', err instanceof Error ? err.message : 'Try again.');
    }
  }, [draft, list?.storeId, listId, parsedEntries]);

  const handleAdjustQuantity = useCallback(
    (item: ListItemSummary, delta: number) => {
      const proposed = item.desiredQty + delta;
      if (proposed < 1 || delta === 0) {
        return;
      }
      const previousQty = item.desiredQty;
      mutateItem(item.id, (current) => ({
        ...current,
        desiredQty: proposed
      }));
      adjustListItemQuantity(item.id, delta).catch((err) => {
        console.error('Failed to adjust quantity', err);
        mutateItem(item.id, (current) => ({
          ...current,
          desiredQty: previousQty
        }));
        Alert.alert('Could not adjust quantity', err instanceof Error ? err.message : 'Try again.');
      });
    },
    [mutateItem]
  );

  const handleToggleChecked = useCallback(
    (item: ListItemSummary) => {
      const nextChecked = !item.isChecked;
      Haptics.selectionAsync().catch(() => undefined);
      mutateItem(item.id, (current) => ({
        ...current,
        isChecked: nextChecked
      }));
      setListItemChecked(item.id, nextChecked)
        .then(() => {
          trackEvent(nextChecked ? 'list_item_checked' : 'list_item_unchecked', {
            listId,
            itemId: item.id,
            category: item.category,
            qty: item.desiredQty
          });
        })
        .catch((err) => {
          console.error('Failed to toggle item', err);
          mutateItem(item.id, (current) => ({
            ...current,
            isChecked: item.isChecked
          }));
          Alert.alert('Could not update item', err instanceof Error ? err.message : 'Try again.');
        });
    },
    [listId, mutateItem]
  );

  const handleDelete = useCallback((item: ListItemSummary) => {
    const index = items.findIndex((entry) => entry.id === item.id);
    Alert.alert('Remove item', `Remove ${item.label} from this list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          removeItem(item.id);
          deleteListItem(item.id)
            .then(() => {
              trackEvent('list_item_deleted', { listId, itemId: item.id });
              Toast.show(`Removed ${item.label}`);
            })
            .catch((err) => {
              console.error('Failed to remove item', err);
              restoreItem(item, index);
              Alert.alert('Could not remove item', err instanceof Error ? err.message : 'Try again.');
            });
        }
      }
    ]);
  }, [items, listId, removeItem, restoreItem]);

  const handleDraftCategoryChange = useCallback(
    (entryIndex: number, suggestion: { category: string; label: string; confidence: number }) => {
      setParsedEntries((entries) =>
        entries.map((entry, idx) =>
          idx === entryIndex
            ? {
                ...entry,
                category: suggestion.category,
                categoryLabel: suggestion.label,
                confidence: suggestion.confidence
              }
            : entry
        )
      );
    },
    []
  );

  const handleStoreSelect = useCallback(
    async (store: StoreDefinition | null) => {
      if (!listId) {
        return;
      }
      try {
        await setListStore(listId, store);
        setStorePickerVisible(false);
        Toast.show(store ? `Store set to ${store.label}` : 'Store cleared');
      } catch (err) {
        console.error('Failed to set store', err);
        Alert.alert('Could not update store', err instanceof Error ? err.message : 'Try again.');
      }
    },
    [listId]
  );

  const handleListItemLongPress = useCallback((item: ListItemSummary) => {
    setEditorItem(item);
  }, []);

  const handleEditorClose = useCallback(() => {
    setEditorItem(null);
  }, []);

  const handleEditorQtyChange = useCallback((delta: number) => {
    setEditorQty((qty) => Math.max(1, qty + delta));
  }, []);

  const handleEditorSave = useCallback(async () => {
    if (!editorItem) {
      return;
    }
    const trimmedNote = editorNote.trim();
    const updates: { desiredQty?: number; notes?: string | null } = {};
    if (editorQty !== editorItem.desiredQty) {
      updates.desiredQty = editorQty;
    }
    if ((editorItem.notes ?? '') !== trimmedNote) {
      updates.notes = trimmedNote.length ? trimmedNote : null;
    }
    if (!Object.keys(updates).length) {
      setEditorItem(null);
      return;
    }
    try {
      mutateItem(editorItem.id, (current) => ({
        ...current,
        desiredQty: updates.desiredQty ?? current.desiredQty,
        notes: updates.notes !== undefined ? updates.notes : current.notes
      }));
      await updateListItemDetails(editorItem.id, updates);
      trackEvent('list_item_updated', {
        listId,
        itemId: editorItem.id,
        updates: Object.keys(updates)
      });
      Toast.show('Item updated');
      setEditorItem(null);
    } catch (err) {
      console.error('Failed to update item', err);
      mutateItem(editorItem.id, () => ({ ...editorItem }));
      Alert.alert('Could not update item', err instanceof Error ? err.message : 'Try again.');
    }
  }, [editorItem, editorNote, editorQty, listId, mutateItem]);

  const handleEditorDelete = useCallback(() => {
    if (!editorItem) {
      return;
    }
    handleDelete(editorItem);
    setEditorItem(null);
  }, [editorItem, handleDelete]);

  const toggleCompletedVisibility = useCallback(() => {
    setShowCompleted((prev) => !prev);
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="small" color={palette.accentDark} />
      </SafeAreaView>
    );
  }

  if (error || !list) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.error}>{error ?? 'List not found'}</Text>
        <Pressable style={styles.linkButton} onPress={() => router.back()}>
          <Text style={styles.linkButtonLabel}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={palette.accentDark} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>{list.name}</Text>
          <Text style={styles.subtitle}>
            {totalQuantity} items \u2022 Updated {formatRelative(list.updatedAt)}
          </Text>
          <View style={styles.metaRow}>
            <Pressable
              style={styles.storePill}
              onPress={() => setStorePickerVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Select store"
            >
              <Ionicons name="storefront-outline" size={16} color={palette.accentDark} />
              <Text
                style={[
                  styles.storePillLabel,
                  !list.storeLabel && styles.storePillLabelMuted
                ]}
              >
                {list.storeLabel ?? 'Select store'}
              </Text>
            </Pressable>
            {doneCount ? (
              <Pressable
                style={styles.doneToggle}
                onPress={toggleCompletedVisibility}
                accessibilityRole="button"
                accessibilityLabel="Toggle completed items"
              >
                <Ionicons
                  name={showCompleted ? 'eye-off-outline' : 'eye-outline'}
                  size={14}
                  color={palette.accentDark}
                />
                <Text style={styles.doneToggleLabel}>
                  {showCompleted ? 'Hide done' : 'Show done'} ({doneCount})
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.addRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Add milk, eggs, bread..."
          placeholderTextColor={palette.subtitle}
          onSubmitEditing={(event) => {
            const text = event.nativeEvent.text ?? '';
            if (!text.endsWith('\n')) {
              setDraft((current) => {
                if (current === text) {
                  return `${text}\n`;
                }
                return current.endsWith('\n') ? current : `${current}\n`;
              });
            }
          }}
          style={styles.input}
          multiline
          returnKeyType="default"
          blurOnSubmit={false}
        />
        <Pressable
          style={[
            styles.addButton,
            (parsing || (!parsedEntries.length && !draft.trim())) && styles.addButtonDisabled
          ]}
          onPress={handleAdd}
          accessibilityRole="button"
          accessibilityLabel="Add items"
          disabled={parsing || (!parsedEntries.length && !draft.trim())}
        >
          {parsing ? (
            <ActivityIndicator size="small" color={palette.accentDark} />
          ) : (
            <Text style={styles.addButtonLabel}>Add</Text>
          )}
        </Pressable>
      </View>

      {parsedEntries.length ? (
        <SmartAddPreview
          entries={parsedEntries}
          loading={parsing}
          onCategoryChange={handleDraftCategoryChange}
          theme={{
            accent: palette.accent,
            accentDark: palette.accentDark,
            subtitle: palette.subtitle,
            border: palette.border,
            card: palette.card
          }}
        />
      ) : null}

      {itemsLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={palette.accentDark} />
        </View>
      ) : visibleSections.length === 0 ? (
        completedItems.length ? (
          <View style={styles.emptyState}>
            <Ionicons name="sparkles-outline" size={28} color={palette.accent} />
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.emptyBody}>Everything on this list is checked off.</Text>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="list-outline" size={28} color={palette.accent} />
            <Text style={styles.emptyTitle}>Add your first item</Text>
            <Text style={styles.emptyBody}>Type items above and tap add to fill this list.</Text>
          </View>
        )
      ) : (
        <SectionList
          sections={visibleSections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <ListItemRow
              item={item}
              onToggle={handleToggleChecked}
              onAdjust={handleAdjustQuantity}
              onLongPress={handleListItemLongPress}
            />
          )}
        />
      )}

      <StorePickerSheet
        visible={storePickerVisible}
        options={storeOptions.length ? storeOptions : stores}
        currentStoreId={list.storeId}
        onClose={() => setStorePickerVisible(false)}
        onSelect={handleStoreSelect}
      />

      <ListItemEditorModal
        visible={!!editorItem}
        itemName={editorItem?.label ?? ''}
        qty={editorQty}
        note={editorNote}
        onClose={handleEditorClose}
        onChangeQty={handleEditorQtyChange}
        onChangeNote={setEditorNote}
        onSave={handleEditorSave}
        onDelete={handleEditorDelete}
      />

      <Toast.Host />
    </SafeAreaView>
  );
}

function StorePickerSheet({
  visible,
  options,
  currentStoreId,
  onClose,
  onSelect
}: {
  visible: boolean;
  options: StoreDefinition[];
  currentStoreId: string | null;
  onClose: () => void;
  onSelect: (store: StoreDefinition | null) => void;
}) {
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.storeSheetBackdrop}>
        <Pressable style={styles.storeSheetDismiss} onPress={onClose} />
        <View style={styles.storeSheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Choose store</Text>
            <Pressable style={styles.sheetClose} onPress={onClose}>
              <Ionicons name="close" size={18} color={palette.accentDark} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.storeList}>
            <Pressable
              style={[styles.storeOption, !currentStoreId && styles.storeOptionActive]}
              onPress={() => onSelect(null)}
            >
              <View>
                <Text style={styles.storeOptionLabel}>No store</Text>
                <Text style={styles.storeOptionSubtitle}>Generic order</Text>
              </View>
              {!currentStoreId ? (
                <Ionicons name="checkmark-circle" size={18} color={palette.accent} />
              ) : null}
            </Pressable>
            {options.map((store) => (
              <Pressable
                key={store.id}
                style={[
                  styles.storeOption,
                  currentStoreId === store.id && styles.storeOptionActive
                ]}
                onPress={() => onSelect(store)}
              >
                <View>
                  <Text style={styles.storeOptionLabel}>{store.label}</Text>
                  <Text style={styles.storeOptionSubtitle}>{store.region}</Text>
                </View>
                {currentStoreId === store.id ? (
                  <Ionicons name="checkmark-circle" size={18} color={palette.accent} />
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ListItemEditorModal({
  visible,
  itemName,
  qty,
  note,
  onClose,
  onChangeQty,
  onChangeNote,
  onSave,
  onDelete
}: {
  visible: boolean;
  itemName: string;
  qty: number;
  note: string;
  onClose: () => void;
  onChangeQty: (delta: number) => void;
  onChangeNote: (value: string) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.editorModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.editorAvoid}
        >
          <View style={styles.editorCard}>
            <View style={styles.editorHeader}>
              <Text style={styles.editorTitle}>{itemName}</Text>
              <Pressable onPress={onClose} style={styles.sheetClose}>
                <Ionicons name="close" size={18} color={palette.accentDark} />
              </Pressable>
            </View>
            <View style={styles.editorQtyRow}>
              <Text style={styles.editorQtyLabel}>Quantity</Text>
              <View style={styles.stepper}>
                <Pressable
                  style={[styles.stepperButton, qty === 1 && styles.stepperButtonDisabled]}
                  disabled={qty === 1}
                  onPress={() => onChangeQty(-1)}
                >
                  <Ionicons name="remove" size={16} color={qty === 1 ? '#94A3B8' : '#0C1D37'} />
                </Pressable>
                <Text style={styles.stepperValue}>{qty}</Text>
                <Pressable style={styles.stepperButton} onPress={() => onChangeQty(1)}>
                  <Ionicons name="add" size={16} color="#0C1D37" />
                </Pressable>
              </View>
            </View>
            <View style={styles.editorNotesBlock}>
              <Text style={styles.editorNotesLabel}>Notes</Text>
              <TextInput
                style={styles.editorNotes}
                placeholder="Add an optional note"
                multiline
                value={note}
                onChangeText={onChangeNote}
              />
            </View>
            <View style={styles.editorActions}>
              <Pressable style={styles.secondaryButton} onPress={onClose}>
                <Text style={styles.secondaryButtonLabel}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={onSave}>
                <Text style={styles.primaryButtonLabel}>Save</Text>
              </Pressable>
            </View>
            <Pressable style={styles.dangerButton} onPress={onDelete}>
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
              <Text style={styles.dangerButtonLabel}>Delete item</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function ListItemRow({
  item,
  onToggle,
  onAdjust,
  onLongPress
}: {
  item: ListItemSummary;
  onToggle: (item: ListItemSummary) => void;
  onAdjust: (item: ListItemSummary, delta: number) => void;
  onLongPress: (item: ListItemSummary) => void;
}) {
  const latest = item.priceSummary?.latest ?? null;
  const lowest = item.priceSummary?.lowest ?? null;
  const savings = item.priceSummary?.difference ?? null;
  const metaParts = [`Qty ${item.desiredQty}`];

  if (latest) {
    metaParts.push(formatPrice(latest.unitPrice, latest.currency));
  }
  if (lowest && savings && savings > 0) {
    metaParts.push(`Best ${formatPrice(lowest.unitPrice, lowest.currency)}`);
  }

  return (
    <View style={styles.itemRow}>
      <View style={styles.itemInfo}>
        <Pressable
          style={[styles.checkbox, item.isChecked && styles.checkboxChecked]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.isChecked }}
          onPress={() => onToggle(item)}
          hitSlop={8}
        >
          {item.isChecked ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.itemTextBlock, pressed && styles.itemTextBlockPressed]}
          onPress={() => onToggle(item)}
          onLongPress={() => onLongPress(item)}
          accessibilityRole="button"
          accessibilityLabel={formatItemTitle(item)}
          accessibilityHint={item.isChecked ? 'Mark item as not completed' : 'Mark item as completed'}
        >
          <Text style={[styles.itemLabel, item.isChecked && styles.itemLabelChecked]}>
            {formatItemTitle(item)}
          </Text>
          <Text style={[styles.itemMeta, item.isChecked && styles.itemMetaChecked]}>
            {metaParts.join(' \u2022 ')}
          </Text>
          {item.tags.length ? (
            <Text style={[styles.itemTags, item.isChecked && styles.itemTagsChecked]}>{item.tags.join(', ')}</Text>
          ) : null}
        </Pressable>
      </View>
      <View style={styles.stepper}>
        <Pressable
          style={[styles.stepperButton, item.desiredQty === 1 && styles.stepperButtonDisabled]}
          disabled={item.desiredQty === 1}
          onPress={() => onAdjust(item, -1)}
          accessibilityLabel="Decrease quantity"
          hitSlop={8}
        >
          <Ionicons name="remove" size={16} color={item.desiredQty === 1 ? '#94A3B8' : '#0C1D37'} />
        </Pressable>
        <Text style={styles.stepperValue}>{item.desiredQty}</Text>
        <Pressable
          style={styles.stepperButton}
          onPress={() => onAdjust(item, 1)}
          accessibilityLabel="Increase quantity"
          hitSlop={8}
        >
          <Ionicons name="add" size={16} color="#0C1D37" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 16
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background
  },
  error: {
    color: '#E53E3E',
    fontSize: 14,
    marginBottom: 12
  },
  linkButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border
  },
  linkButtonLabel: {
    color: palette.accentDark,
    fontWeight: '600'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border
  },
  headerText: {
    flex: 1
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.accentDark
  },
  subtitle: {
    fontSize: 14,
    color: palette.subtitle,
    marginTop: 4
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    flexWrap: 'wrap'
  },
  storePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E6FFFA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16
  },
  storePillLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.accentDark
  },
  storePillLabelMuted: {
    color: '#64748B'
  },
  doneToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border
  },
  doneToggleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.accentDark
  },
  addRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start'
  },
  input: {
    flex: 1,
    backgroundColor: palette.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: palette.accentDark,
    minHeight: 48,
    textAlignVertical: 'top'
  },
  addButton: {
    backgroundColor: palette.accent,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16
  },
  addButtonDisabled: {
    backgroundColor: '#A7F3D0'
  },
  addButtonLabel: {
    fontWeight: '700',
    color: palette.accentDark
  },
  emptyState: {
    marginTop: 48,
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.accentDark
  },
  emptyBody: {
    fontSize: 13,
    color: palette.subtitle,
    textAlign: 'center'
  },
  listContent: {
    gap: 12,
    paddingBottom: 120
  },
  sectionHeader: {
    marginTop: 16,
    marginBottom: 4
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.subtitle,
    letterSpacing: 1.2
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.card,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 16
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 12
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxChecked: {
    backgroundColor: palette.accent,
    borderColor: palette.accent
  },
  itemTextBlock: {
    flex: 1,
    gap: 4
  },
  itemTextBlockPressed: {
    opacity: 0.65
  },
  itemLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.accentDark
  },
  itemLabelChecked: {
    color: '#94A3B8',
    textDecorationLine: 'line-through'
  },
  itemMeta: {
    fontSize: 12,
    color: palette.subtitle,
    marginTop: 2
  },
  itemMetaChecked: {
    color: '#94A3B8',
    textDecorationLine: 'line-through'
  },
  itemTags: {
    fontSize: 11,
    color: '#64748B'
  },
  itemTagsChecked: {
    color: '#94A3B8',
    textDecorationLine: 'line-through'
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.card
  },
  stepperValue: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: palette.accentDark
  },
  stepperButtonDisabled: {
    opacity: 0.4
  },
  storeSheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(12,29,55,0.45)'
  },
  storeSheetDismiss: {
    flex: 1
  },
  storeSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    gap: 20,
    maxHeight: '75%'
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.accentDark
  },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9'
  },
  storeList: {
    gap: 8
  },
  storeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC'
  },
  storeOptionActive: {
    borderColor: palette.accent,
    backgroundColor: '#ECFDF5'
  },
  storeOptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.accentDark
  },
  storeOptionSubtitle: {
    fontSize: 12,
    color: '#64748B'
  },
  editorModal: {
    flex: 1,
    backgroundColor: 'rgba(12,29,55,0.35)',
    justifyContent: 'flex-end'
  },
  editorAvoid: {
    width: '100%'
  },
  editorCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    gap: 16
  },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  editorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.accentDark,
    flex: 1
  },
  editorQtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  editorQtyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.subtitle
  },
  editorNotesBlock: {
    gap: 6
  },
  editorNotesLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.subtitle
  },
  editorNotes: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 80,
    textAlignVertical: 'top',
    color: palette.accentDark
  },
  editorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 10
  },
  dangerButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444'
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16
  },
  primaryButtonLabel: {
    fontWeight: '700',
    color: palette.accentDark
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF'
  },
  secondaryButtonLabel: {
    fontWeight: '600',
    color: palette.accentDark
  },
  priceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.subtitle
  },
  priceValue: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.accentDark
  },
  priceStore: {
    fontSize: 11,
    color: palette.subtitle
  },
  priceDelta: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0F766E'
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  priceRowSecondary: {
    opacity: 0.85
  },
  priceSection: {
    gap: 4,
    marginTop: 6
  },
  priceTime: {
    fontSize: 11,
    color: '#64748B'
  }
});
