import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/auth-context';
import { trackEvent } from '@/src/lib/analytics';
import { useLists, type ListSummary } from './use-lists';
import { archiveList, createList, renameList } from './mutations';

const palette = {
  background: '#F5F7FA',
  card: '#FFFFFF',
  accent: '#4FD1C5',
  accentDark: '#0C1D37',
  subtitle: '#4A576D',
  border: '#E2E8F0'
};

type PromptState =
  | { mode: 'create' }
  | { mode: 'rename'; listId: string; currentName: string };

export function ListsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { lists, loading, error } = useLists({ ownerId: user?.id });
  const [prompt, setPrompt] = useState<PromptState | null>(null);
  const [nameDraft, setNameDraft] = useState('');

  const dismissPrompt = useCallback(() => {
    setPrompt(null);
    setNameDraft('');
  }, []);

  const startCreatePrompt = useCallback(() => {
    setPrompt({ mode: 'create' });
    setNameDraft('');
  }, []);

  const startRenamePrompt = useCallback((list: ListSummary) => {
    setPrompt({ mode: 'rename', listId: list.id, currentName: list.name });
    setNameDraft(list.name);
  }, []);

  const handleCreate = useCallback(async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Enter a name for your new list.');
      return;
    }
    try {
      const record = await createList({ name: trimmed, ownerId: user?.id ?? null });
      trackEvent('list_created', { length: trimmed.length });
      dismissPrompt();
      router.push(`/lists/${record.id}` as never);
    } catch (err) {
      console.error('Failed to create list', err);
      Alert.alert('Could not create list', err instanceof Error ? err.message : 'Try again.');
    }
  }, [nameDraft, user?.id, dismissPrompt, router]);

  const handleRename = useCallback(async () => {
    if (!prompt || prompt.mode !== 'rename') {
      return;
    }
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Enter a new name for the list.');
      return;
    }
    try {
      await renameList(prompt.listId, trimmed);
      trackEvent('list_renamed', { length: trimmed.length });
      dismissPrompt();
    } catch (err) {
      console.error('Failed to rename list', err);
      Alert.alert('Could not rename list', err instanceof Error ? err.message : 'Try again.');
    }
  }, [prompt, nameDraft, dismissPrompt]);

  const confirmArchive = useCallback((list: ListSummary) => {
    Alert.alert(
      'Archive list',
      'Archived lists can be restored later. Remove this list from your active view?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              await archiveList(list.id);
              trackEvent('list_archived');
            } catch (err) {
              console.error('Failed to archive list', err);
              Alert.alert('Could not archive list', err instanceof Error ? err.message : 'Try again.');
            }
          }
        }
      ]
    );
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: ListSummary }) => (
      <ListCard
        summary={item}
        onOpen={() => router.push(`/lists/${item.id}` as never)}
        onRename={() => startRenamePrompt(item)}
        onArchive={() => confirmArchive(item)}
      />
    ),
    [router, startRenamePrompt, confirmArchive]
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="small" color={palette.accentDark} />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }

    if (lists.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="cart-outline" size={36} color={palette.accent} />
          <Text style={styles.emptyTitle}>Build your first list</Text>
          <Text style={styles.emptyBody}>Capture staples, track store prices, and sync with family members.</Text>
          <Pressable style={styles.primaryButton} onPress={startCreatePrompt}>
            <Ionicons name="add" size={18} color={palette.accentDark} />
            <Text style={styles.primaryButtonLabel}>Create a list</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <FlatList
        data={lists}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
      />
    );
  };

  const renderPrompt = () => {
    if (!prompt) {
      return null;
    }

    const title = prompt.mode === 'create' ? 'New list' : 'Rename list';
    const submitLabel = prompt.mode === 'create' ? 'Create' : 'Save';

    const onSubmit = prompt.mode === 'create' ? handleCreate : handleRename;

    return (
      <View style={styles.promptOverlay}>
        <View style={styles.promptCard}>
          <Text style={styles.promptTitle}>{title}</Text>
          <TextInput
            value={nameDraft}
            onChangeText={setNameDraft}
            placeholder="Weekly groceries"
            placeholderTextColor={palette.subtitle}
            style={styles.promptInput}
            autoFocus
          />
          <View style={styles.promptActions}>
            <Pressable style={styles.secondaryButton} onPress={dismissPrompt}>
              <Text style={styles.secondaryButtonLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryButton, nameDraft.trim() ? null : styles.primaryButtonDisabled]}
              onPress={onSubmit}
              disabled={!nameDraft.trim()}
            >
              <Text style={styles.primaryButtonLabel}>{submitLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Your lists</Text>
          <Text style={styles.subtitle}>Create shopping plans and share them across devices.</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.secondaryButton} onPress={() => router.push('/library' as never)}>
            <Ionicons name="book-outline" size={16} color={palette.accentDark} />
            <Text style={styles.secondaryButtonLabel}>Library</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={startCreatePrompt}>
            <Ionicons name="add" size={18} color={palette.accentDark} />
            <Text style={styles.primaryButtonLabel}>New list</Text>
          </Pressable>
        </View>
      </View>

      {renderContent()}
      {renderPrompt()}
    </View>
  );
}

