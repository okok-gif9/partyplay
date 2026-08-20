import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type FullPartyPlayGameType = 'spyfall' | 'uno' | 'pictionary' | 'connect_four' | 'backgammon' | 'ludo' | 'codenames' | 'hokm' | 'snakes_ladders'
export type PartyPlayGameType = 'mafia' | 'tic_tac_toe' | 'truth_or_dare' | 'snakes_ladders' | FullPartyPlayGameType
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

export type FullGameState = {
  game: FullPartyPlayGameType
  phase: string
  player_ids: string[]
  turn_index: number
  round_no: number
  narration: string
  [key: string]: unknown
}

export type PartyPlaySession = {
  id: string
  room_id: string
  status: 'waiting' | 'running' | 'finished' | 'abandoned'
  state: TicTacToeState | TruthDareState | MafiaState | FullGameState
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
  revealed_roles?: Array<{ user_id: string; display_name: string; role: MafiaRole; faction: MafiaFaction; is_alive: boolean }>
}

export type AdminSession = {
  is_admin: true
  profile: { id: string; display_name: string; username: string; avatar_seed: string; site_role: 'site_admin'; membership_tier: 'standard' | 'premium'; is_verified: boolean }
}

export type AdminDashboard = {
  stats: { total_users: number; active_users_7d: number; open_rooms: number; live_rooms: number; completed_games: number }
  activity: Array<{ date: string; registrations: number; active_users: number }>
  top_games: Array<{ game_type: PartyPlayGameType; completed_games: number; sessions: number }>
  recent_rooms: Array<{ id: string; name: string; game_type: PartyPlayGameType; status: PartyPlayRoom['status']; capacity: number; invite_code: string; host_display_name: string; created_at: string; is_admin_test: boolean }>
}

export type AdminUserSummary = {
  id: string
  display_name: string
  username: string
  avatar_seed: string
  presence: 'online' | 'away' | 'busy' | 'offline'
  created_at: string
  room_count: number
  completed_games: number
  membership_tier: 'standard' | 'premium'
  premium_until: string | null
  is_verified: boolean
  site_role: 'member' | 'site_admin'
}

export type AdminUserList = { items: AdminUserSummary[]; total: number; limit: number; offset: number }

export type AccountAccessState = 'active' | 'restricted' | 'suspended' | 'pending_deletion'

export type AccountSecurityState = {
  state: AccountAccessState
  restricted_until?: string | null
  purge_after?: string | null
  reason?: string | null
  can_set_password?: boolean
  google_configured?: boolean
}

export type AccountModerationAction = 'restrict' | 'suspend' | 'restore' | 'schedule_delete' | 'purge_now'

export type AccountModerationResult = AccountSecurityState | { state: 'purged'; user_id: string }

export type AdminUserDetail = AdminUserSummary & {
  email: string | null
  last_activity_at: string | null
  account_state?: AccountAccessState
  restricted_until?: string | null
  purge_after?: string | null
  moderation_reason?: string | null
  profile_tagline?: string
}

export type AdminMembershipInput = { userId: string; tier: 'standard' | 'premium'; durationDays?: 30 | 90 | 365 | null; reason: string }
export type AdminMembershipResult = { membership_tier: 'standard' | 'premium'; premium_until: string | null; is_verified: boolean; site_role: 'member' | 'site_admin' }

export type AdminTestRoom = {
  id: string
  invite_code: string
  name: string
  game_type: PartyPlayGameType
  status: PartyPlayRoom['status']
  capacity: number
  member_count?: number
  created_at?: string
}

export type MafiaTeamMessage = { id: number; dayNo: number; senderId: string; body: string; createdAt: string }
export type MafiaSpeakerReactionEvent = { dayNo: number; speakerId: string; reactorId: string; reaction: MafiaReaction }
export type LoadedRoom = { room: PartyPlayRoom; members: PartyPlayRoomMember[]; session: PartyPlaySession | null }

export type ActiveRoomSummary = {
  id: string
  inviteCode: string
  name: string
  gameType: PartyPlayGameType
  status: PartyPlayRoom['status']
  capacity: number
  updatedAt: string
}

