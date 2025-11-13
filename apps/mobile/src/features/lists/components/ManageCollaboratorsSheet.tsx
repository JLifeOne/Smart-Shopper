import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/auth-context';
import {
  fetchCollaborators,
  fetchInvites,
  generateInvite,
  revokeInvite,
  type Collaborator,
  type ListInvite
} from '../collaboration-api';

const palette = {
  background: '#EFF3F8',
  card: '#FFFFFF',
  accent: '#0C1D37',
  accentSoft: '#4FD1C5',
  border: '#E2E8F0',
  muted: '#6C7A91',
  destructive: '#E53E3E'
};

const INVITE_BASE_URL = 'https://smartshop.app/l';

type Props = {
  visible: boolean;
  listId: string | null;
  listName: string;
  onClose: () => void;
  onUpdated?: (payload: { collaborators: Collaborator[]; invites: ListInvite[] }) => void;
};

export function ManageCollaboratorsSheet({ visible, listId, listName, onClose, onUpdated }: Props) {
  const { user } = useAuth();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [invites, setInvites] = useState<ListInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!listId) {
      return;
    }
    setLoading(true);
    try {
      const [members, inviteRows] = await Promise.all([fetchCollaborators(listId), fetchInvites(listId)]);
      setCollaborators(members);
      setInvites(inviteRows);
      setError(null);
      onUpdated?.({ collaborators: members, invites: inviteRows });
    } catch (err) {
      console.error('ManageCollaboratorsSheet: load failed', err);
      const message =
        err instanceof Error
          ? err.message.includes('schema cache')
            ? 'Run the latest Supabase migrations to enable sharing tables.'
            : err.message
          : 'Unable to load collaborators.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [listId, onUpdated]);

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible, loadData]);

  const handleInvite = useCallback(async () => {
    if (!listId) {
      return;
    }
    setActionLoading(true);
    try {
      const invite = await generateInvite({
        listId,
        role: 'editor',
        expiresInHours: 24 * 7,
        singleUse: false
      });
      setInvites((prev) => {
        const next = [invite, ...(prev ?? [])];
        onUpdated?.({ collaborators, invites: next });
        return next;
      });
      const url = `${INVITE_BASE_URL}/${invite.token}`;
      await Share.share({
        message: `Join my Smart Shopper list "${listName}": ${url}`
      });
    } catch (err) {
      console.error('ManageCollaboratorsSheet: invite failed', err);
      Alert.alert('Invite failed', err instanceof Error ? err.message : 'Unable to generate invite. Try again.');
    } finally {
      setActionLoading(false);
    }
  }, [listId, listName]);

  const handleRevoke = useCallback(async (inviteId: string) => {
    setActionLoading(true);
    try {
      const updated = await revokeInvite(inviteId);
      setInvites((prev) => {
        const next = prev.map((item) => (item.id === inviteId ? updated : item));
        onUpdated?.({ collaborators, invites: next });
        return next;
      });
    } catch (err) {
      console.error('ManageCollaboratorsSheet: revoke failed', err);
      Alert.alert('Unable to revoke', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setActionLoading(false);
    }
  }, []);

  const collaboratorList = useMemo(() => {
    return collaborators.map((member) => {
      const isYou = member.user_id === user?.id;
      return {
        id: member.user_id,
        role: member.role,
        joinedAt: member.joined_at,
        invitedBy: member.invited_by,
        label: isYou ? 'You' : formatUserId(member.user_id)
      };
    });
  }, [collaborators, user?.id]);

  return (
    <Modal
      animationType="slide"
      presentationStyle="pageSheet"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetTitle}>Share “{listName}”</Text>
            <Text style={styles.sheetSubtitle}>Invite people to edit or check off items.</Text>
          </View>
          <Pressable style={styles.iconButton} onPress={onClose}>
            <Ionicons name="close" size={20} color={palette.accent} />
          </Pressable>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={palette.accent} />
            <Text style={styles.loadingLabel}>Loading access…</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Collaborators</Text>
                <Text style={styles.sectionMeta}>{collaborators.length} total</Text>
              </View>
              {collaboratorList.length ? (
                collaboratorList.map((member) => (
                  <View key={member.id} style={styles.row}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarLabel}>{member.label.slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <View style={styles.rowDetails}>
                      <Text style={styles.rowTitle}>{member.label}</Text>
                      <Text style={styles.rowSubtitle}>{formatRole(member.role)}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyCopy}>You are the only collaborator for this list.</Text>
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Pending invites</Text>
                <Text style={styles.sectionMeta}>
                  {invites.filter((invite) => invite.status === 'pending').length} active
                </Text>
              </View>
              {invites.length ? (
                invites.map((invite) => (
                  <View key={invite.id} style={styles.inviteRow}>
                    <View style={styles.inviteDetails}>
                      <Text style={styles.rowTitle}>{formatRole(invite.role)}</Text>
                      <Text style={styles.rowSubtitle}>{invite.status.toUpperCase()}</Text>
                    </View>
                    {invite.status === 'pending' ? (
                      <Pressable
                        style={styles.revokeButton}
                        disabled={actionLoading}
                        onPress={() =>
                          Alert.alert('Revoke invite', 'This invite will no longer work. Continue?', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Revoke', style: 'destructive', onPress: () => handleRevoke(invite.id) }
                          ])
                        }
                      >
                        <Text style={styles.revokeLabel}>Revoke</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))
              ) : (
                <Text style={styles.emptyCopy}>No invites yet.</Text>
              )}
            </View>
          </ScrollView>
        )}

        <View style={styles.sheetFooter}>
          <Pressable
            style={[styles.primaryButton, actionLoading ? styles.primaryButtonDisabled : null]}
            disabled={actionLoading}
            onPress={handleInvite}
          >
            <Ionicons name="share-social" size={16} color={palette.accent} />
            <Text style={styles.primaryButtonLabel}>
              {actionLoading ? 'Generating…' : 'Generate invite link'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function formatUserId(userId: string) {
  if (!userId) {
    return 'Member';
  }
  return `${userId.slice(0, 4)}…${userId.slice(-4)}`;
}

function formatRole(role: Collaborator['role']) {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'editor':
      return 'Editor';
    case 'checker':
      return 'Checker';
    case 'observer':
      return 'Observer';
    default:
      return role;
  }
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: palette.background,
    padding: 24,
    gap: 16
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.accent
  },
  sheetSubtitle: {
    fontSize: 14,
    color: palette.muted,
    marginTop: 4
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  errorText: {
    color: palette.destructive,
    fontSize: 14
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8
  },
  loadingLabel: {
    color: palette.muted
  },
  scrollContent: {
    gap: 16,
    paddingBottom: 32
  },
  section: {
    backgroundColor: palette.card,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.accent
  },
  sectionMeta: {
    fontSize: 12,
    color: palette.muted
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.accentSoft,
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarLabel: {
    color: palette.accent,
    fontWeight: '600'
  },
  rowDetails: {
    flex: 1
  },
  rowTitle: {
    fontSize: 15,
    color: palette.accent,
    fontWeight: '500'
  },
  rowSubtitle: {
    fontSize: 12,
    color: palette.muted
  },
  emptyCopy: {
    fontSize: 13,
    color: palette.muted
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 12
  },
  inviteDetails: {
    flex: 1
  },
  revokeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.destructive
  },
  revokeLabel: {
    color: palette.destructive,
    fontSize: 12,
    fontWeight: '600'
  },
  sheetFooter: {
    paddingTop: 8
  },
  primaryButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.accentSoft,
    borderRadius: 999,
    paddingVertical: 14
  },
  primaryButtonDisabled: {
    opacity: 0.6
  },
  primaryButtonLabel: {
    color: palette.accent,
    fontSize: 15,
    fontWeight: '600'
  }
});
