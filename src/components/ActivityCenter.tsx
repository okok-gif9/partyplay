import { BellRing, CheckCheck, ChevronLeft, Clock3, DoorOpen, Flag, Play, ShieldAlert, ShieldCheck, TimerReset, Trophy, UserPlus, UserRoundCheck, UsersRound } from 'lucide-react'
import type { PartyPlayActivity } from '../lib/partyplay'
import { useLanguage } from '../i18n'
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
  const { language, t, format } = useLanguage()
  const formatDate = (value: string) => new Intl.DateTimeFormat(language === 'fa' ? 'fa-IR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

  return <section className="sub-page activity-page"><div className="page-title"><button className="back-link" onClick={onBack}><ChevronLeft size={17}/>{t.app.home}</button><span className="eyebrow"><BellRing size={15}/> {t.activity.eyebrow}</span><h1>{t.activity.title}</h1><p>{t.activity.description}</p></div><section className="activity-hero panel"><div><span className="eyebrow">{t.activity.live}</span><h2>{unreadCount ? format(t.activity.unread, { count: unreadCount }) : t.activity.caughtUp}</h2><p>{unreadCount ? t.activity.unreadHint : t.activity.caughtUpHint}</p></div>{unreadCount > 0 && <button className="secondary-button" onClick={onMarkAllRead}><CheckCheck size={17}/>{t.activity.markAllRead}</button>}</section><section className="activity-feed panel">{loading ? <div className="activity-empty"><Clock3 size={26}/><p>{t.activity.loading}</p></div> : items.length ? <div className="activity-list">{items.map((item) => { const destination = activityDestination(item.kind); const Icon = activityIcon[item.kind]; return <article className={`activity-row ${item.readAt ? '' : 'is-unread'}`} key={item.id}><span className="activity-kind-icon"><Icon size={16}/></span>{item.actor ? <PlayerAvatar seed={item.actor.avatarSeed} label={item.actor.displayName} size="sm"/> : <span className="activity-system-mark"><BellRing size={15}/></span>}<div><strong>{item.title}</strong><p>{item.body}</p><small><Clock3 size={12}/>{formatDate(item.createdAt)}</small></div>{destination && <button className="text-button" onClick={() => onNavigate(destination)}>{destination === 'friends' ? t.activity.friends : t.activity.groups}<ChevronLeft size={15}/></button>}</article> })}</div> : <div className="activity-empty"><BellRing size={30}/><h2>{t.activity.emptyTitle}</h2><p>{t.activity.emptyDescription}</p></div>}</section></section>
}
