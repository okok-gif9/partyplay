import { useCallback, useEffect, useState } from 'react'
import { PartyPlayError } from '../lib/partyplay'
import { supabase } from '../lib/supabase'

export type Presence = 'online' | 'away' | 'busy' | 'offline'

export type CurrentProfile = {
  id: string
  username: string
  displayName: string
  avatarSeed: string
  presence: Presence
  themePreference: 'system' | 'light' | 'dark'
  allowFriendRequests: boolean
}

export type SocialProfile = Pick<CurrentProfile, 'id' | 'username' | 'displayName' | 'avatarSeed' | 'presence'>

export type CurrentGroupMember = SocialProfile & { role: 'owner' | 'admin' | 'member' }
export type CurrentGroup = {
  id: string
  name: string
  description: string
  avatarSeed: string
  memberCount: number
  members: CurrentGroupMember[]
  myRole: 'owner' | 'admin' | 'member'
}

export type FriendRequest = { id: string; requester: SocialProfile; createdAt: string }

const normalizeProfile = (value: unknown): CurrentProfile => {
  const profile = value as {
    id: string; username: string; display_name: string; avatar_seed: string; presence: Presence
    theme_preference: CurrentProfile['themePreference']; allow_friend_requests?: boolean
  }
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name,
    avatarSeed: profile.avatar_seed || 'mint',
    presence: profile.presence || 'online',
    themePreference: profile.theme_preference || 'system',
    allowFriendRequests: profile.allow_friend_requests !== false,
  }
}

const normalizeSocialProfile = (value: unknown): SocialProfile => {
  const profile = value as { id: string; username: string; display_name: string; avatar_seed: string; presence: Presence }
  return { id: profile.id, username: profile.username, displayName: profile.display_name, avatarSeed: profile.avatar_seed || 'mint', presence: profile.presence || 'offline' }
}

const rpc = async <T,>(name: string, args: Record<string, unknown>) => {
  if (!supabase) throw new PartyPlayError('SUPABASE_NOT_CONFIGURED')
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw new PartyPlayError(error.message)
  return data as T
}

