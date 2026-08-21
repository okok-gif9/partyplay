import { BellRing, CheckCheck, ChevronLeft, Clock3, Gamepad2, ShieldCheck, Trophy, UserPlus, UsersRound } from 'lucide-react'
import { useLanguage } from '../i18n'
import type { PartyPlayActivity } from '../lib/partyplay'
import { PlayerAvatar } from './SocialIdentity'

const iconByKind: Record<PartyPlayActivity['kind'], typeof BellRing> = {
  friend_request: UserPlus,
  friend_accepted: UsersRound,
  group_added: UsersRound,
  room_invite: Gamepad2,
  game_started: Gamepad2,
  your_turn: BellRing,
  game_finished: Trophy,
  achievement: Trophy,
  report_update: ShieldCheck,
  security: ShieldCheck,
}

export default function NotificationCenter({
  open,
  onToggle,
  items,
  unreadCount,
  onOpenActivity,
  onMarkAllRead,
}: {
  open: boolean
  onToggle: () => void
  items: PartyPlayActivity[]
  unreadCount: number
  onOpenActivity: () => void
  onMarkAllRead: () => void
}) {
  const { language, t, format } = useLanguage()
  const formatDate = (value: string) => new Intl.DateTimeFormat(language === 'fa' ? 'fa-IR' : 'en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(value))
  const latest = items.slice(0, 5)
  const title = t.activity.eyebrow

  return <div className={`notification-menu ${open ? 'notification-menu-open' : ''}`}>
    <button className={`activity-toggle icon-button ${unreadCount ? 'has-unread' : ''}`} onClick={onToggle} aria-label={title} title={title} aria-haspopup="dialog" aria-expanded={open}><BellRing size={18}/>{unreadCount > 0 && <i>{unreadCount > 9 ? '9+' : unreadCount}</i>}</button>
    {open && <section className="notification-popover" role="dialog" aria-label={title}>
      <div className="notification-popover-heading"><div><span className="eyebrow"><BellRing size={14}/>{t.activity.live}</span><h2>{unreadCount ? format(t.activity.unread, { count: unreadCount }) : t.activity.caughtUp}</h2></div>{unreadCount > 0 && <button type="button" onClick={onMarkAllRead}><CheckCheck size={15}/>{t.activity.markAllRead}</button>}</div>
      {latest.length ? <div className="notification-popover-list">{latest.map((item) => { const Icon = iconByKind[item.kind]; return <article className={!item.readAt ? 'notification-popover-unread' : ''} key={item.id}><span className="notification-popover-kind"><Icon size={15}/></span>{item.actor ? <PlayerAvatar seed={item.actor.avatarSeed} label={item.actor.displayName} size="sm"/> : <span className="notification-system-avatar"><BellRing size={14}/></span>}<div><strong>{item.title}</strong><p>{item.body}</p><small><Clock3 size={11}/>{formatDate(item.createdAt)}</small></div></article> })}</div> : <div className="notification-popover-empty"><BellRing size={23}/><p>{t.activity.emptyTitle}</p></div>}
      <button type="button" className="notification-popover-footer" onClick={onOpenActivity}>{t.activity.eyebrow}<ChevronLeft size={16}/></button>
    </section>}
  </div>
}
