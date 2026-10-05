import { useCallback, useEffect, useState } from 'react'
import {
  chooseOnlineTruthDare,
  createOnlineTruthDareRoom,
  finishOnlineTruthDare,
  joinOnlineRoom,
  loadOnlineRoom,
  loadOnlineTruthDareMessages,
  nextOnlineTruthDareTurn,
  passOnlineTruthDareTurn,
  rateOnlineTruthDare,
  loadOnlineTruthDareScoreboard,
  sendOnlineTruthDareMessage,
  startOnlineTruthDare,
  subscribeToOnlineRoom,
  toggleOnlineMessageReaction,
  type LoadedRoom,
  type PartyPlayRoomMessage,
  type PartyPlaySession,
  type TruthDareChoice,
  type TruthDareReaction,
  type TruthDareRoomSettings,
  type TruthDareScoreboardEntry,
} from '../lib/partyplay'
import { supabase } from '../lib/supabase'

export function useOnlineTruthDare() {
  const [room, setRoom] = useState<LoadedRoom | null>(null)
  const [messages, setMessages] = useState<PartyPlayRoomMessage[]>([])
  const [scoreboard, setScoreboard] = useState<TruthDareScoreboardEntry[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getUser().then(({ data }) => { if (active) setCurrentUserId(data.user?.id || null) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { if (active) setCurrentUserId(session?.user.id || null) })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  const refreshRoom = useCallback(async (roomId: string) => {
    const next = await loadOnlineRoom(roomId)
    setRoom(next)
    if (next.room.game_type === 'truth_or_dare' && next.session) {
      const [nextMessages, nextScores] = await Promise.all([loadOnlineTruthDareMessages(roomId, next.session.id), loadOnlineTruthDareScoreboard(next.session.id)])
      setMessages(nextMessages)
      setScoreboard(nextScores)
    } else { setMessages([]); setScoreboard([]) }
    return next
  }, [])

  useEffect(() => {
    const roomId = room?.room.id
    if (!roomId) return
    const channel = subscribeToOnlineRoom(roomId, () => { void refreshRoom(roomId).catch(() => undefined) })
    return () => { if (channel && supabase) void supabase.removeChannel(channel) }
  }, [refreshRoom, room?.room.id])

  const createRoom = useCallback(async (capacity: number, settings: TruthDareRoomSettings) => {
    setPending(true)
    try {
      const created = await createOnlineTruthDareRoom({ name: 'جرئت یا حقیقت دوستان', capacity, settings })
      return await refreshRoom(created.id)
    } finally { setPending(false) }
  }, [refreshRoom])

  const joinRoom = useCallback(async (inviteCode: string) => {
    setPending(true)
    try {
      const joined = await joinOnlineRoom(inviteCode)
      return await refreshRoom(joined.id)
    } finally { setPending(false) }
  }, [refreshRoom])

  const setSession = useCallback((session: PartyPlaySession) => setRoom((previous) => previous ? { ...previous, session } : previous), [])

  const start = useCallback(async () => {
    if (!room) throw new Error('ROOM_NOT_FOUND')
    setPending(true)
    try {
      const session = await startOnlineTruthDare(room.room.id)
      setSession(session)
      return session
    } finally { setPending(false) }
  }, [room, setSession])

  const choose = useCallback(async (choice: TruthDareChoice) => {
    if (!room?.session) throw new Error('SESSION_NOT_FOUND')
    setPending(true)
    try {
      const session = await chooseOnlineTruthDare({ sessionId: room.session.id, choice, expectedVersion: room.session.version })
      setSession(session)
      return session
    } finally { setPending(false) }
  }, [room?.session, setSession])

  const nextTurn = useCallback(async () => {
    if (!room?.session) throw new Error('SESSION_NOT_FOUND')
    setPending(true)
    try {
      const session = await nextOnlineTruthDareTurn({ sessionId: room.session.id, expectedVersion: room.session.version })
      setSession(session)
      return session
    } finally { setPending(false) }
  }, [room?.session, setSession])

  const pass = useCallback(async () => {
    if (!room?.session) throw new Error('SESSION_NOT_FOUND')
    setPending(true)
    try { setSession(await passOnlineTruthDareTurn({ sessionId: room.session.id, expectedVersion: room.session.version })); return await refreshRoom(room.room.id) }
    finally { setPending(false) }
  }, [refreshRoom, room?.room.id, room?.session, setSession])

  const rate = useCallback(async (roundNo: number, score: number) => {
    if (!room?.session) throw new Error('SESSION_NOT_FOUND')
    setPending(true)
    try {
      setSession(await rateOnlineTruthDare({ sessionId: room.session.id, roundNo, score }))
      setScoreboard(await loadOnlineTruthDareScoreboard(room.session.id))
    } finally { setPending(false) }
  }, [room?.session, setSession])

  const finish = useCallback(async () => {
    if (!room?.session) throw new Error('SESSION_NOT_FOUND')
    setPending(true)
    try {
      const session = await finishOnlineTruthDare({ sessionId: room.session.id, expectedVersion: room.session.version })
      setSession(session)
      return session
    } finally { setPending(false) }
  }, [room?.session, setSession])

  const sendMessage = useCallback(async (body: string) => {
    if (!room?.session) throw new Error('SESSION_NOT_FOUND')
    setPending(true)
    try {
      await sendOnlineTruthDareMessage({ sessionId: room.session.id, body })
      await refreshRoom(room.room.id)
    } finally { setPending(false) }
  }, [refreshRoom, room?.room.id, room?.session])

  const toggleReaction = useCallback(async (messageId: number, reaction: TruthDareReaction) => {
    setPending(true)
    try {
      await toggleOnlineMessageReaction({ messageId, reaction })
      if (room) await refreshRoom(room.room.id)
    } finally { setPending(false) }
  }, [refreshRoom, room])

  return {
    room, messages, scoreboard, currentUserId, pending, createRoom, joinRoom, start, choose, nextTurn, pass, rate, finish,
    sendMessage, toggleReaction, refreshRoom, clearRoom: () => { setRoom(null); setMessages([]); setScoreboard([]) },
  }
}