export type PartyPlayActivity = {
  id: string
  kind: 'friend_request' | 'friend_accepted' | 'group_added' | 'room_invite' | 'game_finished' | 'achievement' | 'report_update'
  title: string
  body: string
  payload: Record<string, unknown>
  createdAt: string
  readAt: string | null
  actor: { id: string; username: string; displayName: string; avatarSeed: string } | null
}

export type PlayerAchievement = {
  code: 'first_game' | 'first_friend' | 'mafia_host' | 'mafia_regular'
  title: string
  description: string
  icon: string
  accent: 'cyan' | 'gold' | 'lime' | 'pink'
  earnedAt: string
}

export type PlayerProgress = {
  gamesPlayed: number
  finishedGames: number
  mafiaGames: number
  hostedRooms: number
  friendsCount: number
  groupsCount: number
  weekActiveDays: number
  lastGameAt: string | null
  achievements: PlayerAchievement[]
}

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
    INVALID_GAME: 'این بازی در دسترس نیست.',
    INVALID_CAPACITY: 'این تعداد بازیکن برای بازی انتخاب‌شده معتبر نیست.',
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
    NOT_ADMIN: 'اجازهٔ دسترسی به پنل مدیریت را نداری.',
    INVALID_QUERY: 'عبارت جست‌وجو معتبر نیست.',
    USER_NOT_FOUND: 'کاربر موردنظر پیدا نشد.',
    ROOM_NOT_CANCELLABLE: 'فقط اتاق تستی که هنوز شروع نشده قابل لغو است.',
    ACCOUNT_RESTRICTED: 'این حساب موقتاً برای فعالیت در پارتی پلی محدود شده است.',
    ACCOUNT_SUSPENDED: 'این حساب برای استفاده از پارتی پلی تعلیق شده است.',
    ACCOUNT_PENDING_DELETION: 'حذف این حساب در انتظار بازیابی یا پاک‌سازی نهایی است.',
    DELETE_CONFIRMATION_REQUIRED: 'برای تأیید این عمل، عبارت خواسته‌شده را دقیق وارد کن.',
    CANNOT_MODERATE_SELF: 'نمی‌توانی روی حساب مدیر فعلی اقدام مدیریتی انجام دهی.',
    MODERATION_REASON_REQUIRED: 'دلیل اقدام باید دست‌کم ۸ نویسه داشته باشد.',
    INVALID_RESTRICTION_DURATION: 'مدت محدودیت انتخاب‌شده معتبر نیست.',
    INVALID_MODERATION_ACTION: 'اقدام مدیریتی انتخاب‌شده معتبر نیست.',
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
  'NIGHT_ACTION_NOT_ALLOWED', 'PRIVATE_CHANNEL_FORBIDDEN', 'ROLE_NOT_READY', 'INVALID_GAME', 'INVALID_CAPACITY', 'INVALID_MOVE', 'CELL_OCCUPIED', 'CONFLICT',
  'GAME_NOT_ACTIVE', 'SESSION_NOT_FOUND', 'INVALID_CHOICE', 'CHOICE_ALREADY_MADE', 'CARD_NOT_REVEALED', 'CHAT_LIMIT_REACHED',
  'CHAT_CLOSED', 'INVALID_MESSAGE', 'INVALID_REACTION', 'MESSAGE_NOT_FOUND', 'SUPABASE_NOT_CONFIGURED',
  'NOT_ADMIN', 'INVALID_QUERY', 'USER_NOT_FOUND', 'ROOM_NOT_CANCELLABLE',
  'ACCOUNT_RESTRICTED', 'ACCOUNT_SUSPENDED', 'ACCOUNT_PENDING_DELETION', 'DELETE_CONFIRMATION_REQUIRED',
      'CANNOT_MODERATE_SELF', 'MODERATION_REASON_REQUIRED', 'INVALID_RESTRICTION_DURATION', 'INVALID_MODERATION_ACTION',
    'PREMIUM_FEATURE_REQUIRED', 'INVALID_MEMBERSHIP_TIER', 'INVALID_PREMIUM_DURATION',

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
export const startOnlineFullGame = (roomId: string) => rpcSession('partyplay_start_full_game', { p_room_id: roomId })
export const applyOnlineFullGameState = (input: { sessionId: string; state: FullGameState; turnUserId: string | null; status: 'running' | 'finished'; expectedVersion: number; eventType?: string }) => rpcSession('partyplay_apply_full_game_state', { p_session_id: input.sessionId, p_state: input.state, p_turn_user_id: input.turnUserId, p_status: input.status, p_expected_version: input.expectedVersion, p_command_id: commandId(), p_event_type: input.eventType || 'game_command' })
export async function loadOnlinePrivateGameState(sessionId: string) { const client = requireClient(); const { data, error } = await client.rpc('partyplay_load_private_game_state', { p_session_id: sessionId }); throwIfError(error); return (data || {}) as Record<string, unknown> }
export async function saveOnlinePrivateGameState(sessionId: string, state: Record<string, unknown>) { const client = requireClient(); const { data, error } = await client.rpc('partyplay_save_private_game_state', { p_session_id: sessionId, p_state: state }); throwIfError(error); return (data || {}) as Record<string, unknown> }
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

