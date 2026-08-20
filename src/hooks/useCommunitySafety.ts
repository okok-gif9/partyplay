import { useCallback, useEffect, useState } from 'react'
import {
  blockCommunityUser, loadMyBlocks, loadMyCommunityReports, submitCommunityReport, unblockCommunityUser,
  type BlockedProfile, type CommunityReportCategory, type MyCommunityReport,
} from '../lib/partyplay'
import { supabase } from '../lib/supabase'

export function useCommunitySafety() {
  const [blocks, setBlocks] = useState<BlockedProfile[]>([])
  const [reports, setReports] = useState<MyCommunityReport[]>([])
  const [loading, setLoading] = useState(Boolean(supabase))
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)
    try {
      const [nextBlocks, nextReports] = await Promise.all([loadMyBlocks(), loadMyCommunityReports()])
      setBlocks(nextBlocks)
      setReports(nextReports)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    void refresh().catch(() => setLoading(false))
    if (!supabase) return
    const { data: listener } = supabase.auth.onAuthStateChange(() => { void refresh().catch(() => setLoading(false)) })
    return () => listener.subscription.unsubscribe()
  }, [refresh])

  const block = useCallback(async (userId: string) => {
    setBusy(true)
    try {
      const blocked = await blockCommunityUser(userId)
      setBlocks((current) => current.some((item) => item.id === blocked.id) ? current : [{ ...blocked, blocked_at: new Date().toISOString() }, ...current])
      return blocked
    } finally { setBusy(false) }
  }, [])

  const unblock = useCallback(async (userId: string) => {
    setBusy(true)
    try { await unblockCommunityUser(userId); setBlocks((current) => current.filter((item) => item.id !== userId)) }
    finally { setBusy(false) }
  }, [])

  const report = useCallback(async (input: { userId: string; category: CommunityReportCategory; details: string }) => {
    setBusy(true)
    try {
      const item = await submitCommunityReport(input)
      await refresh()
      return item
    } finally { setBusy(false) }
  }, [refresh])

  return { blocks, reports, loading, busy, refresh, block, unblock, report }
}
