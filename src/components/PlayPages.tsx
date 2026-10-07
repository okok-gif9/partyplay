import { useMemo, useState, type ReactNode } from 'react'
import { ArrowRight, ArrowUpRight, Clock3, DoorOpen, Gamepad2, Hash, LockKeyhole, Play, Radio, Search, Sparkles, Users } from 'lucide-react'
import { useLanguage } from '../i18n'
import type { ActiveRoomSummary } from '../lib/partyplay'
import type { GameDefinition, PartyGameId } from '../data/gameCatalog'
import type { SessionMedal } from '../hooks/useSessionPlayProgress'

const heroArt = `${import.meta.env.BASE_URL}art/partyplay-hero.webp`
const fallbackArt = `${import.meta.env.BASE_URL}art/strategy-cover.webp`

type CommonProps = {
  games: GameDefinition[]
  onPractice: (game: PartyGameId) => void
  onGameDetails: (game: PartyGameId) => void
  onFriendsGame: (game: PartyGameId) => void
  onCreateRoom: () => void
  onJoinRoom: () => void
  started: Record<string, boolean>
  earnedMedals: SessionMedal[]
}

function Intro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <header className="route-intro"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</header>
}

function GameCard({ game, onPlay, onDetails, onFriends, started, earned }: { game: GameDefinition; onPlay: () => void; onDetails: () => void; onFriends?: () => void; started?: boolean; earned?: boolean }) {
  const { t } = useLanguage()
  const Art = game.icon
  const status = earned ? t.games.statusPlayed : started ? t.games.statusProgress : t.games.statusReady
  return <article className={`editorial-game-card accent-${game.accent}`}>
    <button className="editorial-game-art" onClick={onDetails} aria-label={`${t.games.details}: ${game.title}`}>
      <img src={game.artwork || fallbackArt} alt="" loading="lazy" />
      <span className="editorial-game-tint" />
      <span className="editorial-game-kicker"><Art size={15}/>{game.tone}</span>
      <span className="editorial-game-status"><i/>{status}</span>
      <ArrowUpRight className="editorial-game-open" size={21} aria-hidden="true" />
    </button>
    <div className="editorial-game-copy"><h3>{game.title}</h3><p>{game.subtitle}</p>
      <div className="editorial-game-meta"><span><Users size={14}/>{game.players}</span><span><Clock3 size={14}/>{game.duration}</span></div>
      <div className="editorial-game-actions"><button className="game-play-action" onClick={onPlay}><Play size={15} fill="currentColor"/>{t.games.playBot}</button><button className="game-details-action" onClick={onDetails}>{t.games.details}</button>{onFriends && <button className="game-friends-action" onClick={onFriends} aria-label={`${t.games.friendsRoom}: ${game.title}`}><Users size={15}/></button>}</div>
    </div>
  </article>
}

