import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { featureFlags } from '@/src/lib/env';
import {
  fetchNotifications,
  markNotificationsRead,
  type NotificationInboxItem
} from '@/src/features/notifications/api';

const palette = {
  background: '#F5F7FA',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0C1D37',
  subtext: '#4A576D',
  muted: '#6C7A91',
  accent: '#16A34A'
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString();
};

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationInboxItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canLoadMore = Boolean(nextCursor);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchNotifications({ limit: 20 });
      setItems(result.items);
      setNextCursor(result.nextCursor);
      setUnreadCount(result.unreadCount ?? 0);
    } catch (err) {
      setError('Unable to load promo alerts. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) {
      return;
    }
    setLoadingMore(true);
    try {
      const result = await fetchNotifications({ limit: 20, cursor: nextCursor });
      setItems((prev) => [...prev, ...result.items]);
      setNextCursor(result.nextCursor);
      setUnreadCount(result.unreadCount ?? unreadCount);
    } catch (err) {
      setError('Unable to load more alerts.');
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, unreadCount]);

  const handleMarkAll = useCallback(async () => {
    try {
      await markNotificationsRead({ markAll: true });
      setItems((prev) => prev.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
      setUnreadCount(0);
    } catch (err) {
      setError('Unable to mark all as read.');
    }
  }, []);

  const handleMarkRead = useCallback(async (item: NotificationInboxItem) => {
    try {
      await markNotificationsRead({ ids: [item.id] });
      setItems((prev) =>
        prev.map((entry) =>
          entry.id === item.id ? { ...entry, read_at: entry.read_at ?? new Date().toISOString() } : entry
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setError('Unable to update this alert.');
    }
  }, []);

  const handleDismiss = useCallback(async (item: NotificationInboxItem) => {
    try {
      await markNotificationsRead({ ids: [item.id], dismiss: true });
      setItems((prev) => prev.filter((entry) => entry.id !== item.id));
    } catch (err) {
      setError('Unable to dismiss this alert.');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const headerMeta = useMemo(() => {
    if (unreadCount <= 0) {
      return 'All caught up';
    }
    return `${unreadCount} unread`;
  }, [unreadCount]);

  if (!featureFlags.promoNotifications) {
    return (
      <View style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons name="chevron-back" size={22} color={palette.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Promo alerts</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Promo alerts are offline</Text>
          <Text style={styles.emptySubtitle}>Enable feature_promo_notifications to preview this inbox.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={22} color={palette.text} />
        </Pressable>
        <View style={styles.headerMeta}>
          <Text style={styles.headerTitle}>Promo alerts</Text>
          <Text style={styles.headerSubtitle}>{headerMeta}</Text>
        </View>
        <Pressable onPress={handleMarkAll} style={styles.headerAction}>
          <Text style={styles.headerActionText}>Mark all</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={palette.text} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No promo alerts yet</Text>
          <Text style={styles.emptySubtitle}>We will surface curated deals as they go live.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {items.map((item) => {
            const isUnread = !item.read_at;
            return (
              <View key={item.id} style={[styles.card, isUnread && styles.cardUnread]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
                </View>
                <Text style={styles.cardBody}>{item.body}</Text>
                <View style={styles.cardActions}>
                  <Pressable onPress={() => handleMarkRead(item)} style={styles.cardAction}>
                    <Text style={styles.cardActionText}>{isUnread ? 'Mark read' : 'Read'}</Text>
                  </Pressable>
                  <Pressable onPress={() => handleDismiss(item)} style={styles.cardAction}>
                    <Text style={styles.cardActionText}>Dismiss</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
          {canLoadMore ? (
            <Pressable onPress={loadMore} style={styles.loadMore} disabled={loadingMore}>
              {loadingMore ? (
                <ActivityIndicator color={palette.text} />
              ) : (
                <Text style={styles.loadMoreText}>Load more</Text>
              )}
            </Pressable>
          ) : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  headerButton: {
    paddingRight: 12
  },
  headerMeta: {
    flex: 1
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text
  },
  headerSubtitle: {
    fontSize: 12,
    color: palette.muted
  },
  headerAction: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border
  },
  headerActionText: {
    fontSize: 12,
    color: palette.text,
    fontWeight: '600'
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 8
  },
  emptySubtitle: {
    fontSize: 13,
    color: palette.subtext,
    textAlign: 'center'
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    marginBottom: 12
  },
  cardUnread: {
    borderColor: palette.accent
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.text,
    flex: 1,
    marginRight: 12
  },
  cardDate: {
    fontSize: 12,
    color: palette.muted
  },
  cardBody: {
    fontSize: 13,
    color: palette.subtext,
    marginBottom: 12
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12
  },
  cardAction: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border
  },
  cardActionText: {
    fontSize: 12,
    color: palette.text,
    fontWeight: '600'
  },
  loadMore: {
    alignItems: 'center',
    paddingVertical: 12
  },
  loadMoreText: {
    fontSize: 13,
    color: palette.text,
    fontWeight: '600'
  },
  errorText: {
    marginTop: 8,
    color: '#DC2626',
    fontSize: 12,
    textAlign: 'center'
  }
});
