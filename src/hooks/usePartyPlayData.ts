import { useCallback, useEffect, useState } from 'react'
import type { IdentityTier, SiteRole } from '../components/SocialIdentity'
import { heartbeatPresence, loadMyActiveRooms, PartyPlayError, type ActiveRoomSummary, type AvatarSource, type PremiumRingColor } from '../lib/partyplay'
import { supabase } from '../lib/supabase'

export type Presence = 'online' | 'in_game' | 'away' | 'busy' | 'offline'

export type CurrentProfile = {
  id: string
  username: string
  displayName: string
  bio: string
  avatarSeed: string
  avatarAssetPath: string | null
  avatarSource: AvatarSource
  premiumRingEnabled: boolean
  premiumRingColor: PremiumRingColor
  presence: Presence
  presenceUpdatedAt: string | null
  themePreference: 'system' | 'light' | 'dark'
  allowFriendRequests: boolean
  membershipTier: IdentityTier
  premiumUntil: string | null
  isVerified: boolean
  siteRole: SiteRole
  profileTagline: string
}

export type SocialProfile = Pick<CurrentProfile, 'id' | 'username' | 'displayName' | 'avatarSeed' | 'avatarAssetPath' | 'avatarSource' | 'premiumRingEnabled' | 'premiumRingColor' | 'presence' | 'presenceUpdatedAt' | 'membershipTier' | 'premiumUntil' | 'isVerified' | 'siteRole' | 'profileTagline'>

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
    id: string; username: string; display_name: string; bio?: string; avatar_seed: string; avatar_asset_path?: string | null; avatar_source?: AvatarSource; premium_ring_enabled?: boolean; premium_ring_color?: PremiumRingColor; presence: Presence
    presence_updated_at?: string | null; theme_preference: CurrentProfile['themePreference']; allow_friend_requests?: boolean; membership_tier?: IdentityTier; premium_until?: string | null; is_verified?: boolean; site_role?: SiteRole; profile_tagline?: string
  }
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name,
    bio: profile.bio || '',
    avatarSeed: profile.avatar_seed || 'mint',
    avatarAssetPath: profile.avatar_asset_path || null,
    avatarSource: profile.avatar_source === 'library' || profile.avatar_source === 'custom' ? profile.avatar_source : 'seed',
    premiumRingEnabled: profile.premium_ring_enabled === true,
    premiumRingColor: ['violet', 'cyan', 'pink', 'gold', 'aurora'].includes(profile.premium_ring_color || '') ? profile.premium_ring_color as PremiumRingColor : 'violet',
    presence: profile.presence || 'online',
    presenceUpdatedAt: profile.presence_updated_at || null,
    themePreference: profile.theme_preference || 'system',
    allowFriendRequests: profile.allow_friend_requests !== false,
    membershipTier: profile.membership_tier === 'premium' ? 'premium' : 'standard',
    premiumUntil: profile.premium_until || null,
    isVerified: profile.is_verified === true || (profile.membership_tier === 'premium' && (!profile.premium_until || new Date(profile.premium_until).getTime() > Date.now())),
    siteRole: profile.site_role === 'site_admin' ? 'site_admin' : 'member',
    profileTagline: profile.profile_tagline || '',
  }
}