export function HomePage({ browserOnline, name, activeRooms, onPractice, onGameDetails, onFriendsGame, onCreateRoom, onJoinRoom, onGames, onRooms, onResumeRoom, games, started, earnedMedals }: CommonProps & { browserOnline: boolean; name: string; activeRooms: ActiveRoomSummary[]; onGames: () => void; onRooms: () => void; onResumeRoom: (room: ActiveRoomSummary) => void }) {
  const { language, t } = useLanguage()
  const featured = useMemo(() => ['mafia', 'spyfall', 'uno', 'tic-tac-toe'].map((id) => games.find((game) => game.id === id)).filter((game): game is GameDefinition => Boolean(game)), [games])
  const primaryArt = featured.find((game) => game.id === 'mafia')?.artwork || fallbackArt
  const copy = language === 'fa'
    ? { availability: browserOnline ? 'اتصال پایدار' : 'بازی تمرینی در دسترس است', hello: name && name !== 'بازیکن جدید' ? `سلام ${name}` : 'دورهمی بعدی از همین‌جا شروع می‌شود', quick: 'بازی سریع', featured: 'پیشنهادهای امشب', active: 'میزهای ادامه‌دار', empty: 'هنوز میزی نداری', emptyBody: 'یک اتاق بساز یا با کد کوتاه دوستت وارد شو.', publicNote: 'از یک شروع ساده تا یک شب پر از بازی؛ انتخاب با جمع شماست.' }
    : { availability: browserOnline ? 'You’re connected' : 'Practice games are ready', hello: name && name !== 'New player' ? `Good to see you, ${name}` : 'Your next game night starts here', quick: 'Quick play', featured: 'Good games for tonight', active: 'Pick up where you left off', empty: 'Your tables will show up here', emptyBody: 'Create a room or join a friend with a short code.', publicNote: 'From a one-minute rematch to a full game night — pick the mood.' }
  return <div className="play-home">
    <section className="party-hero" style={{ ['--hero-art' as string]: `url("${heroArt}")`, ['--featured-art' as string]: `url("${primaryArt}")` }}>
      <div className="party-hero-shade" />
      <div className="party-hero-content"><span className="hero-eyebrow"><Sparkles size={15}/>{t.home.heroEyebrow}</span><p className="hero-welcome">{copy.hello}</p><h1>{t.home.heroTitle}</h1><p className="hero-description">{t.home.heroDescription}</p>
        <div className="hero-action-row"><button className="hero-primary" onClick={() => onPractice('tic-tac-toe')}><Play size={17} fill="currentColor"/>{t.home.quickPlay}</button><button className="hero-secondary" onClick={onCreateRoom}><Users size={17}/>{t.home.createRoomCta}</button><button className="hero-link" onClick={onJoinRoom}><Hash size={17}/>{t.home.joinRoomCta}</button></div>
      </div>
      <div className="hero-footnote"><span className="hero-online-dot"/><span>{copy.availability}</span><span className="hero-footnote-divider"/><span>{copy.publicNote}</span></div>
      <div className="hero-featured-card" aria-label={featured[0]?.title}><span>{t.games.featuredLabel}</span><strong>{featured[0]?.title || 'Mafia'}</strong><small>{featured[0]?.players || '5–9 players'} · {featured[0]?.duration || '15–30 min'}</small><span className="hero-card-mark"><Sparkles size={17}/></span></div>
    </section>

    <div className="home-quick-strip" aria-label={t.home.quickActions}><button onClick={onGames}><span className="quick-strip-icon quick-icon-violet"><Gamepad2 size={19}/></span><span><strong>{t.home.discoverGames}</strong><small>{games.length} {t.home.gamesReady}</small></span><ArrowRight size={17}/></button><button onClick={onRooms}><span className="quick-strip-icon quick-icon-coral"><DoorOpen size={19}/></span><span><strong>{t.home.roomsTitle}</strong><small>{t.rooms.roomsShortcut}</small></span><ArrowRight size={17}/></button><button onClick={onJoinRoom}><span className="quick-strip-icon quick-icon-gold"><Hash size={19}/></span><span><strong>{t.home.joinRoomCta}</strong><small>{t.join.enterCode}</small></span><ArrowRight size={17}/></button></div>

    {activeRooms.length > 0 && <section className="home-section active-room-section"><div className="section-heading"><div><span className="eyebrow"><Radio size={14}/>{t.home.continueEyebrow}</span><h2>{copy.active}</h2></div><button className="text-button" onClick={onRooms}>{t.home.viewAll} <ArrowRight size={15}/></button></div><div className="active-room-cards">{activeRooms.map((room) => <button className="active-room-card" key={room.id} onClick={() => onResumeRoom(room)}><span className="active-room-dot"/><span><strong>{room.name}</strong><small>{room.gameType.replaceAll('_', ' ')} · {room.status === 'lobby' ? t.home.lobbyReady : t.home.gameInProgress}</small></span><ArrowUpRight size={17}/></button>)}</div></section>}
    {activeRooms.length === 0 && <section className="home-empty-line"><span className="home-empty-icon"><DoorOpen size={19}/></span><div><strong>{copy.empty}</strong><small>{copy.emptyBody}</small></div><button className="text-button" onClick={onCreateRoom}>{t.home.createRoomCta}<ArrowRight size={15}/></button></section>}

    <section className="home-section"><div className="section-heading"><div><span className="eyebrow"><Sparkles size={14}/>{t.home.featuredEyebrow}</span><h2>{t.home.chooseAndPlay}</h2></div><button className="text-button" onClick={onGames}>{t.home.viewAll}<ArrowRight size={15}/></button></div><div className="editorial-games-grid home-featured-grid">{featured.map((game) => <GameCard key={game.id} game={game} onPlay={() => onPractice(game.id)} onDetails={() => onGameDetails(game.id)} onFriends={() => onFriendsGame(game.id)} started={Boolean(started[game.id])} earned={earnedMedals.some((medal) => medal.game === game.id)}/>)}</div></section>
  </div>
}

