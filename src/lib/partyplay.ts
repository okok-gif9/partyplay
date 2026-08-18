import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type PartyPlayGameType = 'mafia' | 'tic_tac_toe' | 'truth_or_dare' | 'snakes_ladders'
export type TicTacToeMark = 'X' | 'O'
export type TruthDareChoice = 'truth' | 'dare'
export type TruthDareReaction = '😂' | '🔥' | '👏' | '😮'
export type MafiaRole = 'godfather' | 'mafia' | 'doctor' | 'detective' | 'citizen'
export type MafiaFaction = 'mafia' | 'city'
export type MafiaPhase = 'role_reveal' | 'day_intro' | 'day_speaking' | 'voting' | 'night_intro' | 'mafia_action' | 'doctor_action' | 'detective_action' | 'morning_reveal' | 'finished'
export type MafiaSpeakerMode = 'talking' | 'passed' | null
export type MafiaReaction = 'up' | 'down' | 'challenge'

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
  selected: null | { player_id: string; choice: TruthDareChoice; card_index: number }
  chat_closes_at: string | null
}

export type MafiaState = {
  phase: MafiaPhase
  day_no: number
  alive_player_ids: string[]
  speaker_order: string[]
  speaker_index: number
  speaker_user_id: string | null
  speaker_mode: MafiaSpeakerMode
  speaker_deadline_at: string | null
  voting_deadline_at: string | null
  narration: string
  winner_faction: MafiaFaction | null
}

export type PartyPlaySession = {
  id: string
  room_id: string
  status: 'waiting' | 'running' | 'finished' | 'abandoned'
  state: TicTacToeState | TruthDareState | MafiaState
  turn_user_id: string | null
  winner_id: string | null
  round_no: number
  version: number
}

export type PartyPlayMessageReaction = { userId: string; reaction: TruthDareReaction }
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

export type MafiaPrivateView = {
  self: {
    role: MafiaRole
    faction: MafiaFaction
    is_alive: boolean
    role_acknowledged: boolean
    doctor_self_save_used: boolean
  }
  teammates: Array<{ user_id: string; display_name: string; role: MafiaRole; is_alive: boolean }>
  detective_result: 'citizen' | 'mafia' | 'godfather' | null
}

export type MafiaTeamMessage = { id: number; dayNo: number; senderId: string; body: string; createdAt: string }
export type MafiaSpeakerReactionEvent = { dayNo: number; speakerId: string; reactorId: string; reaction: MafiaReaction }
export type LoadedRoom = { room: PartyPlayRoom; members: PartyPlayRoomMember[]; session: PartyPlaySession | null }

export class PartyPlayError extends Error {
  readonly code: string
  constructor(code: string) { super(roomErrorMessage(code)); this.code = code }
}

