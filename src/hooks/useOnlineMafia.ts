import { useCallback, useEffect, useRef, useState } from 'react'
import {
  acknowledgeOnlineMafiaRole, advanceOnlineMafiaNight, type LoadedRoom, type MafiaPrivateView, type MafiaReaction,
  type MafiaSpeakerMode, type MafiaSpeakerReactionEvent, type MafiaTeamMessage, type PartyPlayRoomMessage,
  loadOnlineMafiaPrivateView, loadOnlineMafiaSpeakerReactions, loadOnlineMafiaTeamMessages, loadOnlineRoom,
  loadOnlineSessionMessages, nextOnlineMafiaSpeaker, openOnlineMafiaNight, reactOnlineMafia, resolveOnlineMafiaVote,
  sendOnlineMafiaDayMessage, sendOnlineMafiaTeamMessage, setOnlineMafiaSpeaking, startOnlineMafia,
  submitOnlineMafiaNightAction, subscribeToOnlineRoom, voteOnlineMafia, createOnlineRoom, joinOnlineRoom,
} from '../lib/partyplay'
import { supabase } from '../lib/supabase'

export function useOnlineMafia() {
  const [room, setRoom] = useState<LoadedRoom | null>(null)
  const [privateView, setPrivateView] = useState<MafiaPrivateView | null>(null)
  const [messages, setMessages] = useState<PartyPlayRoomMessage[]>([])
  const [teamMessages, setTeamMessages] = useState<MafiaTeamMessage[]>([])
  const [speakerReactions, setSpeakerReactions] = useState<MafiaSpeakerReactionEvent[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const channelRef = useRef<ReturnType<typeof subscribeToOnlineRoom>>(null)

  useEffect(() => {
    let active = true
    if (!supabase) return
    void supabase.auth.getUser().then(({ data }) => { if (active) setCurrentUserId(data.user?.id || null) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setCurrentUserId(session?.user?.id || null))
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  const refreshRoom = useCallback(async (roomId?: string) => {
    const id = roomId || room?.room.id
    if (!id) return
    const nextRoom = await loadOnlineRoom(id)
    setRoom(nextRoom)
    if (nextRoom.session?.state && nextRoom.room.game_type === 'mafia') {
      const sessionId = nextRoom.session.id
      const [view, dayMessages, reactions] = await Promise.all([
        loadOnlineMafiaPrivateView(sessionId),
        loadOnlineSessionMessages(nextRoom.room.id, sessionId),
        loadOnlineMafiaSpeakerReactions(sessionId),
      ])
      setPrivateView(view)
      setMessages(dayMessages)
      setSpeakerReactions(reactions)
      setTeamMessages(view.self.faction === 'mafia' ? await loadOnlineMafiaTeamMessages(sessionId) : [])
    } else {
      setPrivateView(null); setMessages([]); setTeamMessages([]); setSpeakerReactions([])
    }
  }, [room?.room.id])

  const execute = useCallback(async (operation: () => Promise<unknown>, roomId?: string) => {
    setPending(true); setError('')
    try { await operation(); await refreshRoom(roomId) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'عملیات کامل نشد.') }
    finally { setPending(false) }
  }, [refreshRoom])

  useEffect(() => {
    if (!room?.room.id) return
    channelRef.current?.unsubscribe()
    channelRef.current = subscribeToOnlineRoom(room.room.id, () => { void refreshRoom(room.room.id).catch(() => undefined) })
    return () => { channelRef.current?.unsubscribe(); channelRef.current = null }
  }, [room?.room.id, refreshRoom])

  const createRoom = useCallback(async (name: string, capacity: number) => {
    setPending(true); setError('')
    try {
      const created = await createOnlineRoom({ gameType: 'mafia', name, capacity })
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

  const sessionInput = () => room?.session ? { sessionId: room.session.id, expectedVersion: room.session.version } : null
  const start = useCallback(async () => { if (room) await execute(() => startOnlineMafia(room.room.id), room.room.id) }, [execute, room])
  const acknowledgeRole = useCallback(async () => { const input = sessionInput(); if (input) await execute(() => acknowledgeOnlineMafiaRole(input)) }, [execute, room])
  const setSpeaking = useCallback(async (mode: Exclude<MafiaSpeakerMode, null>) => { const input = sessionInput(); if (input) await execute(() => setOnlineMafiaSpeaking({ ...input, mode })) }, [execute, room])
  const nextSpeaker = useCallback(async () => { const input = sessionInput(); if (input) await execute(() => nextOnlineMafiaSpeaker(input)) }, [execute, room])
  const sendDayMessage = useCallback(async (body: string) => { const input = sessionInput(); if (input) await execute(() => sendOnlineMafiaDayMessage({ sessionId: input.sessionId, body })) }, [execute, room])
  const react = useCallback(async (reaction: MafiaReaction) => { const input = sessionInput(); if (input) await execute(() => reactOnlineMafia({ sessionId: input.sessionId, reaction })) }, [execute, room])
  const vote = useCallback(async (choice: 'player' | 'nobody', targetUserId?: string) => { const input = sessionInput(); if (input) await execute(() => voteOnlineMafia({ sessionId: input.sessionId, choice, targetUserId })) }, [execute, room])
  const resolveVote = useCallback(async () => { const input = sessionInput(); if (input) await execute(() => resolveOnlineMafiaVote(input)) }, [execute, room])
  const openNight = useCallback(async () => { const input = sessionInput(); if (input) await execute(() => openOnlineMafiaNight(input)) }, [execute, room])
  const sendTeamMessage = useCallback(async (body: string) => { const input = sessionInput(); if (input) await execute(() => sendOnlineMafiaTeamMessage({ sessionId: input.sessionId, body })) }, [execute, room])
  const submitNightAction = useCallback(async (targetUserId?: string | null) => { const input = sessionInput(); if (input) await execute(() => submitOnlineMafiaNightAction({ ...input, targetUserId })) }, [execute, room])
  const advanceNight = useCallback(async () => { const input = sessionInput(); if (input) await execute(() => advanceOnlineMafiaNight(input)) }, [execute, room])

  return { room, privateView, messages, teamMessages, speakerReactions, currentUserId, pending, error, refreshRoom, createRoom, joinRoom, start, acknowledgeRole, setSpeaking, nextSpeaker, sendDayMessage, react, vote, resolveVote, openNight, sendTeamMessage, submitNightAction, advanceNight }
}