export function GamesPage({ games, onPractice, onGameDetails, onFriendsGame, onCreateRoom, onJoinRoom, started, earnedMedals, searchQuery, onSearchQuery }: CommonProps & { searchQuery: string; onSearchQuery: (query: string) => void }) {
  const { t } = useLanguage()
  const [filter, setFilter] = useState<'all' | 'quick' | 'friends'>('all')
  const results = games.filter((game) => {
    const searchable = `${game.title} ${game.subtitle} ${game.tone} ${game.players}`.toLocaleLowerCase()
    const matchesSearch = searchable.includes(searchQuery.trim().toLocaleLowerCase())
    const matchesFilter = filter === 'all' || (filter === 'quick' ? ['tic-tac-toe', 'uno'].includes(game.id) : Boolean(game.online || ['spyfall', 'uno', 'backgammon', 'ludo', 'codenames'].includes(game.id)))
    return matchesSearch && matchesFilter
  })
  return <section className="games-library"><Intro eyebrow={t.games.browseEyebrow} title={t.games.title} description={t.games.description} action={<button className="primary-button" onClick={onCreateRoom}><Users size={17}/>{t.home.createRoomCta}</button>}/>
    <div className="games-toolbar"><label className="games-search"><Search size={18}/><input value={searchQuery} onChange={(event) => onSearchQuery(event.target.value)} placeholder={t.games.searchPlaceholder} aria-label={t.games.searchPlaceholder}/>{searchQuery && <button onClick={() => onSearchQuery('')} aria-label={t.app.close}>×</button>}</label><div className="game-filter-chips" role="group" aria-label={t.games.filters}>{([{ id: 'all', label: t.games.allGames }, { id: 'quick', label: t.games.quickGames }, { id: 'friends', label: t.games.withFriends }] as const).map((item) => <button className={filter === item.id ? 'filter-chip filter-chip-active' : 'filter-chip'} key={item.id} onClick={() => setFilter(item.id)} aria-pressed={filter === item.id}>{item.label}</button>)}</div></div>
    {results.length ? <div className="editorial-games-grid full-games-grid">{results.map((game) => <GameCard key={game.id} game={game} onPlay={() => onPractice(game.id)} onDetails={() => onGameDetails(game.id)} onFriends={() => onFriendsGame(game.id)} started={Boolean(started[game.id])} earned={earnedMedals.some((medal) => medal.game === game.id)}/>)}</div> : <div className="games-no-results"><Search size={25}/><strong>{t.games.noResults}</strong><button className="secondary-button" onClick={() => { onSearchQuery(''); setFilter('all') }}>{t.games.clearFilters}</button></div>}
    <div className="games-room-banner"><div><span className="eyebrow">{t.games.withFriends}</span><h2>{t.games.realMatchTitle}</h2></div><div className="games-room-actions"><button className="secondary-button" onClick={onJoinRoom}><Hash size={16}/>{t.home.joinRoomCta}</button><button className="primary-button" onClick={onCreateRoom}><Users size={17}/>{t.home.createRoomCta}</button></div></div>
  </section>
}

