import { ensureSupabaseClient, type Database } from '@/src/lib/supabase';

export type CollaboratorRole = Database['public']['Tables']['list_members']['Row']['role'];
export type InviteStatus = Database['public']['Tables']['list_invites']['Row']['status'];

export type Collaborator = Database['public']['Tables']['list_members']['Row'];
export type ListInvite = Database['public']['Tables']['list_invites']['Row'];

type DelegatableRole = Exclude<CollaboratorRole, 'owner'>;

function getInterval(hours?: number | null) {
  if (!hours || hours <= 0) {
    return null;
  }
  return `${hours} hours`;
}

function normalizeError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes('permission')) {
    return 'Not authorized to manage invites for this list.';
  }
  if (lower.includes('expired')) {
    return 'Invite has expired.';
  }
  if (lower.includes('not authenticated') || lower.includes('auth')) {
    return 'Please sign in to continue.';
  }
  return message;
}

export async function fetchCollaborators(listId: string) {
  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase
    .from('list_members')
    .select('*')
    .eq('list_id', listId)
    .order('role', { ascending: true })
    .order('joined_at', { ascending: true });
  if (error) {
    throw new Error(normalizeError(error.message));
  }
  return data as Collaborator[];
}

export async function fetchInvites(listId: string) {
  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase
    .from('list_invites')
    .select('*')
    .eq('list_id', listId)
    .order('created_at', { ascending: false });
  if (error) {
    throw new Error(normalizeError(error.message));
  }
  return (data ?? []) as ListInvite[];
}

export type GenerateInviteOptions = {
  listId: string;
  role: DelegatableRole;
  expiresInHours?: number | null;
  singleUse?: boolean;
};

export async function generateInvite({ listId, role, expiresInHours, singleUse }: GenerateInviteOptions) {
  const supabase = ensureSupabaseClient();
  const args = {
    _list_id: listId,
    _role: role,
    _expires_in: getInterval(expiresInHours),
    _single_use: singleUse ?? false
  } as Database['public']['Functions']['generate_list_invite']['Args'];
  const { data, error } = await supabase.rpc('generate_list_invite', args as never);
  if (error) {
    throw new Error(normalizeError(error.message));
  }
  return data as ListInvite;
}

export async function acceptInvite(token: string) {
  const supabase = ensureSupabaseClient();
  const args = { _token: token } as Database['public']['Functions']['accept_list_invite']['Args'];
  const { data, error } = await supabase.rpc('accept_list_invite', args as never);
  if (error) {
    throw new Error(normalizeError(error.message));
  }
  return data as Collaborator;
}

export async function revokeInvite(inviteId: string) {
  const supabase = ensureSupabaseClient();
  const args = { _invite_id: inviteId } as Database['public']['Functions']['revoke_list_invite']['Args'];
  const { data, error } = await supabase.rpc('revoke_list_invite', args as never);
  if (error) {
    throw new Error(normalizeError(error.message));
  }
  return data as ListInvite;
}
