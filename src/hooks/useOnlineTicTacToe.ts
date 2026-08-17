import { useCallback, useEffect, useState } from 'react'
import {
  createOnlineRoom,
  joinOnlineRoom,
  loadOnlineRoom,
  makeOnlineTicTacToeMove,
  startOnlineTicTacToe,
  subscribeToOnlineRoom,
  type LoadedRoom,
  type PartyPlaySession,
} from '../lib/partyplay'
import { supabase } from '../lib/supabase'

export function useOnlineTicTacToe() {
  const [room, setRoom] = useState<LoadedRoom | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getUser().then(({ data }) => {
      if (active) setCurrentUserId(data.user?.id || null)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setCurrentUserId(session?.user.id || null)
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const refreshRoom = useCallback(async (roomId: string) => {
    const nextRoom = await loadOnlineRoom(roomId)
    setRoom(nextRoom)
    return nextRoom
  }, [])

  useEffect(() => {
    const roomId = room?.room.id
    if (!roomId) return
    const channel = subscribeToOnlineRoom(roomId, () => {
      void refreshRoom(roomId).catch(() => undefined)
    })
    return () => {
      if (channel && supabase) void supabase.removeChannel(channel)
    }
  }, [refreshRoom, room?.room.id])

  const createRoom = useCallback(async (name: string) => {
    setPending(true)
    try {
      const created = await createOnlineRoom({ gameType: 'tic_tac_toe', name, capacity: 2 })
      return await refreshRoom(created.id)
    } finally {
      setPending(false)
    }
  }, [refreshRoom])

  const joinRoom = useCallback(async (inviteCode: string) => {
    setPending(true)
    try {
      const joined = await joinOnlineRoom(inviteCode)
      return await refreshRoom(joined.id)
    } finally {
      setPending(false)
    }
  }, [refreshRoom])

  const setSession = useCallback((session: PartyPlaySession) => {
    setRoom((previous) => previous ? { ...previous, session } : previous)
  }, [])

  const start = useCallback(async () => {
    if (!room) throw new Error('ROOM_NOT_FOUND')
    setPending(true)
    try {
      const session = await startOnlineTicTacToe(room.room.id)
      setSession(session)
      return session
    } finally {
      setPending(false)
    }
  }, [room, setSession])

  const move = useCallback(async (cell: number) => {
    if (!room?.session) throw new Error('SESSION_NOT_FOUND')
    setPending(true)
    try {
      const session = await makeOnlineTicTacToeMove({
        sessionId: room.session.id,
        cell,
        expectedVersion: room.session.version,
      })
      setSession(session)
      return session
    } finally {
      setPending(false)
    }
  }, [room?.session, setSession])

  return {
    room,
    currentUserId,
    pending,
    createRoom,
    joinRoom,
    start,
    move,
    refreshRoom,
    clearRoom: () => setRoom(null),
  }
}
