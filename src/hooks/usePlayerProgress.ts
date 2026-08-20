import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadPlayerProgress, type PlayerProgress } from '../lib/partyplay'
import { supabase } from '../lib/supabase'

const emptyProgress: PlayerProgress = {
  gamesPlayed: 0, finishedGames: 0, mafiaGames: 0, hostedRooms: 0, friendsCount: 0, groupsCount: 0, weekActiveDays: 0, lastGameAt: null, achievements: [],
}

export function usePlayerProgress() {
  const [progress, setProgress] = useState<PlayerProgress>(emptyProgress)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!supabase) { setLoading(false); return emptyProgress }
    setLoading(true)
    try {
      const next = await loadPlayerProgress()
      setProgress(next)
      setError('')
      return next
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'PLAYER_PROGRESS_LOAD_FAILED')
      return emptyProgress
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    void refresh()
    if (!supabase) return
    const { data: subscription } = supabase.auth.onAuthStateChange(() => { void refresh() })
    return () => subscription.subscription.unsubscribe()
  }, [refresh])

  const completion = useMemo(() => Math.min(100, Math.round((progress.achievements.length / 4) * 100)), [progress.achievements.length])
  return { progress, loading, error, completion, refresh }
}
