import { useCallback, useEffect, useRef, useState } from 'react'
import {
  applyOnlineFullGameState, createOnlineRoom, joinOnlineRoom, loadOnlinePrivateGameState, loadOnlineRoom, saveOnlinePrivateGameState, startOnlineFullGame,
  subscribeToOnlineRoom, type FullGameState, type FullPartyPlayGameType, type LoadedRoom,
} from '../lib/partyplay'
import { supabase } from '../lib/supabase'

export function useOnlineFullGame() {
  const [room, setRoom] = useState<LoadedRoom | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [privateState, setPrivateState] = useState<Record<string, unknown>>({})
  const channelRef = useRef<ReturnType<typeof subscribeToOnlineRoom>>(null)

  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getUser().then(({ data }) => { if (active) setCurrentUserId(data.user?.id || null) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setCurrentUserId(session?.user?.id || null))
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  const refreshRoom = useCallback(async (roomId?: string) => {
    const id = roomId || room?.room.id
    if (!id) return null
    const next = await loadOnlineRoom(id)
    setRoom(next)
    if (next.session) {
      try { setPrivateState(await loadOnlinePrivateGameState(next.session.id)) } catch { setPrivateState({}) }
    }
    return next
  }, [room?.room.id])

  useEffect(() => {
    if (!room?.room.id) return
    channelRef.current?.unsubscribe()
    channelRef.current = subscribeToOnlineRoom(room.room.id, () => { void refreshRoom(room.room.id).catch(() => undefined) })
    return () => { channelRef.current?.unsubscribe(); channelRef.current = null }
  }, [room?.room.id, refreshRoom])

  const execute = useCallback(async (operation: () => Promise<unknown>, roomId?: string) => {
    setPending(true); setError('')
    try { await operation(); await refreshRoom(roomId) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'عملیات کامل نشد.') }
    finally { setPending(false) }
  }, [refreshRoom])

  const createRoom = useCallback(async (gameType: FullPartyPlayGameType, name: string, capacity: number) => {
    setPending(true); setError('')
    try {
      const created = await createOnlineRoom({ gameType, name, capacity })
      await refreshRoom(created.id)
      return created.id
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'ساخت اتاق کامل نشد.'
      setError(message)
      throw reason
    } finally { setPending(false) }
  }, [refreshRoom])

  const joinRoom = useCallback(async (inviteCode: string) => {
    setPending(true); setError('')
    try {
      const joined = await joinOnlineRoom(inviteCode)
      await refreshRoom(joined.id)
      return joined.id
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'ورود به اتاق کامل نشد.'
      setError(message)
      throw reason
    } finally { setPending(false) }
  }, [refreshRoom])

  const start = useCallback(async () => {
    if (!room) return
    await execute(() => startOnlineFullGame(room.room.id), room.room.id)
  }, [execute, room])

  const applyState = useCallback(async (state: FullGameState, turnUserId: string | null, status: 'running' | 'finished', eventType?: string) => {
    if (!room?.session) return
    await execute(() => applyOnlineFullGameState({ sessionId: room.session!.id, state, turnUserId, status, expectedVersion: room.session!.version, eventType }), room.room.id)
  }, [execute, room])

  const savePrivateState = useCallback(async (state: Record<string, unknown>) => {
    if (!room?.session) return
    setPending(true); setError('')
    try { setPrivateState(await saveOnlinePrivateGameState(room.session.id, state)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'ذخیرهٔ دادهٔ خصوصی کامل نشد.') }
    finally { setPending(false) }
  }, [room?.session])

  return { room, currentUserId, pending, error, privateState, refreshRoom, createRoom, joinRoom, start, applyState, savePrivateState }
}
