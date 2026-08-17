import { useCallback, useEffect, useState } from 'react'
import { PartyPlayError } from '../lib/partyplay'
import { supabase } from '../lib/supabase'

export type CurrentProfile = {
  id: string
  username: string
  displayName: string
  avatarSeed: string
  presence: 'online' | 'away' | 'busy' | 'offline'
  themePreference: 'system' | 'light' | 'dark'
}

export type CurrentGroup = {
  id: string
  name: string
  description: string
  avatarSeed: string
  memberCount: number
}

const normalizeProfile = (value: unknown): CurrentProfile => {
  const profile = value as {
    id: string
    username: string
    display_name: string
    avatar_seed: string
    presence: CurrentProfile['presence']
    theme_preference: CurrentProfile['themePreference']
  }
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name,
    avatarSeed: profile.avatar_seed,
    presence: profile.presence,
    themePreference: profile.theme_preference,
  }
}

export function usePartyPlayData() {
  const [profile, setProfile] = useState<CurrentProfile | null>(null)
  const [groups, setGroups] = useState<CurrentGroup[]>([])
  const [loading, setLoading] = useState(Boolean(supabase))

  const refresh = useCallback(async (displayName?: string) => {
    if (!supabase) {
      setLoading(false)
      return null
    }
    setLoading(true)
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) {
        setProfile(null)
        setGroups([])
        return null
      }

      const { data: rawProfile, error: profileError } = await supabase.rpc('partyplay_ensure_profile', {
        p_display_name: displayName || null,
      })
      if (profileError) throw new PartyPlayError(profileError.message)
      const nextProfile = normalizeProfile(rawProfile)
      setProfile(nextProfile)

      const [{ data: rawGroups, error: groupsError }, { data: memberships, error: membershipsError }] = await Promise.all([
        supabase.from('pp_groups').select('id, name, description, avatar_seed').order('created_at', { ascending: false }),
        supabase.from('pp_group_members').select('group_id'),
      ])
      if (groupsError) throw new PartyPlayError(groupsError.message)
      if (membershipsError) throw new PartyPlayError(membershipsError.message)

      const counts = new Map<string, number>()
      for (const membership of memberships || []) {
        counts.set(membership.group_id, (counts.get(membership.group_id) || 0) + 1)
      }
      setGroups(((rawGroups || []) as Array<{ id: string; name: string; description: string; avatar_seed: string }>).map((group) => ({
        id: group.id,
        name: group.name,
        description: group.description,
        avatarSeed: group.avatar_seed,
        memberCount: counts.get(group.id) || 1,
      })))
      return nextProfile
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh().catch(() => setLoading(false))
    if (!supabase) return
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      void refresh().catch(() => setLoading(false))
    })
    return () => listener.subscription.unsubscribe()
  }, [refresh])

  const createGroup = useCallback(async (name: string) => {
    if (!supabase) throw new PartyPlayError('SUPABASE_NOT_CONFIGURED')
    const { data, error } = await supabase.rpc('partyplay_create_group', { p_name: name })
    if (error) throw new PartyPlayError(error.message)
    await refresh()
    return data as { id: string; name: string }
  }, [refresh])

  return { profile, groups, loading, refresh, createGroup }
}
