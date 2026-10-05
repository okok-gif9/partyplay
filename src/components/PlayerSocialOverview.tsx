import { useCallback, useEffect, useState } from 'react'
import { History, RefreshCw, Trophy } from 'lucide-react'
import { useLanguage } from '../i18n'
import { loadSocialOverview, type SocialOverview } from '../lib/partyplay'
import { PlayerAvatar } from './SocialIdentity'

const gameNames: Record<string, { fa: string; en: string }> = {
  mafia: { fa: 'مافیا', en: 'Mafia' },
  truth_or_dare: { fa: 'جرئت یا حقیقت', en: 'Truth or Dare' },
  tic_tac_toe: { fa: 'دوز', en: 'Tic-Tac-Toe' },
  uno: { fa: 'اونو', en: 'UNO' },
  codenames: { fa: 'رمز', en: 'Codenames' },
  spyfall: { fa: 'جاسوس', en: 'Spyfall' },
  connect_four: { fa: 'چهار در ردیف', en: 'Connect Four' },
  backgammon: { fa: 'تخته‌نرد', en: 'Backgammon' },
  ludo: { fa: 'منچ', en: 'Ludo' },
  pictionary: { fa: 'نقاشی', en: 'Pictionary' },
  hokm: { fa: 'حکم', en: 'Hokm' },
}

export default function PlayerSocialOverview({ currentUserId }: { currentUserId: string }) {
  const { language } = useLanguage()
  const fa = language === 'fa'
  const [overview, setOverview] = useState<SocialOverview>({ leaderboard: [], matches: [] })
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const refresh = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try { setOverview(await loadSocialOverview()) }
    catch { setFailed(true) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  const dateText = (value: string) => new Intl.DateTimeFormat(fa ? 'fa-IR' : 'en-GB', { dateStyle: 'medium' }).format(new Date(value))
  const matchStatus = (value: string) => value === 'finished' ? (fa ? 'تمام‌شده' : 'Finished') : value === 'running' ? (fa ? 'در حال بازی' : 'In progress') : value === 'abandoned' ? (fa ? 'ناتمام' : 'Left') : (fa ? 'لابی' : 'Lobby')

  return <section className="panel player-social-overview">
    <div className="section-panel-heading"><div><span className="eyebrow"><Trophy size={15}/>{fa ? 'جمع دوستان' : 'YOUR CIRCLE'}</span><h2>{fa ? 'جدول دوستان و تاریخچهٔ بازی' : 'Friends leaderboard & match history'}</h2></div><button type="button" className="icon-action" onClick={() => void refresh()} disabled={loading} aria-label={fa ? 'به‌روزرسانی' : 'Refresh'}><RefreshCw size={15}/></button></div>
    {failed && <p className="social-overview-note">{fa ? 'اطلاعات آنلاین دریافت نشد؛ پس از اتصال پایگاه داده دوباره تلاش کن.' : 'Could not load online history. Try again after the database is connected.'}</p>}
    <div className="player-social-columns">
      <section className="player-social-list"><h3><Trophy size={14}/>{fa ? 'رتبه‌بندی دوستان' : 'Friends leaderboard'}</h3>{loading ? <small>{fa ? 'در حال بارگذاری…' : 'Loading…'}</small> : overview.leaderboard.length ? overview.leaderboard.map((entry) => <article className={entry.user_id === currentUserId ? 'player-leaderboard-row is-self' : 'player-leaderboard-row'} key={entry.user_id}><b className="leaderboard-rank">#{entry.rank}</b><PlayerAvatar seed={entry.avatar_seed} label={entry.display_name} size="sm"/><span className="leaderboard-name"><strong>{entry.display_name}</strong><small dir="ltr">@{entry.username}</small></span><span className="leaderboard-score"><b>{entry.completed_games}</b><small>{fa ? 'بازی تمام‌شده' : 'finished'}</small></span></article>) : <p className="social-overview-note">{fa ? 'با اولین بازی، تو و دوستانت در جدول دیده می‌شوید.' : 'Finish a game to appear on your friends leaderboard.'}</p>}</section>
      <section className="player-social-list"><h3><History size={14}/>{fa ? 'بازی‌های اخیر' : 'Recent matches'}</h3>{loading ? <small>{fa ? 'در حال بارگذاری…' : 'Loading…'}</small> : overview.matches.length ? overview.matches.map((match) => <article className="match-history-row" key={match.id}><div><strong>{gameNames[match.game_type]?.[fa ? 'fa' : 'en'] || match.game_type}</strong><small>{match.players.join(' · ')}</small></div><span><b>{matchStatus(match.status)}</b><small>{dateText(match.finished_at || match.created_at)}</small></span></article>) : <p className="social-overview-note">{fa ? 'بازی‌های اخیر اینجا نمایش داده می‌شوند.' : 'Your recent matches will appear here.'}</p>}</section>
    </div>
  </section>
}