export function GameDetailsPage({ game, onBack, onPractice, onFriendsGame }: { game: GameDefinition; onBack: () => void; onPractice: () => void; onFriendsGame: () => void }) {
  const { t } = useLanguage()
  const Art = game.icon
  return <section className={`game-detail-page accent-${game.accent}`}><button className="back-link" onClick={onBack}><ArrowRight size={16}/>{t.app.games}</button><div className="game-detail-layout"><div className="game-detail-art"><img src={game.artwork || fallbackArt} alt=""/><span className="game-detail-badge"><Art size={16}/>{game.tone}</span></div><div className="game-detail-copy"><span className="eyebrow">{t.games.gameDetails}</span><h1>{game.title}</h1><p>{game.subtitle}</p><div className="game-detail-facts"><span><Users size={17}/><b>{game.players}</b></span><span><Clock3 size={17}/><b>{game.duration}</b></span><span><Radio size={17}/><b>{game.online ? t.games.onlineReady : t.games.localPlay}</b></span></div><div className="game-detail-actions"><button className="primary-button" onClick={onPractice}><Play size={16} fill="currentColor"/>{t.games.playBot}</button>{game.online && <button className="secondary-button" onClick={onFriendsGame}><Users size={17}/>{t.games.friendsRoom}</button>}</div><div className="game-how-to"><strong><Sparkles size={16}/>{t.games.howToPlay}</strong><p>{t.games.rulesSummary}</p></div></div></div></section>
}

export function RoomsPage({ activeRooms, authenticated, onCreateRoom, onJoinRoom, onResumeRoom, onSignIn }: { activeRooms: ActiveRoomSummary[]; authenticated: boolean; onCreateRoom: () => void; onJoinRoom: () => void; onResumeRoom: (room: ActiveRoomSummary) => void; onSignIn: () => void }) {
  const { t } = useLanguage()
  return <section className="rooms-page"><Intro eyebrow={t.rooms.eyebrow} title={t.rooms.title} description={t.rooms.description} action={<button className="primary-button" onClick={onCreateRoom}><Users size={17}/>{t.home.createRoomCta}</button>}/>
    <div className="room-entry-grid"><button className="room-entry-card room-entry-create" onClick={onCreateRoom}><span className="room-entry-icon"><Users size={21}/></span><span className="room-entry-content"><b>{t.rooms.createTitle}</b><small>{t.rooms.createDescription}</small></span><ArrowUpRight size={18}/></button><button className="room-entry-card room-entry-join" onClick={onJoinRoom}><span className="room-entry-icon"><Hash size={21}/></span><span className="room-entry-content"><b>{t.rooms.joinTitle}</b><small>{t.rooms.joinDescription}</small></span><ArrowUpRight size={18}/></button></div>
    <div className="room-directory-panel"><div className="section-heading"><div><span className="eyebrow"><Radio size={14}/>{t.rooms.publicEyebrow}</span><h2>{t.rooms.publicTitle}</h2></div><span className="room-preview-badge">{t.app.comingSoon}</span></div><p>{t.rooms.publicUnavailable}</p><button className="secondary-button" onClick={onJoinRoom}><Hash size={16}/>{t.home.joinRoomCta}</button></div>
    <div className="room-directory-panel active-directory-panel"><div className="section-heading"><div><span className="eyebrow">{t.rooms.yourRoomsEyebrow}</span><h2>{t.rooms.yourRoomsTitle}</h2></div>{authenticated && <span className="room-count-pill">{activeRooms.length}</span>}</div>
      {!authenticated ? <div className="room-empty-state"><LockKeyhole size={22}/><div><strong>{t.rooms.signInTitle}</strong><p>{t.rooms.signInBody}</p></div><button className="secondary-button" onClick={onSignIn}>{t.app.signIn}</button></div> : activeRooms.length ? <div className="room-list">{activeRooms.map((room) => <button className="room-list-row" key={room.id} onClick={() => onResumeRoom(room)}><span className="room-list-art"><Gamepad2 size={19}/></span><span className="room-list-copy"><b>{room.name}</b><small>{room.gameType.replaceAll('_', ' ')} · {room.status === 'lobby' ? t.home.lobbyReady : t.home.gameInProgress}</small></span><span className="room-open-action">{t.rooms.openRoom}<ArrowRight size={15}/></span></button>)}</div> : <div className="room-empty-state"><DoorOpen size={22}/><div><strong>{t.rooms.emptyTitle}</strong><p>{t.rooms.emptyBody}</p></div><button className="secondary-button" onClick={onCreateRoom}>{t.home.createRoomCta}</button></div>}
    </div>
  </section>
}