export function usePartyPlayData() {
  const [profile, setProfile] = useState<CurrentProfile | null>(null)
  const [groups, setGroups] = useState<CurrentGroup[]>([])
  const [friends, setFriends] = useState<SocialProfile[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [loading, setLoading] = useState(Boolean(supabase))

  const refresh = useCallback(async (displayName?: string) => {
    if (!supabase) { setLoading(false); return null }
    setLoading(true)
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) { setProfile(null); setGroups([]); setFriends([]); setRequests([]); return null }

      const rawProfile = await rpc<unknown>('partyplay_ensure_profile', { p_display_name: displayName || null })
      const nextProfile = normalizeProfile(rawProfile)
      setProfile(nextProfile)

      const [{ data: rawGroups, error: groupsError }, { data: rawMemberships, error: membershipsError }, { data: rawFriendships, error: friendshipsError }, { data: rawRequests, error: requestsError }] = await Promise.all([
        supabase.from('pp_groups').select('id, name, description, avatar_seed').order('created_at', { ascending: false }),
        supabase.from('pp_group_members').select('group_id, user_id, role'),
        supabase.from('pp_friendships').select('user_a, user_b'),
        supabase.from('pp_friend_requests').select('id, requester_id, created_at').eq('addressee_id', authData.user.id).eq('status', 'pending').order('created_at', { ascending: false }),
      ])
      if (groupsError || membershipsError || friendshipsError || requestsError) throw new PartyPlayError(groupsError?.message || membershipsError?.message || friendshipsError?.message || requestsError?.message || 'SOCIAL_LOAD_FAILED')

      const memberships = (rawMemberships || []) as Array<{ group_id: string; user_id: string; role: CurrentGroupMember['role'] }>
      const socialIds = [...new Set([
        ...(rawFriendships || []).flatMap((row) => [row.user_a, row.user_b]).filter((id) => id !== authData.user.id),
        ...(rawRequests || []).map((row) => row.requester_id),
        ...memberships.map((row) => row.user_id),
      ])]
      const { data: profilesData, error: profilesError } = socialIds.length
        ? await supabase.from('pp_profiles').select('id, username, display_name, avatar_seed, presence').in('id', socialIds)
        : { data: [], error: null }
      if (profilesError) throw new PartyPlayError(profilesError.message)
      const people = new Map((profilesData || []).map((value) => { const person = normalizeSocialProfile(value); return [person.id, person] }))

      const friendIds = (rawFriendships || []).map((row) => row.user_a === authData.user.id ? row.user_b : row.user_a)
      setFriends(friendIds.map((id) => people.get(id)).filter((person): person is SocialProfile => Boolean(person)))
      setRequests((rawRequests || []).map((row) => ({ id: row.id, requester: people.get(row.requester_id), createdAt: row.created_at })).filter((request): request is FriendRequest => Boolean(request.requester)))

      setGroups(((rawGroups || []) as Array<{ id: string; name: string; description: string; avatar_seed: string }>).map((group) => {
        const groupMemberships = memberships.filter((membership) => membership.group_id === group.id)
        const members = groupMemberships.map((membership) => {
          const person = membership.user_id === authData.user.id
            ? { id: nextProfile.id, username: nextProfile.username, displayName: nextProfile.displayName, avatarSeed: nextProfile.avatarSeed, presence: nextProfile.presence }
            : people.get(membership.user_id)
          return person ? { ...person, role: membership.role } : null
        }).filter((member): member is CurrentGroupMember => Boolean(member))
        return {
          id: group.id, name: group.name, description: group.description, avatarSeed: group.avatar_seed || 'ring',
          memberCount: groupMemberships.length || 1, members,
          myRole: groupMemberships.find((membership) => membership.user_id === authData.user.id)?.role || 'member',
        }
      }))
      return nextProfile
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    void refresh().catch(() => setLoading(false))
    if (!supabase) return
    const { data: listener } = supabase.auth.onAuthStateChange(() => { void refresh().catch(() => setLoading(false)) })
    return () => listener.subscription.unsubscribe()
  }, [refresh])

  const updateProfile = useCallback(async (updates: { displayName?: string; avatarSeed?: string; presence?: Presence; allowFriendRequests?: boolean }) => {
    const data = await rpc<unknown>('partyplay_update_profile', {
      p_display_name: updates.displayName ?? null,
      p_avatar_seed: updates.avatarSeed ?? null,
      p_presence: updates.presence ?? null,
      p_allow_friend_requests: updates.allowFriendRequests ?? null,
    })
    const next = normalizeProfile(data)
    setProfile(next)
    await refresh()
    return next
  }, [refresh])

  const lookupProfile = useCallback(async (username: string) => normalizeSocialProfile(await rpc<unknown>('partyplay_lookup_profile', { p_username: username })), [])
  const sendFriendRequest = useCallback(async (username: string) => { await rpc('partyplay_send_friend_request', { p_username: username }); await refresh() }, [refresh])
  const respondToRequest = useCallback(async (requestId: string, accept: boolean) => { await rpc('partyplay_respond_friend_request', { p_request_id: requestId, p_accept: accept }); await refresh() }, [refresh])
  const removeFriend = useCallback(async (friendId: string) => { await rpc('partyplay_remove_friend', { p_friend_id: friendId }); await refresh() }, [refresh])

  const createGroup = useCallback(async (name: string) => {
    const data = await rpc<{ id: string; name: string }>('partyplay_create_group', { p_name: name })
    await rpc('partyplay_update_group_identity', { p_group_id: data.id, p_name: null, p_description: null, p_avatar_seed: 'ring' })
    await refresh()
    return data
  }, [refresh])
  const addGroupMember = useCallback(async (groupId: string, username: string) => { await rpc('partyplay_add_group_member', { p_group_id: groupId, p_username: username }); await refresh() }, [refresh])
  const updateGroupIdentity = useCallback(async (groupId: string, updates: { name?: string; description?: string; avatarSeed?: string }) => { await rpc('partyplay_update_group_identity', { p_group_id: groupId, p_name: updates.name ?? null, p_description: updates.description ?? null, p_avatar_seed: updates.avatarSeed ?? null }); await refresh() }, [refresh])

  return { profile, groups, friends, requests, loading, refresh, updateProfile, lookupProfile, sendFriendRequest, respondToRequest, removeFriend, createGroup, addGroupMember, updateGroupIdentity }
}
