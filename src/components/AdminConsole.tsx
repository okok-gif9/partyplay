import { useState } from 'react'
import {
  Activity, AlertTriangle, ArrowLeft, Ban, BarChart3, ChevronLeft, CircleStop, Clock3, Copy, Database, Gamepad2,
  LockKeyhole, Radio, RefreshCw, Rocket, RotateCcw, Search, ShieldCheck, Trash2, Trophy, UserCheck, UserRound, UsersRound,
} from 'lucide-react'
import { IdentityLabel, PlayerAvatar } from './SocialIdentity'
import { gameById, gameCatalog, type PartyGameId } from '../data/gameCatalog'
import type { AccountModerationAction, AdminTestRoom, AdminUserDetail, PartyPlayGameType } from '../lib/partyplay'
import { useAdminConsole } from '../hooks/useAdminConsole'
import { useLanguage } from '../i18n'

type ConsoleTab = 'overview' | 'users' | 'launch' | 'rooms'

type AdminConsoleProps = {
  onBack: () => void
  onOpenPractice: (game: PartyGameId) => void
  onEnterRoom: (room: AdminTestRoom) => void
  notify: (message: string) => void
}

type LaunchOption = { gameId: PartyGameId; gameType: PartyPlayGameType; capacities: number[] }

const launchOptions: LaunchOption[] = [
  { gameId: 'mafia', gameType: 'mafia', capacities: [5, 7, 9] },
  { gameId: 'tic-tac-toe', gameType: 'tic_tac_toe', capacities: [2] },
  { gameId: 'spyfall', gameType: 'spyfall', capacities: [3, 4, 5, 6, 7, 8] },
  { gameId: 'uno', gameType: 'uno', capacities: [2, 3, 4] },
  { gameId: 'backgammon', gameType: 'backgammon', capacities: [2] },
  { gameId: 'ludo', gameType: 'ludo', capacities: [2, 3, 4] },
  { gameId: 'codenames', gameType: 'codenames', capacities: [4, 5, 6, 7, 8] },
]

const roomState = (status: string, fa: boolean) => {
  const states: Record<string, [string, string]> = {
    lobby: ['در انتظار', 'Lobby'], playing: ['در حال بازی', 'Playing'], finished: ['پایان‌یافته', 'Finished'], cancelled: ['لغوشده', 'Cancelled'],
  }
  return (states[status] || [status, status])[fa ? 0 : 1]
}