export async function loadMyActiveRooms(limit = 3): Promise<ActiveRoomSummary[]> {
  const client = requireClient()
  const { data: authData, error: authError } = await client.auth.getUser()
  throwIfError(authError)
  if (!authData.user) throw new PartyPlayError('NOT_AUTHENTICATED')
  const { data, error } = await client
    .from('pp_room_members')
    .select('joined_at, room:pp_rooms!pp_room_members_room_id_fkey(id, invite_code, name, game_type, status, capacity, updated_at)')
    .eq('user_id', authData.user.id)
    .in('room.status', ['lobby', 'playing'])
    .order('joined_at', { ascending: false })
    .limit(Math.max(1, Math.min(limit, 6)))
  throwIfError(error)
  return ((data || []) as Array<{ room: { id: string; invite_code: string; name: string; game_type: PartyPlayGameType; status: PartyPlayRoom['status']; capacity: number; updated_at: string } | Array<{ id: string; invite_code: string; name: string; game_type: PartyPlayGameType; status: PartyPlayRoom['status']; capacity: number; updated_at: string }> | null }>).flatMap((row) => {
    const room = Array.isArray(row.room) ? row.room[0] : row.room
    return room ? [{ id: room.id, inviteCode: room.invite_code, name: room.name, gameType: room.game_type, status: room.status, capacity: room.capacity, updatedAt: room.updated_at }] : []
  })
}

export async function loadActivityFeed(limit = 30): Promise<PartyPlayActivity[]> {
  const client = requireClient()
  const { data, error } = await client.rpc('partyplay_activity_feed', { p_limit: Math.max(1, Math.min(limit, 60)) })
  throwIfError(error)
  return ((data || []) as Array<{ id: string; kind: PartyPlayActivity['kind']; title: string; body: string; payload?: Record<string, unknown>; created_at: string; read_at: string | null; actor: { id: string; username: string; display_name: string; avatar_seed: string } | null }>).map((event) => ({
    id: event.id,
    kind: event.kind,
    title: event.title,
    body: event.body,
    payload: event.payload || {},
    createdAt: event.created_at,
    readAt: event.read_at,
    actor: event.actor ? { id: event.actor.id, username: event.actor.username, displayName: event.actor.display_name, avatarSeed: event.actor.avatar_seed } : null,
  }))
}

export async function loadPlayerProgress(): Promise<PlayerProgress> {
  const client = requireClient()
  const { data, error } = await client.rpc('partyplay_player_progress')
  throwIfError(error)
  const value = (data || {}) as { games_played?: number; finished_games?: number; mafia_games?: number; hosted_rooms?: number; friends_count?: number; groups_count?: number; week_active_days?: number; last_game_at?: string | null; achievements?: Array<{ code: PlayerAchievement['code']; title: string; description: string; icon: string; accent: PlayerAchievement['accent']; earned_at: string }> }
  return {
    gamesPlayed: Number(value.games_played || 0),
    finishedGames: Number(value.finished_games || 0),
    mafiaGames: Number(value.mafia_games || 0),
    hostedRooms: Number(value.hosted_rooms || 0),
    friendsCount: Number(value.friends_count || 0),
    groupsCount: Number(value.groups_count || 0),
    weekActiveDays: Number(value.week_active_days || 0),
    lastGameAt: value.last_game_at || null,
    achievements: (value.achievements || []).map((item) => ({ code: item.code, title: item.title, description: item.description, icon: item.icon, accent: item.accent, earnedAt: item.earned_at })),
  }
}

