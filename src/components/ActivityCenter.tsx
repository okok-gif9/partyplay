import { BellRing, CheckCheck, ChevronLeft, Clock3, DoorOpen, Flag, Play, ShieldAlert, ShieldCheck, TimerReset, Trophy, UserPlus, UserRoundCheck, UsersRound } from 'lucide-react'
import type { PartyPlayActivity } from '../lib/partyplay'
import { PlayerAvatar } from './SocialIdentity'

const activityIcon: Record<PartyPlayActivity['kind'], typeof BellRing> = {
  friend_request: UserPlus,
  friend_accepted: UserRoundCheck,
  group_added: UsersRound,
  room_invite: DoorOpen,
  game_started: Play,
  your_turn: TimerReset,
  game_finished: Flag,
  achievement: Trophy,
  report_update: ShieldAlert,
  security: ShieldCheck,
}

const activityDestination = (kind: PartyPlayActivity['kind']) => kind === 'friend_request' || kind === 'friend_accepted' ? 'friends' : kind === 'group_added' ? 'groups' : null

export default function ActivityCenter({ items, loading, unreadCount, onBack, onMarkAllRead, onNavigate }: {
  items: PartyPlayActivity[]; loading: boolean; unreadCount: number; onBack: () => void; onMarkAllRead: () => void; onNavigate: (destination: 'friends' | 'groups') => void
}) {
  const formatDate = (value: string) => new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  return <section className="sub-page activity-page"><div className="page-title"><button className="back-link" onClick={onBack}><ChevronLeft size={17}/>خانه</button><span className="eyebrow"><BellRing size={15}/> مرکز اعلان‌ها</span><h1>خبرهای جمع تو</h1><p>دعوت‌ها، دوستی‌ها، رخدادهای بازی و به‌روزرسانی‌های مهم را از همین‌جا دنبال کن.</p></div><section className="activity-hero panel"><div><span className="eyebrow">به‌روزرسانی زنده</span><h2>{unreadCount ? `${unreadCount} اعلان تازه داری` : 'همه‌چیز دیده شده'}</h2><p>{unreadCount ? 'هر رویداد مهم اینجا می‌ماند؛ موارد خوانده‌نشده با کادر رنگی مشخص هستند.' : 'وقتی دوست، گروه یا بازی با تو تعامل کند، اینجا خبر می‌دهیم.'}</p></div>{unreadCount > 0 && <button className="secondary-button" onClick={onMarkAllRead}><CheckCheck size={17}/>خواندن همه</button>}</section><section className="activity-feed panel">{loading ? <div className="activity-empty"><Clock3 size={26}/><p>در حال دریافت اعلان‌ها…</p></div> : items.length ? <div className="activity-list">{items.map((item) => { const destination = activityDestination(item.kind); const Icon = activityIcon[item.kind]; return <article className={`activity-row ${item.readAt ? '' : 'is-unread'}`} key={item.id}><span className="activity-kind-icon"><Icon size={16}/></span>{item.actor ? <PlayerAvatar seed={item.actor.avatarSeed} label={item.actor.displayName} size="sm"/> : <span className="activity-system-mark"><BellRing size={15}/></span>}<div><strong>{item.title}</strong><p>{item.body}</p><small><Clock3 size={12}/>{formatDate(item.createdAt)}</small></div>{destination && <button className="text-button" onClick={() => onNavigate(destination)}>{destination === 'friends' ? 'دوستان' : 'گروه‌ها'}<ChevronLeft size={15}/></button>}</article> })}</div> : <div className="activity-empty"><BellRing size={30}/><h2>هنوز خبری نیست</h2><p>وقتی درخواست دوستی، دعوت بازی یا رویداد مهمی داشته باشی، اینجا نشان داده می‌شود.</p></div>}</section></section>
}