const dateLabel = (value?: string | null, fa = true) => {
  if (!value) return '—'
  return new Intl.DateTimeFormat(fa ? 'fa-IR' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export default function AdminConsole({ onBack, onOpenPractice, onEnterRoom, notify }: AdminConsoleProps) {
  const { language } = useLanguage()
  const fa = language === 'fa'
  const copy = fa ? {
    eyebrow: 'مرکز فرمان', title: 'مدیریت PartyPlay', subtitle: 'نمای زندهٔ پلتفرم، کاربران و اتاق‌های تست شما.',
    refresh: 'به‌روزرسانی', overview: 'نمای کلی', users: 'کاربران', launch: 'اجرای سریع', rooms: 'اتاق‌های من',
    totalUsers: 'کل کاربران', activeUsers: 'فعال در ۷ روز', openRooms: 'اتاق‌های باز', liveRooms: 'بازی‌های زنده', completed: 'بازی‌های تمام‌شده',
    activity: 'نبض هفت‌روزه', registrations: 'ثبت‌نام', active: 'فعال', topGames: 'بازی‌های محبوب', recent: 'اتاق‌های اخیر',
    userDirectory: 'فهرست کاربران', searchHint: 'نام نمایشی یا @شناسه', search: 'جست‌وجو', members: 'عضو', roomsMade: 'اتاق', gamesDone: 'بازی کامل',
    userDetail: 'جزئیات کاربر', joined: 'تاریخ عضویت', lastActivity: 'آخرین فعالیت', email: 'ایمیل', close: 'بستن',
    quickLaunch: 'اجرای فوری', quickDesc: 'برای یک بازی آنلاین، اتاق تست واقعی بساز و مستقیماً وارد لابی شو.',
    onlineTable: 'بازی‌های آنلاین', soloTable: 'اجرای تک‌نفره', roomName: 'نام اتاق', roomNameHint: 'مثلاً تست امشب', capacity: 'ظرفیت', create: 'ساخت اتاق تست',
    launchNote: 'اتاق‌ها واقعی‌اند؛ بازی‌های آنلاین برای شروع به تعداد بازیکن معتبر نیاز دارند.', playNow: 'شروع مستقیم',
    myRooms: 'اتاق‌های تست من', noRooms: 'هنوز اتاق تستی نساخته‌ای.', enter: 'ورود به لابی', copyLink: 'کپی لینک', cancel: 'لغو اتاق',
    secure: 'داده‌ها فقط از توابع مدیریت‌شدهٔ Supabase بارگذاری می‌شوند.', unauthorized: 'این حساب اجازهٔ ورود به مرکز فرمان را ندارد.',
    tryAgain: 'تلاش دوباره', back: 'بازگشت به آرکید', dataLive: 'دادهٔ زنده', noUsers: 'هنوز کاربری برای نمایش نیست.',
    moderation: 'مدیریت تخلف', moderationDescription: 'هر اقدام با دلیل در گزارش غیرقابل‌ویرایش ثبت می‌شود.', accountState: 'وضعیت حساب', accountActive: 'فعال', restricted: 'محدود', suspended: 'تعلیق‌شده', pendingDeletion: 'حذف در انتظار',
    reason: 'دلیل اقدام', reasonHint: 'حداقل ۸ نویسه، برای گزارش مدیریتی.', duration: 'مدت محدودیت', permanent: 'بدون پایان', restrict: 'محدودسازی', suspend: 'تعلیق حساب', restore: 'بازگردانی', scheduleDelete: 'حذف با مهلت ۳۰روزه', purgeNow: 'پاک‌سازی فوری',
    typedConfirmation: 'برای حذف، شناسهٔ کاربر را دقیق وارد کن', applyAction: 'ثبت اقدام', restrictionUntil: 'تا', purgeAfter: 'پاک‌سازی پس از', recordedReason: 'دلیل ثبت‌شده', actionApplied: 'اقدام مدیریتی ثبت و وضعیت کاربر به‌روز شد.', userPurged: 'حساب کاربر به‌طور دائم پاک‌سازی شد.', premium: 'کاربر ویژه', premiumDescription: 'نشان تأیید، آواتارهای انحصاری و عنوان کوتاه ویژه؛ فقط توسط مدیر فعال می‌شود.', premiumActive: 'ویژه فعال', premiumStandard: 'کاربر عادی', grantPremium: 'فعال‌سازی ویژه', revokePremium: 'لغو ویژه', premiumDuration: 'مدت ویژه‌بودن', membershipUpdated: 'سطح ویژهٔ کاربر به‌روز شد.',
  } : {
    eyebrow: 'COMMAND CENTER', title: 'PartyPlay control room', subtitle: 'Live platform signals, people, and your test rooms.',
    refresh: 'Refresh', overview: 'Overview', users: 'Users', launch: 'Quick launch', rooms: 'My rooms',
    totalUsers: 'Total users', activeUsers: 'Active in 7 days', openRooms: 'Open rooms', liveRooms: 'Live games', completed: 'Completed games',
    activity: 'Seven-day pulse', registrations: 'Sign-ups', active: 'Active', topGames: 'Top games', recent: 'Recent rooms',
    userDirectory: 'User directory', searchHint: 'Display name or @handle', search: 'Search', members: 'users', roomsMade: 'rooms', gamesDone: 'completed',
    userDetail: 'User details', joined: 'Joined', lastActivity: 'Last activity', email: 'Email', close: 'Close',
    quickLaunch: 'Quick launch', quickDesc: 'Create a real online test room and enter its lobby directly.',
    onlineTable: 'Online games', soloTable: 'Solo launch', roomName: 'Room name', roomNameHint: 'e.g. Tonight test', capacity: 'Capacity', create: 'Create test room',
    launchNote: 'Rooms are real; online games require a valid player count before they can start.', playNow: 'Play now',
    myRooms: 'My test rooms', noRooms: 'No test room has been created yet.', enter: 'Open lobby', copyLink: 'Copy link', cancel: 'Cancel room',
    secure: 'Data is loaded only through controlled Supabase functions.', unauthorized: 'This account is not allowed to open the command center.',
    tryAgain: 'Try again', back: 'Back to arcade', dataLive: 'Live data', noUsers: 'No user is available yet.',
    moderation: 'Moderation', moderationDescription: 'Every action is recorded with a reason in the immutable account audit trail.', accountState: 'Account state', accountActive: 'Active', restricted: 'Restricted', suspended: 'Suspended', pendingDeletion: 'Deletion pending',
    reason: 'Action reason', reasonHint: 'At least 8 characters, recorded for administrators.', duration: 'Restriction duration', permanent: 'No expiry', restrict: 'Restrict', suspend: 'Suspend account', restore: 'Restore', scheduleDelete: 'Schedule 30-day deletion', purgeNow: 'Purge now',
    typedConfirmation: 'For deletion, type the user handle exactly', applyAction: 'Apply action', restrictionUntil: 'Until', purgeAfter: 'Purge after', recordedReason: 'Recorded reason', actionApplied: 'Moderation action recorded and user state refreshed.', userPurged: 'The user account was permanently purged.', premium: 'Premium member', premiumDescription: 'Verified badge, exclusive avatars, and a short profile title. Admin-controlled only.', premiumActive: 'Premium active', premiumStandard: 'Standard member', grantPremium: 'Grant premium', revokePremium: 'Revoke premium', premiumDuration: 'Premium duration', membershipUpdated: 'Membership updated.',
  }

  const admin = useAdminConsole()
  const [tab, setTab] = useState<ConsoleTab>('overview')
  const [query, setQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [selectedLaunch, setSelectedLaunch] = useState<LaunchOption>(launchOptions[0])
  const [capacity, setCapacity] = useState(launchOptions[0].capacities[0])
  const [roomName, setRoomName] = useState('')
  const [moderationAction, setModerationAction] = useState<AccountModerationAction>('restrict')
  const [moderationReason, setModerationReason] = useState('')
  const [restrictionDuration, setRestrictionDuration] = useState<24 | 168 | 720 | 'permanent'>(24)
  const [moderationConfirmation, setModerationConfirmation] = useState('')
  const [membershipReason, setMembershipReason] = useState('')
  const [premiumDuration, setPremiumDuration] = useState<30 | 90 | 365 | 'permanent'>(30)

  const maxActivity = Math.max(1, ...(admin.dashboard?.activity.map((day) => Math.max(day.registrations, day.active_users)) || [1]))
  const selectLaunch = (option: LaunchOption) => { setSelectedLaunch(option); setCapacity(option.capacities[0]) }

  const showUser = async (userId: string) => {
    setDetailLoading(true)
    setModerationAction('restrict')
    setModerationReason('')
    setModerationConfirmation('')
    setMembershipReason('')
    setPremiumDuration(30)
    try { setSelectedUser(await admin.loadUser(userId)) }
    catch (cause) { notify(cause instanceof Error ? cause.message : 'User details could not be loaded.') }
    finally { setDetailLoading(false) }
  }

  const createRoom = async () => {
    try {
      const room = await admin.createTestRoom({ gameType: selectedLaunch.gameType, name: roomName.trim() || undefined, capacity })
      notify(fa ? 'اتاق تست واقعی ساخته شد؛ وارد لابی می‌شوی.' : 'Real test room created; entering lobby.')
      onEnterRoom(room)
    } catch (cause) { notify(cause instanceof Error ? cause.message : 'Test room could not be created.') }
  }

  const copyInvite = async (room: AdminTestRoom) => {
    const link = `${window.location.origin}${window.location.pathname}?room=${room.invite_code}`
    try { await navigator.clipboard?.writeText(link); notify(fa ? 'لینک دعوت کپی شد.' : 'Invite link copied.') }
    catch { notify(link) }
  }

  const cancelRoom = async (room: AdminTestRoom) => {
    try { await admin.cancelTestRoom(room.id); notify(fa ? 'اتاق تست لغو شد.' : 'Test room cancelled.') }
    catch (cause) { notify(cause instanceof Error ? cause.message : 'Room could not be cancelled.') }
  }

  const accountStateLabel = (state?: string) => state === 'restricted' ? copy.restricted : state === 'suspended' ? copy.suspended : state === 'pending_deletion' ? copy.pendingDeletion : copy.accountActive
  const actionLabel = (action: AccountModerationAction) => action === 'restrict' ? copy.restrict : action === 'suspend' ? copy.suspend : action === 'restore' ? copy.restore : action === 'schedule_delete' ? copy.scheduleDelete : copy.purgeNow

  const applyModeration = async () => {
    if (!selectedUser) return
    if (moderationReason.trim().length < 8) {
      notify(copy.reasonHint)
      return
    }
    const needsUsername = moderationAction === 'schedule_delete' || moderationAction === 'purge_now'
    if (needsUsername && moderationConfirmation.trim().toLowerCase() !== selectedUser.username.toLowerCase()) {
      notify(copy.typedConfirmation)
      return
    }
    try {
      const detail = await admin.moderateAccount({
        userId: selectedUser.id,
        action: moderationAction,
        reason: moderationReason.trim(),
        durationHours: moderationAction === 'restrict' ? (restrictionDuration === 'permanent' ? null : restrictionDuration) : null,
        confirmUsername: needsUsername ? moderationConfirmation.trim() : undefined,
      })
      setModerationReason('')
      setModerationConfirmation('')
      if (detail) {
        setSelectedUser(detail)
        notify(copy.actionApplied)
      } else {
        setSelectedUser(null)
        notify(copy.userPurged)
      }
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Moderation action could not be applied.')
    }
  }

  const applyMembership = async (tier: 'standard' | 'premium') => {
    if (!selectedUser) return
    if (membershipReason.trim().length < 8) { notify(copy.reasonHint); return }
    try {
      const detail = await admin.setMembership({ userId: selectedUser.id, tier, durationDays: tier === 'premium' ? (premiumDuration === 'permanent' ? null : premiumDuration) : null, reason: membershipReason.trim() })
      setSelectedUser(detail)
      setMembershipReason('')
      notify(copy.membershipUpdated)
    } catch (cause) { notify(cause instanceof Error ? cause.message : 'Membership could not be updated.') }
  }

  if (admin.loading && !admin.session && !admin.error) return <section className="admin-loading"><span className="admin-orb"/><p>{fa ? 'در حال باز کردن مرکز فرمان…' : 'Opening command center…'}</p></section>
  if (!admin.session) return <section className="admin-denied"><div className="admin-denied-mark"><LockKeyhole size={30}/></div><span className="eyebrow">PRIVATE AREA</span><h1>{copy.unauthorized}</h1><p>{admin.error || copy.secure}</p><div><button className="secondary-button" onClick={() => void admin.refresh()}><RefreshCw size={16}/>{copy.tryAgain}</button><button className="primary-button" onClick={onBack}><ArrowLeft size={16}/>{copy.back}</button></div></section>

  const metricCards = [
    { label: copy.totalUsers, value: admin.dashboard?.stats.total_users || 0, icon: UsersRound, tone: 'cyan' },
    { label: copy.activeUsers, value: admin.dashboard?.stats.active_users_7d || 0, icon: Activity, tone: 'lime' },
    { label: copy.openRooms, value: admin.dashboard?.stats.open_rooms || 0, icon: Radio, tone: 'violet' },
    { label: copy.liveRooms, value: admin.dashboard?.stats.live_rooms || 0, icon: Rocket, tone: 'pink' },
    { label: copy.completed, value: admin.dashboard?.stats.completed_games || 0, icon: Trophy, tone: 'gold' },
  ]

  return <section className="admin-console" dir={fa ? 'rtl' : 'ltr'}>
    <header className="admin-command-header">
      <div className="admin-command-title"><button className="back-link" onClick={onBack}><ChevronLeft size={17}/>{copy.back}</button><span className="eyebrow"><ShieldCheck size={14}/>{copy.eyebrow}</span><h1>{copy.title}</h1><p>{copy.subtitle}</p></div>
      <div className="admin-command-actions"><span className="admin-live"><i/>{copy.dataLive}</span><button className="secondary-button" onClick={() => void admin.refresh()} disabled={admin.loading || admin.busy}><RefreshCw size={16}/>{copy.refresh}</button></div>
    </header>

    <div className="admin-console-layout">
      <nav className="admin-console-nav" aria-label={copy.eyebrow}>
        {([
          ['overview', BarChart3, copy.overview], ['users', UsersRound, copy.users], ['launch', Rocket, copy.launch], ['rooms', Database, copy.rooms],
        ] as Array<[ConsoleTab, typeof BarChart3, string]>).map(([id, Icon, label]) => <button key={id} className={tab === id ? 'admin-nav-active' : ''} onClick={() => setTab(id)}><Icon size={18}/><span>{label}</span></button>)}
        <p><LockKeyhole size={14}/>{copy.secure}</p>
      </nav>

      <div className="admin-console-body">
        {tab === 'overview' && <>
          <div className="admin-metrics">{metricCards.map(({ label, value, icon: Icon, tone }) => <article className={`admin-metric metric-${tone}`} key={label}><span><Icon size={18}/></span><div><small>{label}</small><strong>{new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US').format(value)}</strong></div></article>)}</div>
          <div className="admin-data-grid overview-grid">
            <article className="admin-panel admin-activity-panel"><div className="admin-panel-heading"><div><span className="eyebrow"><Activity size={14}/>{copy.activity}</span><h2>{fa ? 'رشد و فعالیت روزانه' : 'Daily growth & activity'}</h2></div><span className="admin-panel-tag">7D</span></div><div className="admin-chart" aria-label={copy.activity}>{(admin.dashboard?.activity || []).map((day) => <div className="admin-chart-day" key={day.date}><div className="admin-bars"><i title={`${copy.registrations}: ${day.registrations}`} style={{ height: `${Math.max(4, (day.registrations / maxActivity) * 100)}%` }}/><b title={`${copy.active}: ${day.active_users}`} style={{ height: `${Math.max(4, (day.active_users / maxActivity) * 100)}%` }}/></div><small>{new Intl.DateTimeFormat(fa ? 'fa-IR' : 'en-GB', { weekday: 'narrow' }).format(new Date(day.date))}</small></div>)}</div><div className="admin-chart-key"><span><i/>{copy.registrations}</span><span><b/>{copy.active}</span></div></article>
            <article className="admin-panel admin-top-games"><div className="admin-panel-heading"><div><span className="eyebrow"><Trophy size={14}/>{copy.topGames}</span><h2>{fa ? 'براساس نشست‌های واقعی' : 'From real sessions'}</h2></div></div><div className="admin-ranked-list">{(admin.dashboard?.top_games || []).length ? admin.dashboard!.top_games.map((game, index) => <div key={game.game_type}><em>0{index + 1}</em><span className={`admin-game-dot accent-${gameById(game.game_type === 'tic_tac_toe' ? 'tic-tac-toe' : game.game_type as PartyGameId).accent}`}/><strong>{gameById(game.game_type === 'tic_tac_toe' ? 'tic-tac-toe' : game.game_type as PartyGameId).title}</strong><small>{game.completed_games} {copy.gamesDone}</small></div>) : <p className="admin-empty-copy">{fa ? 'هنوز نشست پایان‌یافته‌ای ثبت نشده است.' : 'No completed session has been recorded yet.'}</p>}</div></article>
          </div>
          <article className="admin-panel admin-recent-rooms"><div className="admin-panel-heading"><div><span className="eyebrow"><Clock3 size={14}/>{copy.recent}</span><h2>{fa ? 'آخرین اتاق‌های پلتفرم' : 'Latest platform rooms'}</h2></div><button className="text-button" onClick={() => setTab('rooms')}>{copy.rooms}<ArrowLeft size={15}/></button></div><div className="admin-room-table">{(admin.dashboard?.recent_rooms || []).map((room) => <div key={room.id}><span className={`admin-room-state state-${room.status}`}>{roomState(room.status, fa)}</span><strong>{room.name}</strong><small>{gameById(room.game_type === 'tic_tac_toe' ? 'tic-tac-toe' : room.game_type as PartyGameId).title} · {room.capacity} {fa ? 'نفر' : 'seats'}</small><span>{room.host_display_name}</span>{room.is_admin_test && <em>{fa ? 'تست' : 'Test'}</em>}</div>)}{!(admin.dashboard?.recent_rooms || []).length && <p className="admin-empty-copy">{fa ? 'اتاقی برای نمایش نیست.' : 'No room to display.'}</p>}</div></article>
        </>}

        {tab === 'users' && <article className="admin-panel admin-users-panel"><div className="admin-panel-heading"><div><span className="eyebrow"><UsersRound size={14}/>{copy.userDirectory}</span><h2>{new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US').format(admin.users.total)} {copy.members}</h2></div></div><form className="admin-search" onSubmit={(event) => { event.preventDefault(); void admin.searchUsers(query) }}><Search size={18}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchHint}/><button className="primary-button" disabled={admin.busy}>{copy.search}</button></form><div className="admin-user-table">{admin.users.items.map((user) => <button key={user.id} onClick={() => void showUser(user.id)}><PlayerAvatar seed={user.avatar_seed} label={user.display_name} size="sm" status={user.presence}/><span><IdentityLabel label={user.display_name} isVerified={user.is_verified} membershipTier={user.membership_tier} siteRole={user.site_role} compact/><small dir="ltr">@{user.username}</small></span><em className={`admin-presence presence-${user.presence}`}>{user.presence}</em><small>{user.room_count} {copy.roomsMade}</small><small>{user.completed_games} {copy.gamesDone}</small><ChevronLeft size={17}/></button>)}{!admin.users.items.length && <p className="admin-empty-copy">{copy.noUsers}</p>}</div>{admin.users.total > admin.users.limit && <div className="admin-pagination"><button className="secondary-button" disabled={admin.busy || admin.users.offset === 0} onClick={() => void admin.searchUsers(query, Math.max(0, admin.users.offset - admin.users.limit))}>{fa ? 'صفحهٔ قبل' : 'Previous'}</button><span>{Math.floor(admin.users.offset / admin.users.limit) + 1}</span><button className="secondary-button" disabled={admin.busy || admin.users.offset + admin.users.limit >= admin.users.total} onClick={() => void admin.searchUsers(query, admin.users.offset + admin.users.limit)}>{fa ? 'صفحهٔ بعد' : 'Next'}</button></div>}</article>}

        {tab === 'launch' && <div className="admin-launch-grid"><article className="admin-panel admin-launch-panel"><div className="admin-panel-heading"><div><span className="eyebrow"><Rocket size={14}/>{copy.quickLaunch}</span><h2>{copy.quickDesc}</h2></div></div><span className="admin-launch-label">{copy.onlineTable}</span><div className="admin-launch-options">{launchOptions.map((option) => { const game = gameById(option.gameId); const Icon = game.icon; return <button key={option.gameType} onClick={() => selectLaunch(option)} className={selectedLaunch.gameType === option.gameType ? `selected accent-${game.accent}` : ''}><span><Icon size={18}/></span><strong>{game.title}</strong><small>{game.players}</small></button> })}</div><div className="admin-launch-form"><label>{copy.roomName}<input value={roomName} onChange={(event) => setRoomName(event.target.value)} placeholder={copy.roomNameHint} maxLength={60}/></label><label>{copy.capacity}<select value={capacity} onChange={(event) => setCapacity(Number(event.target.value))}>{selectedLaunch.capacities.map((size) => <option value={size} key={size}>{size} {fa ? 'نفر' : 'players'}</option>)}</select></label><button className="primary-button admin-launch-button" disabled={admin.busy} onClick={() => void createRoom()}><Rocket size={17}/>{copy.create}</button></div><p className="admin-launch-note"><ShieldCheck size={16}/>{copy.launchNote}</p></article>
          <article className="admin-panel admin-solo-panel"><div className="admin-panel-heading"><div><span className="eyebrow"><Gamepad2 size={14}/>{copy.soloTable}</span><h2>{fa ? 'بازی را همین حالا باز کن' : 'Open a game immediately'}</h2></div></div><div className="admin-solo-grid">{gameCatalog.filter((game) => game.availability === 'published' && !launchOptions.some((option) => option.gameId === game.id)).map((game) => { const Icon = game.icon; return <button key={game.id} onClick={() => onOpenPractice(game.id)} className={`accent-${game.accent}`}><span><Icon size={18}/></span><strong>{game.title}</strong><small>{game.players}</small><i><ArrowLeft size={15}/>{copy.playNow}</i></button> })}</div></article></div>}

        {tab === 'rooms' && <article className="admin-panel admin-test-room-panel"><div className="admin-panel-heading"><div><span className="eyebrow"><Database size={14}/>{copy.myRooms}</span><h2>{fa ? 'اتاق‌های ایجادشده توسط تو' : 'Rooms created by you'}</h2></div><button className="secondary-button" onClick={() => setTab('launch')}><Rocket size={16}/>{copy.launch}</button></div><div className="admin-test-room-list">{admin.testRooms.map((room) => <article key={room.id}><div className={`admin-room-icon accent-${gameById(room.game_type === 'tic_tac_toe' ? 'tic-tac-toe' : room.game_type as PartyGameId).accent}`}>{(() => { const Icon = gameById(room.game_type === 'tic_tac_toe' ? 'tic-tac-toe' : room.game_type as PartyGameId).icon; return <Icon size={18}/> })()}</div><div><strong>{room.name}</strong><small>{gameById(room.game_type === 'tic_tac_toe' ? 'tic-tac-toe' : room.game_type as PartyGameId).title} · {room.member_count || 1}/{room.capacity} · {dateLabel(room.created_at, fa)}</small></div><span className={`admin-room-state state-${room.status}`}>{roomState(room.status, fa)}</span><div className="admin-room-actions"><button className="icon-button" title={copy.copyLink} onClick={() => void copyInvite(room)}><Copy size={16}/></button><button className="secondary-button" onClick={() => onEnterRoom(room)}><ArrowLeft size={16}/>{copy.enter}</button>{room.status === 'lobby' && <button className="danger-button" disabled={admin.busy} onClick={() => void cancelRoom(room)}><CircleStop size={16}/>{copy.cancel}</button>}</div></article>)}{!admin.testRooms.length && <div className="admin-empty-room"><Database size={28}/><p>{copy.noRooms}</p><button className="primary-button" onClick={() => setTab('launch')}><Rocket size={17}/>{copy.launch}</button></div>}</div></article>}
      </div>
    </div>

    {selectedUser && <div className="admin-user-drawer-backdrop" role="presentation" onClick={() => setSelectedUser(null)}><aside className="admin-user-drawer" role="dialog" aria-modal="true" aria-label={copy.userDetail} onClick={(event) => event.stopPropagation()}><button className="icon-button admin-drawer-close" onClick={() => setSelectedUser(null)}>×</button><PlayerAvatar seed={selectedUser.avatar_seed} label={selectedUser.display_name} size="lg" status={selectedUser.presence}/><span className="eyebrow"><UserRound size={14}/>{copy.userDetail}</span><IdentityLabel label={selectedUser.display_name} isVerified={selectedUser.is_verified} membershipTier={selectedUser.membership_tier} siteRole={selectedUser.site_role} tagline={selectedUser.profile_tagline}/><p dir="ltr">@{selectedUser.username}</p><div className="admin-detail-grid"><div><small>{copy.email}</small><strong dir="ltr">{selectedUser.email || '—'}</strong></div><div><small>{copy.joined}</small><strong>{dateLabel(selectedUser.created_at, fa)}</strong></div><div><small>{copy.lastActivity}</small><strong>{dateLabel(selectedUser.last_activity_at, fa)}</strong></div><div><small>{copy.gamesDone}</small><strong>{selectedUser.completed_games}</strong></div></div><section className="admin-membership-panel"><div className="admin-moderation-heading"><div><span className="eyebrow"><ShieldCheck size={14}/>{copy.premium}</span><h3>{selectedUser.is_verified ? copy.premiumActive : copy.premiumStandard}</h3><p>{copy.premiumDescription}</p></div></div>{selectedUser.premium_until && <div className="admin-membership-current">{copy.premiumDuration}: <b>{dateLabel(selectedUser.premium_until, fa)}</b></div>}<label className="admin-moderation-field">{copy.reason}<textarea value={membershipReason} onChange={(event) => setMembershipReason(event.target.value)} placeholder={copy.reasonHint} minLength={8} maxLength={280}/></label>{!selectedUser.is_verified && <label className="admin-moderation-field">{copy.premiumDuration}<select value={premiumDuration} onChange={(event) => setPremiumDuration(event.target.value === 'permanent' ? 'permanent' : Number(event.target.value) as 30 | 90 | 365)}><option value={30}>{fa ? '۳۰ روز' : '30 days'}</option><option value={90}>{fa ? '۹۰ روز' : '90 days'}</option><option value={365}>{fa ? 'یک سال' : '1 year'}</option><option value="permanent">{copy.permanent}</option></select></label>}<button type="button" className={`admin-membership-submit ${selectedUser.is_verified ? 'is-revoke' : ''}`} disabled={admin.busy || membershipReason.trim().length < 8} onClick={() => void applyMembership(selectedUser.is_verified ? 'standard' : 'premium')}><ShieldCheck size={16}/>{selectedUser.is_verified ? copy.revokePremium : copy.grantPremium}</button></section><section className="admin-moderation-panel"><div className="admin-moderation-heading"><div><span className="eyebrow"><AlertTriangle size={14}/>{copy.moderation}</span><h3>{copy.accountState}: <b className={`admin-account-state state-${selectedUser.account_state || 'active'}`}>{accountStateLabel(selectedUser.account_state)}</b></h3><p>{copy.moderationDescription}</p></div></div>{selectedUser.moderation_reason && <div className="admin-moderation-current"><strong>{copy.recordedReason}</strong><span>{selectedUser.moderation_reason}</span>{selectedUser.restricted_until && <small>{copy.restrictionUntil}: {dateLabel(selectedUser.restricted_until, fa)}</small>}{selectedUser.purge_after && <small>{copy.purgeAfter}: {dateLabel(selectedUser.purge_after, fa)}</small>}</div>}<div className="admin-moderation-actions">{([['restrict', Ban], ['suspend', AlertTriangle], ['restore', RotateCcw], ['schedule_delete', Clock3], ['purge_now', Trash2]] as Array<[AccountModerationAction, typeof Ban]>).map(([action, Icon]) => <button key={action} type="button" className={moderationAction === action ? `moderation-action-selected action-${action}` : ''} onClick={() => setModerationAction(action)}><Icon size={15}/>{actionLabel(action)}</button>)}</div>{moderationAction === 'restrict' && <label className="admin-moderation-field">{copy.duration}<select value={restrictionDuration} onChange={(event) => setRestrictionDuration(event.target.value === 'permanent' ? 'permanent' : Number(event.target.value) as 24 | 168 | 720)}><option value={24}>{fa ? '۲۴ ساعت' : '24 hours'}</option><option value={168}>{fa ? '۷ روز' : '7 days'}</option><option value={720}>{fa ? '۳۰ روز' : '30 days'}</option><option value="permanent">{copy.permanent}</option></select></label>}<label className="admin-moderation-field">{copy.reason}<textarea value={moderationReason} onChange={(event) => setModerationReason(event.target.value)} placeholder={copy.reasonHint} minLength={8} maxLength={280}/></label>{(moderationAction === 'schedule_delete' || moderationAction === 'purge_now') && <label className="admin-moderation-field admin-confirm-field">{copy.typedConfirmation}<input value={moderationConfirmation} onChange={(event) => setModerationConfirmation(event.target.value)} placeholder={`@${selectedUser.username}`} dir="ltr" autoComplete="off"/></label>}<button className={`admin-moderation-submit ${moderationAction === 'purge_now' ? 'is-purge' : ''}`} type="button" disabled={admin.busy || moderationReason.trim().length < 8 || ((moderationAction === 'schedule_delete' || moderationAction === 'purge_now') && moderationConfirmation.trim().toLowerCase() !== selectedUser.username.toLowerCase())} onClick={() => void applyModeration()}>{admin.busy ? <RefreshCw className="spin" size={16}/> : moderationAction === 'restore' ? <UserCheck size={16}/> : moderationAction === 'purge_now' ? <Trash2 size={16}/> : <ShieldCheck size={16}/>}{copy.applyAction}</button></section><button className="secondary-button full-button" onClick={() => setSelectedUser(null)}>{copy.close}</button></aside></div>}
    {detailLoading && <div className="admin-detail-loading"><span className="admin-orb"/></div>}
  </section>
}