export async function markActivityRead(ids?: string[]) {
  const client = requireClient()
  const { data, error } = await client.rpc('partyplay_mark_activity_read', { p_ids: ids?.length ? ids : null })
  throwIfError(error)
  return Number(data || 0)
}

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

export async function getAccountSecurityState() { const client = requireClient(); const { data, error } = await client.rpc('partyplay_account_security_state'); throwIfError(error); return data as AccountSecurityState }
export async function restoreAccountAfterSignIn() { const client = requireClient(); const { data, error } = await client.rpc('partyplay_restore_account_after_sign_in'); throwIfError(error); return data as AccountSecurityState }
export async function requestAccountDeletion(confirmation: string) { const client = requireClient(); const { data, error } = await client.rpc('partyplay_request_account_deletion', { p_confirmation: confirmation }); throwIfError(error); return data as AccountSecurityState }
export async function requireProductAccess() { const client = requireClient(); const { error } = await client.rpc('partyplay_require_product_access'); throwIfError(error) }
export async function adminModerateAccount(input: { userId: string; action: AccountModerationAction; reason: string; durationHours?: 24 | 168 | 720 | null; confirmUsername?: string }) { const client = requireClient(); const { data, error } = await client.rpc('partyplay_admin_moderate_account', { p_user_id: input.userId, p_action: input.action, p_reason: input.reason, p_duration_hours: input.durationHours ?? null, p_confirm_username: input.confirmUsername ?? null }); throwIfError(error); return data as AccountModerationResult }

export async function adminSetMembership(input: AdminMembershipInput) { const client = requireClient(); const { data, error } = await client.rpc('partyplay_admin_set_membership', { p_user_id: input.userId, p_tier: input.tier, p_duration_days: input.durationDays ?? null, p_reason: input.reason }); throwIfError(error); return data as AdminMembershipResult }
export async function loadAdminSession() { const client = requireClient(); const { data, error } = await client.rpc('partyplay_admin_session'); throwIfError(error); return data as AdminSession }
export async function loadAdminDashboard() { const client = requireClient(); const { data, error } = await client.rpc('partyplay_admin_dashboard'); throwIfError(error); return data as AdminDashboard }
export async function loadAdminUsers(query = '', limit = 25, offset = 0) { const client = requireClient(); const { data, error } = await client.rpc('partyplay_admin_users', { p_query: query || null, p_limit: limit, p_offset: offset }); throwIfError(error); return data as AdminUserList }
export async function loadAdminUserDetail(userId: string) { const client = requireClient(); const { data, error } = await client.rpc('partyplay_admin_user_detail', { p_user_id: userId }); throwIfError(error); return data as AdminUserDetail }
export async function createAdminTestRoom(input: { gameType: PartyPlayGameType; name?: string; capacity: number }) { const client = requireClient(); const { data, error } = await client.rpc('partyplay_admin_create_test_room', { p_game_type: input.gameType, p_name: input.name || null, p_capacity: input.capacity }); throwIfError(error); return data as AdminTestRoom }
export async function loadAdminTestRooms() { const client = requireClient(); const { data, error } = await client.rpc('partyplay_admin_list_test_rooms'); throwIfError(error); return (data || []) as AdminTestRoom[] }
export async function cancelAdminTestRoom(roomId: string) { const client = requireClient(); const { data, error } = await client.rpc('partyplay_admin_cancel_test_room', { p_room_id: roomId }); throwIfError(error); return data as { id: string; status: 'cancelled' } }

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
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pp_game_private_state' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pp_game_command_log' }, onChange)
    .subscribe()
}

export function onlineGameType(gameId: 'mafia' | 'tic-tac-toe' | 'truth-dare' | 'snakes'): PartyPlayGameType {
  const gameTypes: Record<typeof gameId, PartyPlayGameType> = { mafia: 'mafia', 'tic-tac-toe': 'tic_tac_toe', 'truth-dare': 'truth_or_dare', snakes: 'snakes_ladders' }
  return gameTypes[gameId]
}
