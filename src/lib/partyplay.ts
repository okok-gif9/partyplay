import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type PartyPlayGameType = 'mafia' | 'tic_tac_toe' | 'truth_or_dare' | 'snakes_ladders'
export type TicTacToeMark = 'X' | 'O'
export type TruthDareChoice = 'truth' | 'dare'
export type TruthDareReaction = '😂' | '🔥' | '👏' | '😮'

export type PartyPlayRoom = {
  id: string
  invite_code: string
  name: string
  game_type: PartyPlayGameType
  status: 'lobby' | 'playing' | 'finished' | 'cancelled'
  capacity: number
  host_id: string
}

export type PartyPlayRoomMember = {
  userId: string
  displayName: string
  username: string
  avatarSeed: string
  role: 'host' | 'player' | 'spectator' | 'bot'
  seatNo: number | null
  ready: boolean
}

export type TicTacToeState = {
  board: Array<TicTacToeMark | null>
  marks: Record<TicTacToeMark, string>
}

export type TruthDareState = {
  phase: 'choosing' | 'revealed' | 'finished'
  cycle_player_ids: string[]
  cycle_index: number
  selected: null | {
    player_id: string
    choice: TruthDareChoice
    card_index: number
  }
  chat_closes_at: string | null
}

export type PartyPlaySession = {
  id: string
  room_id: string
  status: 'waiting' | 'running' | 'finished' | 'abandoned'
  state: TicTacToeState | TruthDareState
  turn_user_id: string | null
  winner_id: string | null
  round_no: number
  version: number
}

export type PartyPlayMessageReaction = {
  userId: string
  reaction: TruthDareReaction
}

export type PartyPlayRoomMessage = {
  id: number
  roomId: string
  sessionId: string | null
  roundNo: number | null
  sender: Pick<PartyPlayRoomMember, 'userId' | 'displayName' | 'username' | 'avatarSeed'>
  body: string
  createdAt: string
  reactions: PartyPlayMessageReaction[]
}

export type LoadedRoom = {
  room: PartyPlayRoom
  members: PartyPlayRoomMember[]
  session: PartyPlaySession | null
}

export class PartyPlayError extends Error {
  readonly code: string

  constructor(code: string) {
    super(roomErrorMessage(code))
    this.code = code
  }
}

const roomErrorMessage = (code: string) => {
  const messages: Record<string, string> = {
    NOT_AUTHENTICATED: 'برای این کار باید وارد حساب خودت شوی.',
    ROOM_NOT_FOUND: 'اتاقی با این لینک پیدا نشد.',
    ROOM_NOT_JOINABLE: 'این اتاق دیگر قابل ورود نیست.',
    ROOM_FULL: 'ظرفیت اتاق کامل شده است.',
    NEED_TWO_PLAYERS: 'برای شروع، دست‌کم دو بازیکن لازم است.',
    NOT_HOST: 'فقط میزبان می‌تواند این کار را انجام دهد.',
    NOT_A_MEMBER: 'اجازهٔ دسترسی به این اتاق را نداری.',
    NOT_YOUR_TURN: 'هنوز نوبت تو نیست.',
    INVALID_MOVE: 'این حرکت معتبر نیست.',
    CELL_OCCUPIED: 'این خانه قبلاً پر شده است.',
    CONFLICT: 'وضعیت بازی تغییر کرده؛ صفحه به‌روز شد.',
    GAME_NOT_ACTIVE: 'این بازی فعال نیست.',
    SESSION_NOT_FOUND: 'جلسهٔ بازی پیدا نشد.',
    INVALID_CHOICE: 'انتخاب کارت معتبر نیست.',
    CHOICE_ALREADY_MADE: 'کارت این دور انتخاب شده است.',
    CARD_NOT_REVEALED: 'ابتدا باید کارت این دور نمایش داده شود.',
    CHAT_LIMIT_REACHED: 'برای این دور، پیام خودت را فرستاده‌ای.',
    CHAT_CLOSED: 'زمان گفت‌وگوی این بازی تمام شده است.',
    INVALID_MESSAGE: 'پیام باید بین ۱ تا ۶۰۰ کاراکتر باشد.',
    INVALID_REACTION: 'این واکنش قابل استفاده نیست.',
    MESSAGE_NOT_FOUND: 'پیام موردنظر پیدا نشد.',
    SUPABASE_NOT_CONFIGURED: 'اتصال آنلاین در این نسخهٔ توسعه تنظیم نشده است؛ نسخهٔ منتشرشده را امتحان کن.',
  }
  return messages[code] || 'ارتباط با بازی کامل نشد. دوباره تلاش کن.'
}

const requireClient = () => {
  if (!supabase) throw new PartyPlayError('SUPABASE_NOT_CONFIGURED')
  return supabase
}