const roomErrorMessage = (code: string) => {
  const messages: Record<string, string> = {
    NOT_AUTHENTICATED: 'برای این کار باید وارد حساب خودت شوی.',
    ROOM_NOT_FOUND: 'اتاقی با این لینک پیدا نشد.',
    ROOM_NOT_JOINABLE: 'این اتاق دیگر قابل ورود نیست.',
    ROOM_FULL: 'ظرفیت اتاق کامل شده است.',
    NEED_TWO_PLAYERS: 'برای شروع، دست‌کم دو بازیکن لازم است.',
    NEED_EXACT_CAPACITY: 'اتاق مافیا فقط با ظرفیت کامل ۵، ۷ یا ۹ نفر شروع می‌شود.',
    NOT_HOST: 'فقط میزبان می‌تواند این کار را انجام دهد.',
    NOT_A_MEMBER: 'اجازهٔ دسترسی به این اتاق را نداری.',
    NOT_YOUR_TURN: 'هنوز نوبت تو نیست.',
    NOT_SPEAKER: 'فقط سخنرانِ این نوبت می‌تواند این کار را انجام دهد.',
    SPEAKER_WINDOW_CLOSED: 'زمان صحبت این نوبت تمام شده است.',
    SELF_VOTE: 'گل به خودی میزنی مشتی؟',
    VOTING_NOT_OPEN: 'رأی‌گیری اکنون باز نیست یا زمانش تمام شده است.',
    NIGHT_ACTION_NOT_ALLOWED: 'اکنون زمان اقدام نقش تو نیست.',
    PRIVATE_CHANNEL_FORBIDDEN: 'این گفت‌وگو فقط برای تیم مافیاست.',
    ROLE_NOT_READY: 'هنوز زمان تأیید کارت نقش نیست.',
    INVALID_MOVE: 'این حرکت معتبر نیست.',
    CELL_OCCUPIED: 'این خانه قبلاً پر شده است.',
    CONFLICT: 'وضعیت بازی تغییر کرده؛ صفحه به‌روز شد.',
    GAME_NOT_ACTIVE: 'این بازی فعال نیست.',
    SESSION_NOT_FOUND: 'جلسهٔ بازی پیدا نشد.',
    INVALID_CHOICE: 'این انتخاب معتبر نیست.',
    CHOICE_ALREADY_MADE: 'کارت این دور انتخاب شده است.',
    CARD_NOT_REVEALED: 'ابتدا باید کارت این دور نمایش داده شود.',
    CHAT_LIMIT_REACHED: 'برای این دور، پیام خودت را فرستاده‌ای.',
    CHAT_CLOSED: 'زمان گفت‌وگوی این بازی تمام شده است.',
    INVALID_MESSAGE: 'پیام باید در طول مجاز باشد.',
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
  'NOT_AUTHENTICATED', 'ROOM_NOT_FOUND', 'ROOM_NOT_JOINABLE', 'ROOM_FULL', 'NEED_TWO_PLAYERS', 'NEED_EXACT_CAPACITY',
  'NOT_HOST', 'NOT_A_MEMBER', 'NOT_YOUR_TURN', 'NOT_SPEAKER', 'SPEAKER_WINDOW_CLOSED', 'SELF_VOTE', 'VOTING_NOT_OPEN',
  'NIGHT_ACTION_NOT_ALLOWED', 'PRIVATE_CHANNEL_FORBIDDEN', 'ROLE_NOT_READY', 'INVALID_MOVE', 'CELL_OCCUPIED', 'CONFLICT',
  'GAME_NOT_ACTIVE', 'SESSION_NOT_FOUND', 'INVALID_CHOICE', 'CHOICE_ALREADY_MADE', 'CARD_NOT_REVEALED', 'CHAT_LIMIT_REACHED',
  'CHAT_CLOSED', 'INVALID_MESSAGE', 'INVALID_REACTION', 'MESSAGE_NOT_FOUND', 'SUPABASE_NOT_CONFIGURED',
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

export async function createOnlineRoom(input: { gameType: PartyPlayGameType; name: string; capacity: number }) {
  const client = requireClient()
  const { error: profileError } = await client.rpc('partyplay_ensure_profile', { p_display_name: null })
  throwIfError(profileError)
  const { data, error } = await client.rpc('partyplay_create_room', { p_game_type: input.gameType, p_name: input.name, p_capacity: input.capacity })
  throwIfError(error)
  return asRoom(data)
}

export async function joinOnlineRoom(inviteCode: string) {
  const client = requireClient()
  const { data, error } = await client.rpc('partyplay_join_room', { p_invite_code: inviteCode })
  throwIfError(error)
  return asRoom(data)
}

const rpcSession = async (fn: string, args: Record<string, unknown>) => {
  const client = requireClient()
  const { data, error } = await client.rpc(fn, args)
  throwIfError(error)
  return asSession(data)
}

export const startOnlineTicTacToe = (roomId: string) => rpcSession('partyplay_start_tic_tac_toe', { p_room_id: roomId })
export const makeOnlineTicTacToeMove = (input: { sessionId: string; cell: number; expectedVersion: number }) => rpcSession('partyplay_tic_tac_toe_move', { p_session_id: input.sessionId, p_cell: input.cell, p_expected_version: input.expectedVersion, p_command_id: commandId() })
export const startOnlineTruthDare = (roomId: string) => rpcSession('partyplay_start_truth_dare', { p_room_id: roomId })
export const chooseOnlineTruthDare = (input: { sessionId: string; choice: TruthDareChoice; expectedVersion: number }) => rpcSession('partyplay_truth_dare_choose', { p_session_id: input.sessionId, p_choice: input.choice, p_expected_version: input.expectedVersion, p_command_id: commandId() })
export const nextOnlineTruthDareTurn = (input: { sessionId: string; expectedVersion: number }) => rpcSession('partyplay_truth_dare_next_turn', { p_session_id: input.sessionId, p_expected_version: input.expectedVersion, p_command_id: commandId() })
export const finishOnlineTruthDare = (input: { sessionId: string; expectedVersion: number }) => rpcSession('partyplay_finish_truth_dare', { p_session_id: input.sessionId, p_expected_version: input.expectedVersion, p_command_id: commandId() })

export const startOnlineMafia = (roomId: string) => rpcSession('partyplay_start_mafia', { p_room_id: roomId })
export const acknowledgeOnlineMafiaRole = (input: { sessionId: string; expectedVersion: number }) => rpcSession('partyplay_mafia_ack_role', { p_session_id: input.sessionId, p_expected_version: input.expectedVersion, p_command_id: commandId() })
export const setOnlineMafiaSpeaking = (input: { sessionId: string; mode: Exclude<MafiaSpeakerMode, null>; expectedVersion: number }) => rpcSession('partyplay_mafia_set_speaking', { p_session_id: input.sessionId, p_mode: input.mode, p_expected_version: input.expectedVersion, p_command_id: commandId() })
export const nextOnlineMafiaSpeaker = (input: { sessionId: string; expectedVersion: number }) => rpcSession('partyplay_mafia_next_speaker', { p_session_id: input.sessionId, p_expected_version: input.expectedVersion, p_command_id: commandId() })
export const openOnlineMafiaNight = (input: { sessionId: string; expectedVersion: number }) => rpcSession('partyplay_mafia_open_night', { p_session_id: input.sessionId, p_expected_version: input.expectedVersion, p_command_id: commandId() })
export const resolveOnlineMafiaVote = (input: { sessionId: string; expectedVersion: number }) => rpcSession('partyplay_mafia_resolve_vote', { p_session_id: input.sessionId, p_expected_version: input.expectedVersion, p_command_id: commandId() })
export const advanceOnlineMafiaNight = (input: { sessionId: string; expectedVersion: number }) => rpcSession('partyplay_mafia_advance_night', { p_session_id: input.sessionId, p_expected_version: input.expectedVersion, p_command_id: commandId() })

export async function sendOnlineTruthDareMessage(input: { sessionId: string; body: string }) {
  const client = requireClient()
  const { data, error } = await client.rpc('partyplay_send_truth_dare_message', { p_session_id: input.sessionId, p_body: input.body })
  throwIfError(error)
  return data as { id: number; created_at: string }
}

export async function toggleOnlineMessageReaction(input: { messageId: number; reaction: TruthDareReaction }) {
  const client = requireClient()
  const { data, error } = await client.rpc('partyplay_toggle_message_reaction', { p_message_id: input.messageId, p_reaction: input.reaction })
  throwIfError(error)
  return data as { message_id: number }
}

export async function sendOnlineMafiaDayMessage(input: { sessionId: string; body: string }) {
  const client = requireClient()
  const { data, error } = await client.rpc('partyplay_mafia_send_day_message', { p_session_id: input.sessionId, p_body: input.body })
  throwIfError(error)
  return data as { id: number; created_at: string }
}

export async function reactOnlineMafia(input: { sessionId: string; reaction: MafiaReaction }) {
  const client = requireClient()
  const { data, error } = await client.rpc('partyplay_mafia_react', { p_session_id: input.sessionId, p_reaction: input.reaction })
  throwIfError(error)
  return data as { speaker_id: string }
}

export async function voteOnlineMafia(input: { sessionId: string; choice: 'player' | 'nobody'; targetUserId?: string }) {
  const client = requireClient()
  const { data, error } = await client.rpc('partyplay_mafia_vote', { p_session_id: input.sessionId, p_choice: input.choice, p_target_user_id: input.choice === 'player' ? input.targetUserId || null : null })
  throwIfError(error)
  return data as { day_no: number }
}

export async function sendOnlineMafiaTeamMessage(input: { sessionId: string; body: string }) {
  const client = requireClient()
  const { data, error } = await client.rpc('partyplay_mafia_send_team_message', { p_session_id: input.sessionId, p_body: input.body })
  throwIfError(error)
  return data as { id: number; created_at: string }
}

export const submitOnlineMafiaNightAction = (input: { sessionId: string; targetUserId?: string | null; expectedVersion: number }) => rpcSession('partyplay_mafia_submit_night_action', { p_session_id: input.sessionId, p_target_user_id: input.targetUserId || null, p_expected_version: input.expectedVersion, p_command_id: commandId() })

export async function loadOnlineRoom(roomId: string): Promise<LoadedRoom> {
  const client = requireClient()
  const [{ data: room, error: roomError }, { data: members, error: membersError }, { data: session, error: sessionError }] = await Promise.all([
    client.from('pp_rooms').select('id, invite_code, name, game_type, status, capacity, host_id').eq('id', roomId).single(),
    client.from('pp_room_members').select('user_id, seat_no, role, ready, profile:pp_profiles!pp_room_members_user_id_fkey(display_name, username, avatar_seed)').eq('room_id', roomId).order('seat_no', { ascending: true }),
    client.from('pp_game_sessions').select('id, room_id, status, state, turn_user_id, winner_id, round_no, version').eq('room_id', roomId).maybeSingle(),
  ])
  throwIfError(roomError); throwIfError(membersError); throwIfError(sessionError)
  const normalizedMembers: PartyPlayRoomMember[] = ((members || []) as unknown as Array<{ user_id: string; seat_no: number | null; role: PartyPlayRoomMember['role']; ready: boolean; profile: { display_name: string; username: string; avatar_seed: string } | Array<{ display_name: string; username: string; avatar_seed: string }> | null }>).map((member) => {
    const profile = Array.isArray(member.profile) ? member.profile[0] : member.profile
    return { userId: member.user_id, displayName: profile?.display_name || 'بازیکن جدید', username: profile?.username || 'player', avatarSeed: profile?.avatar_seed || 'mint', role: member.role, seatNo: member.seat_no, ready: member.ready }
  })
  return { room: asRoom(room), members: normalizedMembers, session: session ? asSession(session) : null }
}

export async function loadOnlineSessionMessages(roomId: string, sessionId: string): Promise<PartyPlayRoomMessage[]> {
  const client = requireClient()
  const { data: rows, error } = await client.from('pp_room_messages').select('id, room_id, session_id, round_no, body, created_at, sender:pp_profiles!pp_room_messages_sender_id_fkey(id, display_name, username, avatar_seed)').eq('room_id', roomId).eq('session_id', sessionId).order('created_at', { ascending: true }).limit(160)
  throwIfError(error)
  const messages = (rows || []) as unknown as Array<{ id: number; room_id: string; session_id: string | null; round_no: number | null; body: string; created_at: string; sender: { id: string; display_name: string; username: string; avatar_seed: string } | Array<{ id: string; display_name: string; username: string; avatar_seed: string }> | null }>
  const ids = messages.map((message) => message.id)
  const { data: reactions, error: reactionsError } = ids.length ? await client.from('pp_room_message_reactions').select('message_id, user_id, reaction').in('message_id', ids) : { data: [], error: null }
  throwIfError(reactionsError)
  const byMessage = new Map<number, PartyPlayMessageReaction[]>()
  for (const reaction of (reactions || []) as Array<{ message_id: number; user_id: string; reaction: TruthDareReaction }>) byMessage.set(reaction.message_id, [...(byMessage.get(reaction.message_id) || []), { userId: reaction.user_id, reaction: reaction.reaction }])
  return messages.map((message) => {
    const sender = Array.isArray(message.sender) ? message.sender[0] : message.sender
    return { id: message.id, roomId: message.room_id, sessionId: message.session_id, roundNo: message.round_no, body: message.body, createdAt: message.created_at, sender: { userId: sender?.id || '', displayName: sender?.display_name || 'بازیکن جدید', username: sender?.username || 'player', avatarSeed: sender?.avatar_seed || 'mint' }, reactions: byMessage.get(message.id) || [] }
  })
}

export const loadOnlineTruthDareMessages = loadOnlineSessionMessages

export async function loadOnlineMafiaPrivateView(sessionId: string) {
  const client = requireClient()
  const { data, error } = await client.rpc('partyplay_load_mafia_private_view', { p_session_id: sessionId })
  throwIfError(error)
  return data as MafiaPrivateView
}

export async function loadOnlineMafiaTeamMessages(sessionId: string): Promise<MafiaTeamMessage[]> {
  const client = requireClient()
  const { data, error } = await client.from('pp_mafia_team_messages').select('id, day_no, sender_id, body, created_at').eq('session_id', sessionId).order('created_at', { ascending: true }).limit(80)
  throwIfError(error)
  return ((data || []) as Array<{ id: number; day_no: number; sender_id: string; body: string; created_at: string }>).map((message) => ({ id: message.id, dayNo: message.day_no, senderId: message.sender_id, body: message.body, createdAt: message.created_at }))
}

export async function loadOnlineMafiaSpeakerReactions(sessionId: string): Promise<MafiaSpeakerReactionEvent[]> {
  const client = requireClient()
  const { data, error } = await client.from('pp_mafia_speaker_reactions').select('day_no, speaker_id, reactor_id, reaction').eq('session_id', sessionId).limit(240)
  throwIfError(error)
  return ((data || []) as Array<{ day_no: number; speaker_id: string; reactor_id: string; reaction: MafiaReaction }>).map((reaction) => ({ dayNo: reaction.day_no, speakerId: reaction.speaker_id, reactorId: reaction.reactor_id, reaction: reaction.reaction }))
}

export function subscribeToOnlineRoom(roomId: string, onChange: () => void): RealtimeChannel | null {
  if (!supabase) return null
  return supabase.channel(`partyplay-room-${roomId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pp_rooms', filter: `id=eq.${roomId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pp_room_members', filter: `room_id=eq.${roomId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pp_game_sessions', filter: `room_id=eq.${roomId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pp_room_messages', filter: `room_id=eq.${roomId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pp_room_message_reactions' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pp_mafia_players' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pp_mafia_team_messages' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pp_mafia_speaker_reactions' }, onChange)
    .subscribe()
}

export function onlineGameType(gameId: 'mafia' | 'tic-tac-toe' | 'truth-dare' | 'snakes'): PartyPlayGameType {
  const gameTypes: Record<typeof gameId, PartyPlayGameType> = { mafia: 'mafia', 'tic-tac-toe': 'tic_tac_toe', 'truth-dare': 'truth_or_dare', snakes: 'snakes_ladders' }
  return gameTypes[gameId]
}
