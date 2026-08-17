import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type PartyPlayGameType = 'mafia' | 'tic_tac_toe' | 'truth_or_dare' | 'snakes_ladders'
export type TicTacToeMark = 'X' | 'O'

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

export type PartyPlaySession = {
  id: string
  room_id: string
  status: 'waiting' | 'running' | 'finished' | 'abandoned'
  state: TicTacToeState
  turn_user_id: string | null
  winner_id: string | null
  version: number
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
    NEED_TWO_PLAYERS: 'دوز فقط با دو بازیکن شروع می‌شود.',
    NOT_HOST: 'فقط میزبان می‌تواند بازی را شروع کند.',
    NOT_A_MEMBER: 'اجازهٔ دسترسی به این اتاق را نداری.',
    NOT_YOUR_TURN: 'هنوز نوبت تو نیست.',
    INVALID_MOVE: 'این حرکت معتبر نیست.',
    CELL_OCCUPIED: 'این خانه قبلاً پر شده است.',
    CONFLICT: 'وضعیت بازی تغییر کرده؛ صفحه به‌روز شد.',
    GAME_NOT_ACTIVE: 'این بازی فعال نیست.',
    SESSION_NOT_FOUND: 'جلسهٔ بازی پیدا نشد.',
  }
  return messages[code] || 'ارتباط با بازی کامل نشد. دوباره تلاش کن.'
}

const requireClient = () => {
  if (!supabase) throw new PartyPlayError('SUPABASE_NOT_CONFIGURED')
  return supabase
}

const throwIfError = (error: { message?: string } | null) => {
  if (!error) return
  const message = error.message || 'UNKNOWN'
  const knownCode = Object.keys({
    NOT_AUTHENTICATED: true,
    ROOM_NOT_FOUND: true,
    ROOM_NOT_JOINABLE: true,
    ROOM_FULL: true,
    NEED_TWO_PLAYERS: true,
    NOT_HOST: true,
    NOT_A_MEMBER: true,
    NOT_YOUR_TURN: true,
    INVALID_MOVE: true,
    CELL_OCCUPIED: true,
    CONFLICT: true,
    GAME_NOT_ACTIVE: true,
    SESSION_NOT_FOUND: true,
  }).find((code) => message.includes(code))
  throw new PartyPlayError(knownCode || message)
}

const asRoom = (value: unknown) => value as PartyPlayRoom
const asSession = (value: unknown) => value as PartyPlaySession

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
  const { data, error } = await client.rpc('partyplay_join_room', {
    p_invite_code: inviteCode,
  })
  throwIfError(error)
  return asRoom(data)
}

export async function startOnlineTicTacToe(roomId: string) {
  const client = requireClient()
  const { data, error } = await client.rpc('partyplay_start_tic_tac_toe', {
    p_room_id: roomId,
  })
  throwIfError(error)
  return asSession(data)
}

export async function makeOnlineTicTacToeMove(input: {
  sessionId: string
  cell: number
  expectedVersion: number
}) {
  const client = requireClient()
  const commandId = typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`
  const { data, error } = await client.rpc('partyplay_tic_tac_toe_move', {
    p_session_id: input.sessionId,
    p_cell: input.cell,
    p_expected_version: input.expectedVersion,
    p_command_id: commandId,
  })
  throwIfError(error)
  return asSession(data)
}

export async function loadOnlineRoom(roomId: string): Promise<LoadedRoom> {
  const client = requireClient()
  const [{ data: room, error: roomError }, { data: members, error: membersError }, { data: session, error: sessionError }] = await Promise.all([
    client.from('pp_rooms').select('id, invite_code, name, game_type, status, capacity, host_id').eq('id', roomId).single(),
    client.from('pp_room_members').select('user_id, seat_no, role, ready, profile:pp_profiles!pp_room_members_user_id_fkey(display_name, username, avatar_seed)').eq('room_id', roomId).order('seat_no', { ascending: true }),
    client.from('pp_game_sessions').select('id, room_id, status, state, turn_user_id, winner_id, version').eq('room_id', roomId).maybeSingle(),
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
      displayName: profile?.display_name || 'بازیکن',
      username: profile?.username || 'player',
      avatarSeed: profile?.avatar_seed || 'spark',
      role: member.role,
      seatNo: member.seat_no,
      ready: member.ready,
    }
  })

  return {
    room: asRoom(room),
    members: normalizedMembers,
    session: session ? asSession(session) : null,
  }
}

export function subscribeToOnlineRoom(roomId: string, onChange: () => void): RealtimeChannel | null {
  if (!supabase) return null
  const channel = supabase.channel(`partyplay-room-${roomId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pp_rooms', filter: `id=eq.${roomId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pp_room_members', filter: `room_id=eq.${roomId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pp_game_sessions', filter: `room_id=eq.${roomId}` }, onChange)
    .subscribe()
  return channel
}

export function onlineGameType(gameId: 'mafia' | 'tic-tac-toe' | 'truth-dare' | 'snakes'): PartyPlayGameType {
  const types = {
    mafia: 'mafia',
    'tic-tac-toe': 'tic_tac_toe',
    'truth-dare': 'truth_or_dare',
    snakes: 'snakes_ladders',
  } as const
  return types[gameId]
}
