import { useCallback, useEffect, useState } from 'react'
import {
  adminModerateAccount,
  cancelAdminTestRoom,
  createAdminTestRoom,
  loadAdminDashboard,
  loadAdminSession,
  loadAdminTestRooms,
  loadAdminUserDetail,
  loadAdminUsers,
  type AccountModerationAction,
  type AdminDashboard,
  type AdminSession,
  type AdminTestRoom,
  type AdminUserDetail,
  type AdminUserList,
  type PartyPlayGameType,
} from '../lib/partyplay'
import { supabase } from '../lib/supabase'

export function useAdminConsole() {
  const [session, setSession] = useState<AdminSession | null>(null)
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null)
  const [users, setUsers] = useState<AdminUserList>({ items: [], total: 0, limit: 25, offset: 0 })
  const [testRooms, setTestRooms] = useState<AdminTestRoom[]>([])
  const [loading, setLoading] = useState(Boolean(supabase))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      setError('اتصال Supabase در این نسخه تنظیم نشده است.')
      return false
    }
    setLoading(true)
    setError(null)
    try {
      const nextSession = await loadAdminSession()
      const [nextDashboard, nextUsers, nextTestRooms] = await Promise.all([
        loadAdminDashboard(),
        loadAdminUsers('', 25, 0),
        loadAdminTestRooms(),
      ])
      setSession(nextSession)
      setDashboard(nextDashboard)
      setUsers(nextUsers)
      setTestRooms(nextTestRooms)
      return true
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'داده‌های پنل مدیریت بارگذاری نشد.'
      setSession(null)
      setDashboard(null)
      setUsers({ items: [], total: 0, limit: 25, offset: 0 })
      setTestRooms([])
      setError(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    if (!supabase) return
    const { data: listener } = supabase.auth.onAuthStateChange(() => { void refresh() })
    return () => listener.subscription.unsubscribe()
  }, [refresh])

  const searchUsers = useCallback(async (query: string, offset = 0) => {
    setBusy(true)
    try {
      const next = await loadAdminUsers(query, 25, offset)
      setUsers(next)
      return next
    } finally {
      setBusy(false)
    }
  }, [])

  const loadUser = useCallback(async (userId: string): Promise<AdminUserDetail> => {
    setBusy(true)
    try {
      return await loadAdminUserDetail(userId)
    } finally {
      setBusy(false)
    }
  }, [])

  const moderateAccount = useCallback(async (input: { userId: string; action: AccountModerationAction; reason: string; durationHours?: 24 | 168 | 720 | null; confirmUsername?: string }) => {
    setBusy(true)
    try {
      const result = await adminModerateAccount(input)
      const [nextDashboard, nextUsers] = await Promise.all([
        loadAdminDashboard(),
        loadAdminUsers('', 25, 0),
      ])
      setDashboard(nextDashboard)
      setUsers(nextUsers)
      if (result.state === 'purged') return null
      return await loadAdminUserDetail(input.userId)
    } finally {
      setBusy(false)
    }
  }, [])

  const createTestRoom = useCallback(async (input: { gameType: PartyPlayGameType; name?: string; capacity: number }) => {
    setBusy(true)
    try {
      const room = await createAdminTestRoom(input)
      const [nextDashboard, nextRooms] = await Promise.all([loadAdminDashboard(), loadAdminTestRooms()])
      setDashboard(nextDashboard)
      setTestRooms(nextRooms)
      return room
    } finally {
      setBusy(false)
    }
  }, [])

  const cancelTestRoom = useCallback(async (roomId: string) => {
    setBusy(true)
    try {
      await cancelAdminTestRoom(roomId)
      const [nextDashboard, nextRooms] = await Promise.all([loadAdminDashboard(), loadAdminTestRooms()])
      setDashboard(nextDashboard)
      setTestRooms(nextRooms)
    } finally {
      setBusy(false)
    }
  }, [])

  return { session, dashboard, users, testRooms, loading, busy, error, refresh, searchUsers, loadUser, moderateAccount, createTestRoom, cancelTestRoom }
}
