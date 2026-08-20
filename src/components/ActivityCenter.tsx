import { BellRing, CheckCheck, ChevronLeft, Clock3, UsersRound } from 'lucide-react'
import type { PartyPlayActivity } from '../lib/partyplay'
import { PlayerAvatar } from './SocialIdentity'

const activityIcon: Record<PartyPlayActivity['kind'], string> = {
  friend_request: '＋', friend_accepted: '✓', group_added: '◈', room_invite: '↗', game_finished: '★', achievement: '✦', report_update: '•',
}

const activityDestination = (kind: PartyPlayActivity['kind']) => kind === 'friend_request' || kind === 'friend_accepted' ? 'friends' : kind === 'group_added' ? 'groups' : null

export default function ActivityCenter({ items, loading, unreadCount, onBack, onMarkAllRead, onNavigate }: {
  items: PartyPlayActivity[]; loading: boolean; unreadCount: number; onBack: () => void; onMarkAllRead: () => void; onNavigate: (destination: 'friends' | 'groups') => void
}) {
  const formatDate = (value: string) => new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  return <section className="sub-page activity-page"><div className="page-title"><button className="back-link" onClick={onBack}><ChevronLeft size={17}/>خانه</button><span className="eyebrow"><BellRing size={15}/> مرکز فعالیت</span><h1>اتفاق‌های جمع تو</h1><p>درخواست‌های دوستی، گروه‌ها و رخدادهای مهم بازی را از همین‌جا دنبال کن.</p></div><section className="activity-hero panel"><div><span className="eyebrow">به‌روزرسانی زنده</span><h2>{unreadCount ? `${unreadCount} اتفاق تازه داری` : 'همه‌چیز دیده شده'}</h2><p>{unreadCount ? 'با بازکردن هر بخش، عمل مربوط به آن را انجام بده.' : 'وقتی دوست یا گروهی با تو تعامل کند، اینجا خبر می‌دهیم.'}</p></div>{unreadCount > 0 && <button className="secondary-button" onClick={onMarkAllRead}><CheckCheck size={17}/>خواندن همه</button>}</section><section className="activity-feed panel">{loading ? <div className="activity-empty"><Clock3 size={26}/><p>در حال دریافت فعالیت‌ها…</p></div> : items.length ? <div className="activity-list">{items.map((item) => { const destination = activityDestination(item.kind); return <article className={`activity-row ${item.readAt ? '' : 'is-unread'}`} key={item.id}><span className="activity-kind-icon">{activityIcon[item.kind]}</span>{item.actor ? <PlayerAvatar seed={item.actor.avatarSeed} label={item.actor.displayName} size="sm"/> : <span className="activity-system-mark"><BellRing size={15}/></span>}<div><strong>{item.title}</strong><p>{item.body}</p><small><Clock3 size={12}/>{formatDate(item.createdAt)}</small></div>{destination && <button className="text-button" onClick={() => onNavigate(destination)}>{destination === 'friends' ? 'دوستان' : 'گروه‌ها'}<ChevronLeft size={15}/></button>}</article> })}</div> : <div className="activity-empty"><UsersRound size={30}/><h2>هنوز خبری نیست</h2><p>وقتی درخواست دوستی بگیری یا به گروهی اضافه شوی، اتفاق‌ها اینجا می‌آیند.</p></div>}</section></section>
}
