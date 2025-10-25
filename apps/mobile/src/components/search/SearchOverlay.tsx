import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchService } from '@/src/shared/search/searchService';
import { useSearchStore } from '@/src/shared/search/store';
import type { SearchEntity } from '@/src/shared/search/types';
import { AddFab } from './AddFab';
import { PopSearchBar } from './PopSearchBar';
import { Toast } from './Toast';

const kindIcon = {
  product: 'sparkles-outline',
  list: 'list-outline',
  feature: 'flash-outline'
} as const;

type SearchOverlayProps = {
  topOffset?: number;
};

export function SearchOverlay({ topOffset = 0 }: SearchOverlayProps) {
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const open = useSearchStore((state) => state.open);
  const query = useSearchStore((state) => state.query);
  const results = useSearchStore((state) => state.results);
  const loading = useSearchStore((state) => state.loading);
  const setOpen = useSearchStore((state) => state.setOpen);
  const setQuery = useSearchStore((state) => state.setQuery);
  const setResults = useSearchStore((state) => state.setResults);

  const trimmed = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const timer = setTimeout(() => {
      const next = searchService.search(query);
      setResults(next);
    }, 140);

    return () => clearTimeout(timer);
  }, [open, query, setResults]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setOpen(false);
      return true;
    });
    return () => subscription.remove();
  }, [open, setOpen]);

  if (!open) {
    return null;
  }

  const showAddFab = !loading && trimmed.length >= 2 && results.length === 0;

  const handleSelect = (entity: SearchEntity) => {
    if (entity.route) {
      router.push(entity.route as never);
    }
    setOpen(false);
    setQuery('');
    setResults([]);
  };

  const handleSubmit = (text: string) => {
    const value = text.trim();
    if (!value) {
      return;
    }
    const next = searchService.search(value);
    if (next.length && next[0].route) {
      handleSelect(next[0]);
    } else {
      setResults(next);
    }
  };

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="small" color="#0f766e" />
          <Text style={styles.emptyLabel}>Collecting items and lists...</Text>
        </View>
      );
    }

    if (!trimmed.length) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="arrow-forward-circle-outline" size={20} color="#0f766e" />
          <Text style={styles.emptyLabel}>Start typing to search everything</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Ionicons name="search-outline" size={20} color="#0f766e" />
        <Text style={styles.emptyLabel}>No matches yet</Text>
        <Text style={styles.emptySubLabel}>Tap "Add" to create it instantly.</Text>
      </View>
    );
  };

  return (
    <View style={styles.absolute} pointerEvents="box-none">
      <Pressable style={styles.scrim} onPress={() => setOpen(false)} />
      <KeyboardAvoidingView
        style={[
          styles.keyboardWrap,
          {
            top: topOffset
          }
        ]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.sheet, { paddingTop: 12, paddingBottom: Math.max(bottom, 16) }]}>
          <PopSearchBar
            value={query}
            onChangeText={setQuery}
            onSubmit={handleSubmit}
            onCancel={() => {
              setOpen(false);
              setQuery('');
              setResults([]);
            }}
          />

          <FlatList
            data={results}
            keyExtractor={(item) => `${item.kind}:${item.id}`}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: Math.max(bottom, 16) + 96 }
            ]}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSelect(item)}
                style={({ pressed }) => [styles.resultRow, pressed && styles.resultRowPressed]}
              >
                <View style={styles.resultIcon}>
                  <Ionicons name={kindIcon[item.kind]} size={18} color="#0f766e" />
                </View>
                <View style={styles.resultText}>
                  <Text style={styles.resultTitle}>{item.title}</Text>
                  {item.subtitle ? <Text style={styles.resultSubtitle}>{item.subtitle}</Text> : null}
                </View>
                {item.score !== undefined ? (
                  <Text style={styles.scoreText}>{Math.round((1 - item.score) * 100)}%</Text>
                ) : null}
              </Pressable>
            )}
          />
        </View>
      </KeyboardAvoidingView>

      {showAddFab ? <AddFab query={trimmed} /> : null}
      <Toast.Host />
    </View>
  );
}

const styles = StyleSheet.create({
  absolute: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 80
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12, 29, 55, 0.38)'
  },
  keyboardWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 90,
    justifyContent: 'flex-start',
    ...Platform.select({ android: { elevation: 9 } })
  },
  sheet: {
    flex: 1
  },
  listContent: {
    paddingHorizontal: 8,
    paddingTop: 12
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    marginBottom: 8,
    shadowColor: '#0c1d37',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1
  },
  resultRowPressed: {
    backgroundColor: '#ecfeff'
  },
  resultIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ccfbf1',
    alignItems: 'center',
    justifyContent: 'center'
  },
  resultText: {
    flex: 1
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a'
  },
  resultSubtitle: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2
  },
  scoreText: {
    fontSize: 11,
    color: '#0f766e',
    fontWeight: '600'
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 48
  },
  emptyLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a'
  },
  emptySubLabel: {
    fontSize: 12,
    color: '#475569'
  }
});