const knownErrorCodes = [
  'NOT_AUTHENTICATED', 'ROOM_NOT_FOUND', 'ROOM_NOT_JOINABLE', 'ROOM_FULL', 'NEED_TWO_PLAYERS',
  'NOT_HOST', 'NOT_A_MEMBER', 'NOT_YOUR_TURN', 'INVALID_MOVE', 'CELL_OCCUPIED', 'CONFLICT',
  'GAME_NOT_ACTIVE', 'SESSION_NOT_FOUND', 'INVALID_CHOICE', 'CHOICE_ALREADY_MADE', 'CARD_NOT_REVEALED',
  'CHAT_LIMIT_REACHED', 'CHAT_CLOSED', 'INVALID_MESSAGE', 'INVALID_REACTION', 'MESSAGE_NOT_FOUND', 'SUPABASE_NOT_CONFIGURED',
]

const throwIfError = (error: { message?: string } | null) => {
  if (!error) return
  const message = error.message || 'UNKNOWN'
  const knownCode = knownErrorCodes.find((code) => message.includes(code))
  throw new PartyPlayError(knownCode || message)
}

const asRoom = (value: unknown) => value as PartyPlayRoom
const asSession = (value: unknown) => value as PartyPlaySession
const commandId = () => typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`

export async function createOnlineRoom(input: {
  gameType: PartyPlayGameType
  name: string
  capacity: number
}) {
  const client = requireClient()
  const { error: profileError } = await client.rpc('partyplay_ensure_profile', { p_display_name: null })
  throwIfError(profileError)
  const { data, error } = await client.rpc('partyplay_create_room', {
    p_game_type: input.gameType,
    p_name: input.name,
    p_capacity: input.capacity,
  })
  throwIfError(error)
  return asRoom(data)
}

export async function joinOnlineRoom(inviteCode: string) {
  const client = requireClient()
  const { data, error } = await client.rpc('partyplay_join_room', { p_invite_code: inviteCode })
  throwIfError(error)
  return asRoom(data)
}

export async function startOnlineTicTacToe(roomId: string) {
  const client = requireClient()
  const { data, error } = await client.rpc('partyplay_start_tic_tac_toe', { p_room_id: roomId })
  throwIfError(error)
  return asSession(data)
}

export async function makeOnlineTicTacToeMove(input: { sessionId: string; cell: number; expectedVersion: number }) {
  const client = requireClient()
  const { data, error } = await client.rpc('partyplay_tic_tac_toe_move', {
    p_session_id: input.sessionId,
    p_cell: input.cell,
    p_expected_version: input.expectedVersion,
    p_command_id: commandId(),
  })
  throwIfError(error)
  return asSession(data)
}

export async function startOnlineTruthDare(roomId: string) {
  const client = requireClient()
  const { data, error } = await client.rpc('partyplay_start_truth_dare', { p_room_id: roomId })
  throwIfError(error)
  return asSession(data)
}

export async function chooseOnlineTruthDare(input: { sessionId: string; choice: TruthDareChoice; expectedVersion: number }) {
  const client = requireClient()
  const { data, error } = await client.rpc('partyplay_truth_dare_choose', {
    p_session_id: input.sessionId,
    p_choice: input.choice,
    p_expected_version: input.expectedVersion,
    p_command_id: commandId(),
  })
  throwIfError(error)
  return asSession(data)
}

export async function nextOnlineTruthDareTurn(input: { sessionId: string; expectedVersion: number }) {
  const client = requireClient()
  const { data, error } = await client.rpc('partyplay_truth_dare_next_turn', {
    p_session_id: input.sessionId,
    p_expected_version: input.expectedVersion,
    p_command_id: commandId(),
  })
  throwIfError(error)
  return asSession(data)
}

export async function finishOnlineTruthDare(input: { sessionId: string; expectedVersion: number }) {
  const client = requireClient()
  const { data, error } = await client.rpc('partyplay_finish_truth_dare', {
    p_session_id: input.sessionId,
    p_expected_version: input.expectedVersion,
    p_command_id: commandId(),
  })
  throwIfError(error)
  return asSession(data)
}

export async function sendOnlineTruthDareMessage(input: { sessionId: string; body: string }) {
  const client = requireClient()
  const { data, error } = await client.rpc('partyplay_send_truth_dare_message', {
    p_session_id: input.sessionId,
    p_body: input.body,
  })
  throwIfError(error)
  return data as { id: number; created_at: string }
}

export async function toggleOnlineMessageReaction(input: { messageId: number; reaction: TruthDareReaction }) {
  const client = requireClient()
  const { data, error } = await client.rpc('partyplay_toggle_message_reaction', {
    p_message_id: input.messageId,
    p_reaction: input.reaction,
  })
  throwIfError(error)
  return data as { message_id: number }
}

export async function loadOnlineRoom(roomId: string): Promise<LoadedRoom> {
  const client = requireClient()
  const [{ data: room, error: roomError }, { data: members, error: membersError }, { data: session, error: sessionError }] = await Promise.all([
    client.from('pp_rooms').select('id, invite_code, name, game_type, status, capacity, host_id').eq('id', roomId).single(),
    client.from('pp_room_members').select('user_id, seat_no, role, ready, profile:pp_profiles!pp_room_members_user_id_fkey(display_name, username, avatar_seed)').eq('room_id', roomId).order('seat_no', { ascending: true }),
    client.from('pp_game_sessions').select('id, room_id, status, state, turn_user_id, winner_id, round_no, version').eq('room_id', roomId).maybeSingle(),
  ])

  throwIfError(roomError)
  throwIfError(membersError)
  throwIfError(sessionError)

  const normalizedMembers: PartyPlayRoomMember[] = ((members || []) as unknown as Array<{
    user_id: string
    seat_no: number | null
    role: PartyPlayRoomMember['role']
    ready: boolean
    profile: { display_name: string; username: string; avatar_seed: string } | Array<{ display_name: string; username: string; avatar_seed: string }> | null
  }>).map((member) => {
    const profile = Array.isArray(member.profile) ? member.profile[0] : member.profile
    return {
      userId: member.user_id,
      displayName: profile?.display_name || 'بازیکن جدید',
      username: profile?.username || 'player',
      avatarSeed: profile?.avatar_seed || 'mint',
      role: member.role,
      seatNo: member.seat_no,
      ready: member.ready,
    }
  })

  return { room: asRoom(room), members: normalizedMembers, session: session ? asSession(session) : null }
}

export async function loadOnlineTruthDareMessages(roomId: string, sessionId: string): Promise<PartyPlayRoomMessage[]> {
  const client = requireClient()
  const { data: rows, error } = await client.from('pp_room_messages')
    .select('id, room_id, session_id, round_no, body, created_at, sender:pp_profiles!pp_room_messages_sender_id_fkey(id, display_name, username, avatar_seed)')
    .eq('room_id', roomId).eq('session_id', sessionId).order('created_at', { ascending: true }).limit(120)
  throwIfError(error)
  const messages = (rows || []) as unknown as Array<{
    id: number; room_id: string; session_id: string | null; round_no: number | null; body: string; created_at: string
    sender: { id: string; display_name: string; username: string; avatar_seed: string } | Array<{ id: string; display_name: string; username: string; avatar_seed: string }> | null
  }>
  const ids = messages.map((message) => message.id)
  const { data: reactions, error: reactionsError } = ids.length
    ? await client.from('pp_room_message_reactions').select('message_id, user_id, reaction').in('message_id', ids)
    : { data: [], error: null }
  throwIfError(reactionsError)
  const byMessage = new Map<number, PartyPlayMessageReaction[]>()
  for (const reaction of (reactions || []) as Array<{ message_id: number; user_id: string; reaction: TruthDareReaction }>) {
    byMessage.set(reaction.message_id, [...(byMessage.get(reaction.message_id) || []), { userId: reaction.user_id, reaction: reaction.reaction }])
  }
  return messages.map((message) => {
    const sender = Array.isArray(message.sender) ? message.sender[0] : message.sender
    return {
      id: message.id,
      roomId: message.room_id,
      sessionId: message.session_id,
      roundNo: message.round_no,
      body: message.body,
      createdAt: message.created_at,
      sender: {
        userId: sender?.id || '',
        displayName: sender?.display_name || 'بازیکن جدید',
        username: sender?.username || 'player',
        avatarSeed: sender?.avatar_seed || 'mint',
      },
      reactions: byMessage.get(message.id) || [],
    }
  })
}

export function subscribeToOnlineRoom(roomId: string, onChange: () => void): RealtimeChannel | null {
  if (!supabase) return null
  const channel = supabase.channel(`partyplay-room-${roomId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pp_rooms', filter: `id=eq.${roomId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pp_room_members', filter: `room_id=eq.${roomId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pp_game_sessions', filter: `room_id=eq.${roomId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pp_room_messages', filter: `room_id=eq.${roomId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pp_room_message_reactions' }, onChange)
    .subscribe()
  return channel
}

export function onlineGameType(gameId: 'mafia' | 'tic-tac-toe' | 'truth-dare' | 'snakes'): PartyPlayGameType {
  const types = { mafia: 'mafia', 'tic-tac-toe': 'tic_tac_toe', 'truth-dare': 'truth_or_dare', snakes: 'snakes_ladders' } as const
  return types[gameId]
}
