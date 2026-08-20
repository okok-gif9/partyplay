import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadActivityFeed, markActivityRead, type PartyPlayActivity } from '../lib/partyplay'
import { supabase } from '../lib/supabase'

export function useActivityFeed() {
  const [items, setItems] = useState<PartyPlayActivity[]>([])
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!supabase) { setLoading(false); return [] }
    setLoading(true)
    try {
      const next = await loadActivityFeed()
      setItems(next)
      setError('')
      return next
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ACTIVITY_LOAD_FAILED')
      return []
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    void refresh()
    const client = supabase
    if (!client) return
    let channel: ReturnType<typeof client.channel> | null = null
    void client.auth.getUser().then(({ data }) => {
      if (!data.user) return
      channel = client.channel(`partyplay-activity-${data.user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pp_activity_events', filter: `recipient_id=eq.${data.user.id}` }, () => { void refresh() })
        .subscribe()
    })
    return () => { if (channel) void client.removeChannel(channel) }
  }, [refresh])

  const markAllRead = useCallback(async () => {
    const unreadIds = items.filter((item) => !item.readAt).map((item) => item.id)
    if (!unreadIds.length) return 0
    const count = await markActivityRead(unreadIds)
    if (count) setItems((current) => current.map((item) => unreadIds.includes(item.id) ? { ...item, readAt: new Date().toISOString() } : item))
    return count
  }, [items])

  const unreadCount = useMemo(() => items.filter((item) => !item.readAt).length, [items])
  return { items, loading, error, unreadCount, refresh, markAllRead }
}