export function JoinRoomPage({ authenticated, onJoin, onSignIn }: { authenticated: boolean; onJoin: (code: string) => void; onSignIn: (code: string) => void }) {
  const { t } = useLanguage()
  const [code, setCode] = useState(() => localStorage.getItem('partyplay-pending-room-code') || '')
  const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
  return <section className="join-room-page"><button className="back-link" onClick={() => { window.history.back() }}><ArrowRight size={16}/>{t.app.back}</button><div className="join-room-card"><span className="join-room-mark"><Hash size={24}/></span><span className="eyebrow">{t.join.eyebrow}</span><h1>{t.join.title}</h1><p>{t.join.description}</p><form onSubmit={(event) => { event.preventDefault(); if (normalizedCode.length >= 4) authenticated ? onJoin(normalizedCode) : onSignIn(normalizedCode) }}><label htmlFor="room-code">{t.join.codeLabel}</label><div className="room-code-input"><Hash size={20}/><input id="room-code" value={normalizedCode} onChange={(event) => setCode(event.target.value)} placeholder="A1B2C3" maxLength={8} autoComplete="one-time-code" autoCapitalize="characters" dir="ltr"/></div><small>{t.join.codeHint}</small><button className="primary-button join-submit" type="submit" disabled={normalizedCode.length < 4}><DoorOpen size={17}/>{t.join.joinButton}</button></form>{!authenticated && <div className="join-signin-note"><LockKeyhole size={15}/><span>{t.join.signInNote}</span></div>}<button className="join-backup-link" onClick={() => window.location.hash = '#/rooms'}>{t.rooms.createTitle}<ArrowRight size={14}/></button></div></section>
}

export function CreateRoomPage({ games, authenticated, onCreate, onSignIn, onBack }: { games: GameDefinition[]; authenticated: boolean; onCreate: (game: PartyGameId) => void; onSignIn: () => void; onBack: () => void }) {
  const { t } = useLanguage()
  const roomGames = games.filter((game) => game.availability === 'published' && ['mafia', 'tic-tac-toe', 'spyfall', 'uno', 'backgammon', 'ludo', 'codenames'].includes(game.id))
  return <section className="create-room-page"><button className="back-link" onClick={onBack}><ArrowRight size={16}/>{t.app.rooms}</button><Intro eyebrow={t.createRoom.eyebrow} title={t.createRoom.title} description={t.createRoom.description}/>
    <div className="create-room-note"><LockKeyhole size={17}/><span><strong>{t.createRoom.privateLabel}</strong><small>{t.createRoom.privateDescription}</small></span></div>
    {!authenticated && <div className="create-room-auth-note"><span>{t.createRoom.signInNote}</span><button className="secondary-button" onClick={onSignIn}>{t.app.signIn}</button></div>}
    <div className="create-room-grid">{roomGames.map((game) => { const Icon = game.icon; return <button className={`create-room-game accent-${game.accent}`} key={game.id} onClick={() => authenticated && onCreate(game.id)}><img src={game.artwork || fallbackArt} alt="" loading="lazy"/><span className="create-room-game-overlay"/><span className="create-room-game-icon"><Icon size={18}/></span><span className="create-room-game-copy"><strong>{game.title}</strong><small>{game.players} · {game.duration}</small></span><ArrowUpRight size={18}/></button> })}</div>
  </section>
}
