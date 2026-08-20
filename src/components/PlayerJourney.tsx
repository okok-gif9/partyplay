import { CalendarDays, Crown, Gamepad2, Sparkles, Trophy, UsersRound } from 'lucide-react'
import type { PlayerProgress } from '../lib/partyplay'

export default function PlayerJourney({ progress, loading, completion }: { progress: PlayerProgress; loading: boolean; completion: number }) {
  const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(value)) : 'هنوز بازی واقعی ثبت نشده'
  const metrics = [
    { label: 'بازی گروهی', value: progress.gamesPlayed, icon: Gamepad2 },
    { label: 'مافیا', value: progress.mafiaGames, icon: Crown },
    { label: 'دوست', value: progress.friendsCount, icon: UsersRound },
    { label: 'روز فعال این هفته', value: progress.weekActiveDays, icon: CalendarDays },
  ]
  return <section className="panel player-journey"><div className="player-journey-head"><div><span className="eyebrow"><Trophy size={15}/> مسیر بازی تو</span><h2>پیشرفت واقعی، نه امتیاز نمایشی</h2><p>آمار فقط از اتاق‌ها، دوستی‌ها و بازی‌های ثبت‌شده در PartyPlay ساخته می‌شود.</p></div><div className="journey-completion" aria-label={`${completion} درصد دستاوردها باز شده‌اند`}><strong>{completion}<small>%</small></strong><span>نشان‌ها</span></div></div>{loading ? <div className="journey-loading">در حال همگام‌سازی آمار…</div> : <><div className="journey-metrics">{metrics.map(({ label, value, icon: Icon }) => <article key={label}><span><Icon size={17}/></span><div><strong>{value}</strong><small>{label}</small></div></article>)}</div><div className="journey-last-game"><Sparkles size={15}/><span>آخرین فعالیت بازی: <b>{formatDate(progress.lastGameAt)}</b></span><small>{progress.hostedRooms} اتاق میزبانی‌شده · {progress.finishedGames} بازی به‌پایان‌رسیده</small></div><div className="journey-achievements"><div><span className="field-label">نشان‌های بازشده</span><small>{progress.achievements.length} از ۴ نشان پایه</small></div>{progress.achievements.length ? <div className="journey-badge-list">{progress.achievements.map((achievement) => <article className={`journey-badge accent-${achievement.accent}`} key={achievement.code}><span>{achievement.icon}</span><div><strong>{achievement.title}</strong><small>{achievement.description}</small></div></article>)}</div> : <div className="journey-empty"><Trophy size={22}/><p>اولین اتاق گروهی، دوست یا بازی مافیا را بساز تا نشان‌های واقعی‌ات اینجا ظاهر شوند.</p></div>}</div></>}</section>
}