function ListCard({
  summary,
  onOpen,
  onRename,
  onArchive
}: {
  summary: ListSummary;
  onOpen: () => void;
  onRename: () => void;
  onArchive: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{summary.name}</Text>
        {summary.isShared ? (
          <View style={styles.sharedBadge}>
            <Ionicons name="people-outline" size={12} color={palette.accentDark} />
            <Text style={styles.sharedBadgeLabel}>Shared</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.cardMeta}>
        {summary.itemCount} items � Updated {formatRelative(summary.updatedAt)}
      </Text>
      <View style={styles.cardActions}>
        <Pressable style={styles.cardButton} onPress={onOpen}>
          <Text style={styles.cardButtonLabel}>Open</Text>
        </Pressable>
        <Pressable style={styles.cardButton} onPress={onRename}>
          <Text style={styles.cardButtonLabel}>Rename</Text>
        </Pressable>
        <Pressable style={styles.cardButtonDestructive} onPress={onArchive}>
          <Text style={styles.cardButtonLabel}>Archive</Text>
        </Pressable>
      </View>
    </View>
  );
}

function formatRelative(timestamp: number) {
  const diff = Date.now() - timestamp;
  const day = 1000 * 60 * 60 * 24;
  if (diff < day) {
    const hours = Math.round(diff / (1000 * 60 * 60));
    return hours <= 1 ? 'just now' : `${hours} h ago`;
  }
  const days = Math.round(diff / day);
  return days <= 1 ? 'yesterday' : `${days} days ago`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    gap: 16
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.accentDark
  },
  subtitle: {
    fontSize: 14,
    color: palette.subtitle,
    marginTop: 4,
    maxWidth: 260
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  errorText: {
    color: '#E53E3E'
  },
  emptyState: {
    marginTop: 48,
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.accentDark
  },
  emptyBody: {
    fontSize: 14,
    color: palette.subtitle,
    textAlign: 'center'
  },
  listContent: {
    gap: 12,
    paddingBottom: 80
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 18,
    gap: 12,
    shadowColor: '#101828',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: palette.accentDark
  },
  cardMeta: {
    fontSize: 13,
    color: palette.subtitle
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12
  },
  cardButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center'
  },
  cardButtonDestructive: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#FFE7E7'
  },
  cardButtonLabel: {
    fontWeight: '600',
    color: palette.accentDark
  },
  sharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E6FFFA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  sharedBadgeLabel: {
    color: palette.accentDark,
    fontSize: 11,
    fontWeight: '600'
  },
  promptOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(12, 29, 55, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  promptCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: palette.card,
    borderRadius: 24,
    padding: 24,
    gap: 16
  },
  promptTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.accentDark
  },
  promptInput: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: palette.accentDark
  },
  promptActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16
  },
  primaryButtonDisabled: {
    opacity: 0.6
  },
  primaryButtonLabel: {
    fontWeight: '700',
    color: palette.accentDark
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16
  },
  secondaryButtonLabel: {
    fontWeight: '600',
    color: palette.accentDark
  }
});