const normalizeSocialProfile = (value: unknown): SocialProfile => {
  const profile = value as { id: string; username: string; display_name: string; avatar_seed: string; avatar_asset_path?: string | null; avatar_source?: AvatarSource; premium_ring_enabled?: boolean; premium_ring_color?: PremiumRingColor; presence: Presence; presence_updated_at?: string | null; membership_tier?: IdentityTier; premium_until?: string | null; is_verified?: boolean; site_role?: SiteRole; profile_tagline?: string }
  const presenceStale = Boolean(profile.presence_updated_at && Date.now() - new Date(profile.presence_updated_at).getTime() > 120_000)
  const isVerified = profile.is_verified === true || (profile.membership_tier === 'premium' && (!profile.premium_until || new Date(profile.premium_until).getTime() > Date.now()))
  return { id: profile.id, username: profile.username, displayName: profile.display_name, avatarSeed: profile.avatar_seed || 'mint', avatarAssetPath: profile.avatar_asset_path || null, avatarSource: profile.avatar_source === 'library' || profile.avatar_source === 'custom' ? profile.avatar_source : 'seed', premiumRingEnabled: profile.premium_ring_enabled === true, premiumRingColor: ['violet', 'cyan', 'pink', 'gold', 'aurora'].includes(profile.premium_ring_color || '') ? profile.premium_ring_color as PremiumRingColor : 'violet', presence: presenceStale ? 'offline' : (profile.presence || 'offline'), presenceUpdatedAt: profile.presence_updated_at || null, membershipTier: isVerified ? 'premium' : 'standard', premiumUntil: profile.premium_until || null, isVerified, siteRole: profile.site_role === 'site_admin' ? 'site_admin' : 'member', profileTagline: (isVerified || profile.site_role === 'site_admin') ? (profile.profile_tagline || '') : '' }
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
  const [activeRooms, setActiveRooms] = useState<ActiveRoomSummary[]>([])
  const [loading, setLoading] = useState(Boolean(supabase))

  const refresh = useCallback(async (displayName?: string) => {
    if (!supabase) { setLoading(false); return null }
    setLoading(true)
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) { setProfile(null); setGroups([]); setFriends([]); setRequests([]); setActiveRooms([]); return null }

      const authDisplayName = typeof authData.user.user_metadata?.display_name === 'string' ? authData.user.user_metadata.display_name.trim() : ''
      const rememberedDisplayName = localStorage.getItem('partyplay-display-name')?.trim() || ''
      const [rawProfile, profileBio] = await Promise.all([
        rpc<unknown>('partyplay_ensure_profile', { p_display_name: displayName || authDisplayName || rememberedDisplayName || null }),
        rpc<{ bio: string }>('partyplay_my_profile_bio', {}),
      ])
      const nextProfile = normalizeProfile({ ...(rawProfile as Record<string, unknown>), bio: profileBio.bio || '' })
      setProfile(nextProfile)

      const [{ data: rawGroups, error: groupsError }, { data: rawMemberships, error: membershipsError }, { data: rawFriendships, error: friendshipsError }, { data: rawRequests, error: requestsError }, nextActiveRooms] = await Promise.all([
        supabase.from('pp_groups').select('id, name, description, avatar_seed').order('created_at', { ascending: false }),
        supabase.from('pp_group_members').select('group_id, user_id, role'),
        supabase.from('pp_friendships').select('user_a, user_b'),
        supabase.from('pp_friend_requests').select('id, requester_id, created_at').eq('addressee_id', authData.user.id).eq('status', 'pending').order('created_at', { ascending: false }),
        loadMyActiveRooms().catch(() => []),
      ])
      if (groupsError || membershipsError || friendshipsError || requestsError) throw new PartyPlayError(groupsError?.message || membershipsError?.message || friendshipsError?.message || requestsError?.message || 'SOCIAL_LOAD_FAILED')

      const memberships = (rawMemberships || []) as Array<{ group_id: string; user_id: string; role: CurrentGroupMember['role'] }>
      const socialIds = [...new Set([
        ...(rawFriendships || []).flatMap((row) => [row.user_a, row.user_b]).filter((id) => id !== authData.user.id),
        ...(rawRequests || []).map((row) => row.requester_id),
        ...memberships.map((row) => row.user_id),
      ])]
      const { data: profilesData, error: profilesError } = socialIds.length
        ? await         supabase.from('pp_profiles').select('id, username, display_name, avatar_seed, avatar_asset_path, presence, membership_tier, premium_until, site_role, profile_tagline, premium_ring_enabled, premium_ring_color, presence_updated_at').in('id', socialIds)

        : { data: [], error: null }
      if (profilesError) throw new PartyPlayError(profilesError.message)
      const people = new Map((profilesData || []).map((value) => { const person = normalizeSocialProfile(value); return [person.id, person] }))

      const friendIds = (rawFriendships || []).map((row) => row.user_a === authData.user.id ? row.user_b : row.user_a)
      setFriends(friendIds.map((id) => people.get(id)).filter((person): person is SocialProfile => Boolean(person)))
      setRequests((rawRequests || []).map((row) => ({ id: row.id, requester: people.get(row.requester_id), createdAt: row.created_at })).filter((request): request is FriendRequest => Boolean(request.requester)))

      setActiveRooms(nextActiveRooms)
      setGroups(((rawGroups || []) as Array<{ id: string; name: string; description: string; avatar_seed: string }>).map((group) => {
        const groupMemberships = memberships.filter((membership) => membership.group_id === group.id)
        const members = groupMemberships.map((membership) => {
          const person = membership.user_id === authData.user.id
            ? { id: nextProfile.id, username: nextProfile.username, displayName: nextProfile.displayName, avatarSeed: nextProfile.avatarSeed, avatarAssetPath: nextProfile.avatarAssetPath, avatarSource: nextProfile.avatarSource, premiumRingEnabled: nextProfile.premiumRingEnabled, premiumRingColor: nextProfile.premiumRingColor, presence: nextProfile.presence, presenceUpdatedAt: nextProfile.presenceUpdatedAt, membershipTier: nextProfile.membershipTier, premiumUntil: nextProfile.premiumUntil, isVerified: nextProfile.isVerified, siteRole: nextProfile.siteRole, profileTagline: nextProfile.profileTagline }
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

  useEffect(() => {
    if (!profile?.id || !['online', 'in_game'].includes(profile.presence)) return
    const timer = window.setInterval(() => { void heartbeatPresence().catch(() => undefined) }, 60_000)
    return () => window.clearInterval(timer)
  }, [profile?.id, profile?.presence])

  useEffect(() => {
    if (!supabase || !profile?.id) return
    const client = supabase
    const channel = client.channel(`partyplay-social-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pp_profiles' }, () => { void refresh().catch(() => undefined) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pp_friendships' }, () => { void refresh().catch(() => undefined) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pp_friend_requests' }, () => { void refresh().catch(() => undefined) })
      .subscribe()
    return () => { void client.removeChannel(channel) }
  }, [profile?.id, refresh])

  const updateProfile = useCallback(async (updates: { displayName?: string; avatarSeed?: string; avatarLibraryId?: string; avatarMode?: AvatarSource; premiumRingEnabled?: boolean; premiumRingColor?: PremiumRingColor; presence?: Presence; allowFriendRequests?: boolean; profileTagline?: string }) => {
    const [data] = await Promise.all([rpc<unknown>('partyplay_update_profile', {
      p_display_name: updates.displayName ?? null,
      p_avatar_seed: updates.avatarSeed ?? null,
      p_presence: updates.presence && updates.presence !== 'in_game' ? updates.presence : null,
      p_allow_friend_requests: updates.allowFriendRequests ?? null,
      p_profile_tagline: updates.profileTagline ?? null,
      p_avatar_library_id: updates.avatarLibraryId ?? null,
      p_avatar_mode: updates.avatarMode ?? (updates.avatarSeed ? 'seed' : null),
      p_premium_ring_enabled: updates.premiumRingEnabled ?? null,
      p_premium_ring_color: updates.premiumRingColor ?? null,
    }), ...(updates.presence === 'in_game' ? [rpc('partyplay_set_presence', { p_presence: 'in_game' })] : [])])
    const next = normalizeProfile(data)
    if (updates.presence === 'in_game') next.presence = 'in_game'
    setProfile(next)
    localStorage.setItem('partyplay-display-name', next.displayName)
    return (await refresh()) || next
  }, [refresh])

  const lookupProfile = useCallback(async (username: string) => normalizeSocialProfile(await rpc<unknown>('partyplay_lookup_profile', { p_username: username })), [])
  const sendFriendRequest = useCallback(async (username: string) => { await rpc('partyplay_send_friend_request', { p_username: username }); await refresh() }, [refresh])
  const respondToRequest = useCallback(async (requestId: string, accept: boolean) => { await rpc('partyplay_respond_friend_request', { p_request_id: requestId, p_accept: accept }); await refresh() }, [refresh])
  const removeFriend = useCallback(async (friendId: string) => { await rpc('partyplay_remove_friend', { p_friend_id: friendId }); await refresh() }, [refresh])
  const createFriendsRoom = useCallback(async (gameType: 'tic_tac_toe' | 'mafia' | 'truth_or_dare', friendId: string, capacity: number) => {
    const room = await rpc<{ room_id: string; invite_code: string; capacity: number; status: string }>('partyplay_create_friends_room', { p_game_type: gameType, p_name: null, p_friend_ids: [friendId], p_capacity: capacity })
    await refresh()
    return room
  }, [refresh])

  const createGroup = useCallback(async (name: string) => {
    const data = await rpc<{ id: string; name: string }>('partyplay_create_group', { p_name: name })
    await rpc('partyplay_update_group_identity', { p_group_id: data.id, p_name: null, p_description: null, p_avatar_seed: 'ring' })
    await refresh()
    return data
  }, [refresh])
  const addGroupMember = useCallback(async (groupId: string, username: string) => { await rpc('partyplay_add_group_member', { p_group_id: groupId, p_username: username }); await refresh() }, [refresh])
  const updateGroupIdentity = useCallback(async (groupId: string, updates: { name?: string; description?: string; avatarSeed?: string }) => { await rpc('partyplay_update_group_identity', { p_group_id: groupId, p_name: updates.name ?? null, p_description: updates.description ?? null, p_avatar_seed: updates.avatarSeed ?? null }); await refresh() }, [refresh])

  return { profile, groups, friends, requests, activeRooms, loading, refresh, updateProfile, lookupProfile, sendFriendRequest, respondToRequest, removeFriend, createFriendsRoom, createGroup, addGroupMember, updateGroupIdentity }
}
