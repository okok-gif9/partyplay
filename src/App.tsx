import { useEffect, useState } from 'react'
import {
  ArrowLeft, Check, ChevronLeft, Grid2X2,
  Link2, MoonStar, Play, Plus, Sparkles,
  Radio, UserPlus, Users, X, Zap,
} from 'lucide-react'
import './App.css'
import './mafia.css'
import './arcade.css'
import './admin.css'
import AppShell from './app/AppShell'
import { type AppLanguage, useLanguage } from './i18n'
import OnlineTicTacToe from './components/OnlineTicTacToe'
import OnlineTicTacToeRoom from './components/OnlineTicTacToeRoom'
import OnlineTruthDare from './components/OnlineTruthDare'
import OnlineTruthDareRoom, { TruthDareRoomSetup } from './components/OnlineTruthDareRoom'
import OnlineMafiaRoom, { MafiaRoomSetup } from './components/OnlineMafiaRoom'
import OnlineMafia from './components/OnlineMafia'
import AdminConsole from './components/AdminConsole'
import ActivityCenter from './components/ActivityCenter'
import OnlineFullGameRoom, { FullGameSetup } from './components/OnlineFullGameRoom'
import OnlineFullGame from './components/OnlineFullGame'
import { useOnlineTicTacToe } from './hooks/useOnlineTicTacToe'
import { useOnlineTruthDare } from './hooks/useOnlineTruthDare'
import { useOnlineMafia } from './hooks/useOnlineMafia'
import { useOnlineFullGame } from './hooks/useOnlineFullGame'
import { usePartyPlayData } from './hooks/usePartyPlayData'
import { useActivityFeed } from './hooks/useActivityFeed'
import { useSessionPlayProgress, type SessionMedal } from './hooks/useSessionPlayProgress'
import { dareCards, shuffledIndexes, truthCards } from './data/truthDareCards'
import { GroupBadge, PlayerAvatar } from './components/SocialIdentity'
import { ProfileSettingsPage, SocialFriendsPage, SocialGroupsPage } from './components/SocialPages'
import OpenSourceArcade from './components/OpenSourceArcade'
import RealTicTacToe from './components/RealTicTacToe'
import RealLudo from './components/RealLudo'
import RealConnectFour from './components/RealConnectFour'
import RealUno from './components/RealUno'
import RealSpyfall from './components/RealSpyfall'
import RealCodenames from './components/RealCodenames'
import RealBackgammon from './components/RealBackgammon'
import RealHokm from './components/RealHokm'
import RealFreecell from './components/RealFreecell'
import { gameById, publicGameCatalog, type GameDefinition, type PartyGameId } from './data/gameCatalog'
import type { ActiveRoomSummary, AdminTestRoom, FullPartyPlayGameType } from './lib/partyplay'

type Page = 'home' | 'games' | 'friends' | 'groups' | 'profile' | 'activity' | 'admin' | 'room' | 'game' | 'arcade-game' | 'truth-setup' | 'truth-room' | 'truth-game' | 'mafia-setup' | 'mafia-room' | 'mafia-game' | 'full-game-setup' | 'full-game-room' | 'full-game'
type ThemePreference = 'system' | 'light' | 'dark'
type GameId = PartyGameId
type PracticePhase = 'setup' | 'playing' | 'finished'

const games: GameDefinition[] = publicGameCatalog

const englishGameCopy: Record<PartyGameId, Pick<GameDefinition, 'title' | 'subtitle' | 'players' | 'duration' | 'tone'>> = {
  mafia: { title: 'Mafia', subtitle: 'Take a role, investigate, vote', players: '5, 7, or 9 players', duration: '15–30 min', tone: 'Hidden roles' },
  'tic-tac-toe': { title: 'Tic-Tac-Toe', subtitle: 'Line up three marks', players: '2 players', duration: '1–3 min', tone: 'Quick match' },
  'truth-dare': { title: 'Truth or Dare', subtitle: 'Paused for content review', players: '2–8 players', duration: 'Open-ended', tone: 'Content review' },
  spyfall: { title: 'Spyfall', subtitle: 'Find the location without exposing yourself', players: '3–8 players', duration: '8–12 min', tone: 'Hidden roles' },
  uno: { title: 'UNO', subtitle: 'Play the right color and number', players: '2–4 players', duration: '6–15 min', tone: 'Cards & competition' },
  pictionary: { title: 'Draw & Guess', subtitle: 'A complete online source is being reviewed', players: '3–8 players', duration: '10–20 min', tone: 'Under research' },
  'connect-four': { title: 'Connect Four', subtitle: 'Removed from PartyPlay Arcade', players: '2 players', duration: '3–7 min', tone: 'Removed' },
  backgammon: { title: 'Backgammon', subtitle: 'Roll dice and bear your pieces home', players: '2 players', duration: '15–30 min', tone: 'Classic & tactical' },
  ludo: { title: 'Ludo', subtitle: 'Race every piece around the board', players: '2–4 players', duration: '10–25 min', tone: 'Luck & competition' },
  codenames: { title: 'Codenames', subtitle: 'Lead your team with one clue', players: '4–8 players', duration: '10–20 min', tone: 'Teams & words' },
  hokm: { title: 'Hokm with bots', subtitle: 'Choose trump, follow suit, and win the tricks', players: '1 player + 3 bots', duration: '15–30 min', tone: 'Cards & tactics' },
  freecell: { title: 'Classic FreeCell', subtitle: 'Move cards through free cells to the foundations', players: 'Single player', duration: '5–20 min', tone: 'Windows nostalgia' },
}

const localizeGame = (game: GameDefinition, language: AppLanguage) => language === 'en' ? { ...game, ...englishGameCopy[game.id] } : game
const fullGameIdByRoomType: Partial<Record<FullPartyPlayGameType, PartyGameId>> = { spyfall: 'spyfall', uno: 'uno', pictionary: 'pictionary', connect_four: 'connect-four', backgammon: 'backgammon', ludo: 'ludo', codenames: 'codenames' }
const fullRoomTypeByGameId: Partial<Record<PartyGameId, FullPartyPlayGameType>> = Object.fromEntries(Object.entries(fullGameIdByRoomType).map(([roomType, gameId]) => [gameId, roomType as FullPartyPlayGameType]))

const avatar = (label: string, tone = 'violet', extra = '') => <span className={`avatar avatar-${tone} ${extra}`} aria-hidden="true">{label}</span>
const initial = (name?: string) => (name || 'ب').trim().charAt(0) || 'ب'

function App() {
  const { language, t } = useLanguage()
  const [page, setPage] = useState<Page>(() => new URLSearchParams(window.location.search).get('view') === 'admin' ? 'admin' : 'home')
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => (localStorage.getItem('partyplay-theme') as ThemePreference) || 'system')
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [selectedGame, setSelectedGame] = useState<GameId>('tic-tac-toe')
  const [toast, setToast] = useState('')
  const [nameDraft, setNameDraft] = useState('')
  const [truthMode, setTruthMode] = useState<'truth' | 'dare'>('truth')
  const [truthOrder, setTruthOrder] = useState(() => shuffledIndexes(truthCards.length))
  const [dareOrder, setDareOrder] = useState(() => shuffledIndexes(dareCards.length))
  const [truthCursor, setTruthCursor] = useState(0)
  const [dareCursor, setDareCursor] = useState(0)
  const [truthDone, setTruthDone] = useState(0)
  const [mafiaPhase, setMafiaPhase] = useState<PracticePhase>('setup')
  const [mafiaRole, setMafiaRole] = useState('')
  const [mafiaVote, setMafiaVote] = useState<string | null>(null)
  const { profile, groups, friends, requests, activeRooms, loading, refresh, updateProfile, lookupProfile, sendFriendRequest, respondToRequest, removeFriend, createGroup, addGroupMember, updateGroupIdentity } = usePartyPlayData()
  const { room: onlineRoom, currentUserId: onlineUserId, pending: onlinePending, createRoom: createOnlineRoom, joinRoom: joinOnlineRoom, start: startOnlineRoom, move: makeOnlineMove, refreshRoom: refreshOnlineTicTacToe } = useOnlineTicTacToe()
  const truthDare = useOnlineTruthDare()
  const mafia = useOnlineMafia()
  const fullGame = useOnlineFullGame()
  const sessionProgress = useSessionPlayProgress()
  const activity = useActivityFeed()

  const activeGame = localizeGame(gameById(selectedGame), language)
  const currentTheme = themePreference === 'system' ? (systemDark ? 'dark' : 'light') : themePreference
  const playerName = profile?.displayName || localStorage.getItem('partyplay-display-name') || 'بازیکن جدید'
  const playerAvatarSeed = profile?.avatarSeed || 'mint'
  const truthIndex = truthMode === 'truth' ? truthOrder[truthCursor] : dareOrder[dareCursor]

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => setSystemDark(query.matches)
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [])
  useEffect(() => { localStorage.setItem('partyplay-theme', themePreference) }, [themePreference])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3600)
    return () => window.clearTimeout(timer)
  }, [toast])
  useEffect(() => { if (profile && !nameDraft) setNameDraft(profile.displayName) }, [profile, nameDraft])
  useEffect(() => {
    const inviteCode = new URLSearchParams(window.location.search).get('room')
    if (!inviteCode || onlineRoom || truthDare.room || mafia.room) return
    void joinOnlineRoom(inviteCode).then((joined) => {
      if (joined.room.game_type === 'truth_or_dare') {
        void truthDare.refreshRoom(joined.room.id).then(() => {
          setSelectedGame('truth-dare')
          setPage(joined.room.status === 'lobby' ? 'truth-room' : 'truth-game')
          setToast('وارد اتاق آنلاین جرئت‌وحقیقت شدی.')
        }).catch(showOnlineError)
        return
      }
      if (joined.room.game_type === 'mafia') {
        void mafia.refreshRoom(joined.room.id).then(() => {
          setSelectedGame('mafia')
          setPage(joined.room.status === 'lobby' ? 'mafia-room' : 'mafia-game')
          setToast('وارد اتاق آنلاین مافیا شدی.')
        }).catch(showOnlineError)
        return
      }
      const fullGameId = fullGameIdByRoomType[joined.room.game_type as FullPartyPlayGameType]
      if (fullGameId) {
        void fullGame.refreshRoom(joined.room.id).then(() => {
          setSelectedGame(fullGameId)
          setPage(joined.room.status === 'lobby' ? 'full-game-room' : 'full-game')
          setToast(`وارد اتاق ${gameById(fullGameId).title} شدی.`)
        }).catch(showOnlineError)
        return
      }
      setSelectedGame('tic-tac-toe')
      setPage('room')
      setToast('وارد لابی دوز شدی.')
    }).catch(showOnlineError)
  }, [fullGame.refreshRoom, fullGame.room, joinOnlineRoom, mafia.refreshRoom, mafia.room, onlineRoom, truthDare.room])

  const showOnlineError = (error: unknown) => setToast(error instanceof Error ? error.message : 'ارتباط با بازی کامل نشد. دوباره تلاش کن.')
  const resetPractice = (game: GameId) => {
    setSelectedGame(game)
    setTruthMode('truth')
    setTruthOrder(shuffledIndexes(truthCards.length))
    setDareOrder(shuffledIndexes(dareCards.length))
    setTruthCursor(0)
    setDareCursor(0)
    setTruthDone(0)
    setMafiaPhase('setup')
    setMafiaRole('')
    setMafiaVote(null)
  }
  const startPractice = (game: GameId) => {
    const definition = gameById(game)
    if (definition.availability !== 'published') {
      setToast('این بازی فعلاً در آرکید قابل شروع نیست.')
      setPage('games')
      return
    }
    sessionProgress.markStarted(game)
    if (game === 'ludo' || game === 'uno' || game === 'spyfall' || game === 'codenames' || game === 'backgammon' || game === 'hokm' || game === 'freecell') {
      setSelectedGame(game)
      setPage('game')
      const readyMessage = game === 'ludo' ? 'منچ با ربات آماده است.' : game === 'uno' ? 'اونو با ربات آماده است.' : game === 'spyfall' ? 'جاسوس برای دورهمی آماده است.' : game === 'codenames' ? 'رمز برای رقابت تیمی آماده است.' : game === 'backgammon' ? 'تخته‌نرد با ربات آماده است.' : game === 'hokm' ? 'حکم با سه ربات آماده است.' : 'فری‌سل کلاسیک آماده است.'
      setToast(readyMessage)
      return
    }
    if (fullRoomTypeByGameId[game]) {
      setSelectedGame(game)
      setPage('arcade-game')
      setToast(`${gameById(game).title} با ربات آماده است.`)
      return
    }
    resetPractice(game)
    setPage('game')
    setToast(game === 'tic-tac-toe' ? 'تمرین دوز با ربات شروع شد.' : `${gameById(game).title} آماده است؛ شروع کن.`)
  }
  const openFriendsGame = (game: GameId) => {
    if (gameById(game).availability !== 'published') {
      setToast('این بازی تا تکمیل بررسی کیفیت، اتاق جدید نمی‌سازد.')
      return
    }
    setSelectedGame(game)
    if (game === 'tic-tac-toe') { createOnlineTicTacToe(); return }
    if (game === 'truth-dare') { setPage('truth-setup'); return }
    if (game === 'mafia') { setPage('mafia-setup'); return }
    if (fullRoomTypeByGameId[game]) setPage('full-game-setup')
  }
  const createOnlineTicTacToe = () => {
    sessionProgress.markStarted('tic-tac-toe')
    setSelectedGame('tic-tac-toe')
    void createOnlineRoom('چالش دوز').then(() => {
      setPage('room')
      setToast('لابی خصوصی آماده شد؛ لینک را برای یک حریف بفرست.')
    }).catch(showOnlineError)
  }
  const createOnlineTruthDare = (capacity: number) => {
    sessionProgress.markStarted('truth-dare')
    setSelectedGame('truth-dare')
    void truthDare.createRoom(capacity).then(() => {
      setPage('truth-room')
      setToast('لابی جرئت‌وحقیقت آماده شد؛ لینک را برای جمع بفرست.')
    }).catch(showOnlineError)
  }
  const createOnlineFullGame = (capacity: number) => {
    const gameType = fullRoomTypeByGameId[selectedGame]
    if (!gameType) return
    sessionProgress.markStarted(selectedGame)
    void fullGame.createRoom(gameType, `میز ${gameById(selectedGame).title}`, capacity).then(() => {
      setPage('full-game-room')
      setToast('لابی خصوصی آماده شد؛ لینک دعوت را برای دوستانت بفرست.')
    }).catch(showOnlineError)
  }
  const createOnlineMafia = (capacity: number) => {
    sessionProgress.markStarted('mafia')
    setSelectedGame('mafia')
    void mafia.createRoom('میز مافیا', capacity).then(() => {
      setPage('mafia-room')
      setToast('لابی مافیا آماده شد؛ لینک دعوت را برای بازیکن‌ها بفرست.')
    }).catch(showOnlineError)
  }
  const resumeActiveRoom = (room: ActiveRoomSummary) => {
    if (room.gameType === 'mafia') {
      setSelectedGame('mafia')
      void mafia.refreshRoom(room.id).then(() => setPage(room.status === 'lobby' ? 'mafia-room' : 'mafia-game')).catch(showOnlineError)
      return
    }
    if (room.gameType === 'truth_or_dare') {
      setSelectedGame('truth-dare')
      void truthDare.refreshRoom(room.id).then(() => setPage(room.status === 'lobby' ? 'truth-room' : 'truth-game')).catch(showOnlineError)
      return
    }
    if (room.gameType === 'tic_tac_toe') {
      setSelectedGame('tic-tac-toe')
      void refreshOnlineTicTacToe(room.id).then(() => setPage(room.status === 'lobby' ? 'room' : 'game')).catch(showOnlineError)
      return
    }
    const gameId = fullGameIdByRoomType[room.gameType as FullPartyPlayGameType]
    if (gameId) {
      setSelectedGame(gameId)
      void fullGame.refreshRoom(room.id).then(() => setPage(room.status === 'lobby' ? 'full-game-room' : 'full-game')).catch(showOnlineError)
    }
  }

  const openAdminRoom = (room: AdminTestRoom) => {
    if (room.game_type === 'mafia') {
      setSelectedGame('mafia')
      void mafia.refreshRoom(room.id).then(() => setPage('mafia-room')).catch(showOnlineError)
      return
    }
    if (room.game_type === 'tic_tac_toe') {
      setSelectedGame('tic-tac-toe')
      void refreshOnlineTicTacToe(room.id).then(() => setPage('room')).catch(showOnlineError)
      return
    }
    const gameId = fullGameIdByRoomType[room.game_type as FullPartyPlayGameType]
    if (gameId) {
      setSelectedGame(gameId)
      void fullGame.refreshRoom(room.id).then(() => setPage('full-game-room')).catch(showOnlineError)
      return
    }
    setToast('این اتاق هنوز رابط سازگار ندارد.')
  }
  const closeAdminConsole = () => {
    const url = new URL(window.location.href)
    url.searchParams.delete('view')
    window.history.replaceState({}, '', url)
    setPage('home')
  }
  const drawCard = (mode: 'truth' | 'dare') => {
    setTruthMode(mode)
    if (mode === 'truth') setTruthCursor((cursor) => cursor + 1 < truthOrder.length ? cursor + 1 : 0)
    else setDareCursor((cursor) => cursor + 1 < dareOrder.length ? cursor + 1 : 0)
  }
  const beginMafia = () => {
    const roles = ['شهروند', 'کارآگاه', 'پزشک', 'مافیا']
    setMafiaRole(roles[Math.floor(Math.random() * roles.length)])
    setMafiaPhase('playing')
    setMafiaVote(null)
  }
  const saveDisplayName = () => {
    void updateProfile({ displayName: nameDraft }).then((next) => { localStorage.setItem('partyplay-display-name', next.displayName); setToast('نام نمایشی‌ات ذخیره شد.') }).catch(showOnlineError)
  }

  const renderPage = () => {
    if (page === 'admin') return <AdminConsole onBack={closeAdminConsole} onOpenPractice={startPractice} onEnterRoom={openAdminRoom} notify={setToast}/>
    if (page === 'games') return <GamesPage onBack={() => setPage('home')} onPractice={startPractice} onFriendsGame={openFriendsGame} onOnlineTicTacToe={createOnlineTicTacToe} started={sessionProgress.started} earnedMedals={sessionProgress.earnedMedals} />
    if (page === 'arcade-game') return <OpenSourceArcade game={activeGame} onBack={() => setPage('games')}/>
    if (page === 'full-game-setup') return <FullGameSetup game={activeGame} pending={fullGame.pending} error={fullGame.error} onCreate={createOnlineFullGame} onBack={() => setPage('games')}/>
    if (page === 'full-game-room' && fullGame.room) return <OnlineFullGameRoom game={activeGame} room={fullGame.room} currentUserId={fullGame.currentUserId} pending={fullGame.pending} error={fullGame.error} onStart={() => void fullGame.start().then(() => setPage('full-game')).catch(showOnlineError)} onBack={() => setPage('games')}/>
    if (page === 'full-game' && fullGame.room?.session) return <OnlineFullGame game={activeGame} room={fullGame.room} currentUserId={fullGame.currentUserId} pending={fullGame.pending} privateState={fullGame.privateState} onSavePrivate={(state) => void fullGame.savePrivateState(state)} onApply={(state, turnUserId, status, eventType) => void fullGame.applyState(state, turnUserId, status, eventType).then(() => sessionProgress.markAction(selectedGame)).catch(showOnlineError)} onBack={() => setPage('games')}/>
    if (page === 'friends') return <SocialFriendsPage onBack={() => setPage('home')} friends={friends} requests={requests} lookupProfile={lookupProfile} sendFriendRequest={sendFriendRequest} respondToRequest={respondToRequest} removeFriend={removeFriend} notify={setToast}/>
    if (page === 'groups') return <SocialGroupsPage onBack={() => setPage('home')} groups={groups} createGroup={createGroup} addGroupMember={addGroupMember} updateGroupIdentity={updateGroupIdentity} notify={setToast}/>
    if (page === 'profile') return <ProfileSettingsPage onBack={() => setPage('home')} profile={profile} loading={loading} onRetry={() => void refresh().catch(showOnlineError)} updateProfile={updateProfile} theme={themePreference} onTheme={setThemePreference} notify={setToast}/>
    if (page === 'activity') return <ActivityCenter items={activity.items} loading={activity.loading} unreadCount={activity.unreadCount} onBack={() => setPage('home')} onMarkAllRead={() => void activity.markAllRead().catch(showOnlineError)} onNavigate={(destination) => setPage(destination)}/>
    if (page === 'room' && onlineRoom) return <OnlineTicTacToeRoom room={onlineRoom} currentUserId={onlineUserId} pending={onlinePending} onBack={() => setPage('home')} onStart={() => void startOnlineRoom().then(() => setPage('game')).catch(showOnlineError)} onInvite={() => { const link = `${window.location.origin}${window.location.pathname}?room=${onlineRoom.room.invite_code}`; if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(link); setToast('لینک دعوت کپی شد.') }} />
    if (page === 'truth-setup') return <TruthDareRoomSetup pending={truthDare.pending} onBack={() => setPage('games')} onCreate={createOnlineTruthDare}/>
    if (page === 'mafia-setup') return <MafiaRoomSetup pending={mafia.pending} error={mafia.error} onCreate={createOnlineMafia}/>
    if (page === 'truth-room' && truthDare.room) return <OnlineTruthDareRoom room={truthDare.room} currentUserId={truthDare.currentUserId} pending={truthDare.pending} onBack={() => setPage('home')} onStart={() => void truthDare.start().then(() => setPage('truth-game')).catch(showOnlineError)} onInvite={() => { const link = `${window.location.origin}${window.location.pathname}?room=${truthDare.room!.room.invite_code}`; if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(link); setToast('لینک دعوت کپی شد.') }}/>
    if (page === 'mafia-room' && mafia.room) return <OnlineMafiaRoom room={mafia.room} currentUserId={mafia.currentUserId} pending={mafia.pending} error={mafia.error} onBack={() => setPage('games')} onStart={() => void mafia.start().then(() => setPage('mafia-game')).catch(showOnlineError)}/>
    if (page === 'truth-game' && truthDare.room?.session && truthDare.currentUserId) return <section className="game-page accent-gold"><div className="game-topline"><button className="back-link" onClick={() => setPage('home')}><ChevronLeft size={17}/>خانه</button><div className="live-status"><span className="pulse-dot"/>بازی آنلاین</div></div><div className="game-header"><div className="game-header-title"><span className="game-icon"><Sparkles size={21}/></span><div><strong>جرئت یا حقیقت</strong><span>{truthDare.room.room.name}</span></div></div></div><OnlineTruthDare room={truthDare.room} session={truthDare.room.session} messages={truthDare.messages} currentUserId={truthDare.currentUserId} pending={truthDare.pending} onChoose={(choice) => void truthDare.choose(choice).then(() => sessionProgress.markAction('truth-dare')).catch(showOnlineError)} onNextTurn={() => void truthDare.nextTurn().then(() => sessionProgress.markAction('truth-dare')).catch(showOnlineError)} onFinish={() => void truthDare.finish().catch(showOnlineError)} onSendMessage={(body) => void truthDare.sendMessage(body).catch(showOnlineError)} onToggleReaction={(messageId, reaction) => void truthDare.toggleReaction(messageId, reaction).catch(showOnlineError)}/></section>
    if (page === 'mafia-game' && mafia.room?.session && mafia.privateView) return <section className="game-page accent-pink"><div className="game-topline"><button className="back-link" onClick={() => setPage('home')}><ChevronLeft size={17}/>خانه</button><div className="live-status"><span className="pulse-dot"/>بازی آنلاین</div></div><OnlineMafia room={mafia.room} view={mafia.privateView} messages={mafia.messages} teamMessages={mafia.teamMessages} speakerReactions={mafia.speakerReactions} currentUserId={mafia.currentUserId} pending={mafia.pending} error={mafia.error} onAcknowledge={() => void mafia.acknowledgeRole().then(() => sessionProgress.markAction('mafia')).catch(showOnlineError)} onSetSpeaking={(mode) => void mafia.setSpeaking(mode).catch(showOnlineError)} onNextSpeaker={() => void mafia.nextSpeaker().catch(showOnlineError)} onSendDayMessage={(body) => void mafia.sendDayMessage(body).catch(showOnlineError)} onReact={(reaction) => void mafia.react(reaction).catch(showOnlineError)} onVote={(choice, targetUserId) => void mafia.vote(choice, targetUserId).catch(showOnlineError)} onResolveVote={() => void mafia.resolveVote().catch(showOnlineError)} onOpenNight={() => void mafia.openNight().catch(showOnlineError)} onSendTeamMessage={(body) => void mafia.sendTeamMessage(body).catch(showOnlineError)} onSubmitNightAction={(targetUserId) => void mafia.submitNightAction(targetUserId).catch(showOnlineError)} onAdvanceNight={() => void mafia.advanceNight().catch(showOnlineError)}/></section>
    if (page === 'game' && selectedGame === 'tic-tac-toe' && !(onlineRoom?.session && onlineUserId)) return <RealTicTacToe onBack={() => setPage('games')} onFriends={createOnlineTicTacToe}/>
    if (page === 'game' && selectedGame === 'ludo') return <RealLudo onBack={() => setPage('games')} onFriends={() => openFriendsGame('ludo')}/>
    if (page === 'game' && selectedGame === 'connect-four') return <RealConnectFour onBack={() => setPage('games')} onFriends={() => openFriendsGame('connect-four')}/>
    if (page === 'game' && selectedGame === 'uno') return <RealUno onBack={() => setPage('games')} onFriends={() => openFriendsGame('uno')}/>
    if (page === 'game' && selectedGame === 'spyfall') return <RealSpyfall onBack={() => setPage('games')} onFriends={() => openFriendsGame('spyfall')}/>
    if (page === 'game' && selectedGame === 'codenames') return <RealCodenames onBack={() => setPage('games')} onFriends={() => openFriendsGame('codenames')}/>
    if (page === 'game' && selectedGame === 'backgammon') return <RealBackgammon onBack={() => setPage('games')} onFriends={() => openFriendsGame('backgammon')}/>
    if (page === 'game' && selectedGame === 'hokm') return <RealHokm onBack={() => setPage('games')}/>
    if (page === 'game' && selectedGame === 'freecell') return <RealFreecell onBack={() => setPage('games')}/>
    if (page === 'game') return <GamePage game={activeGame} onlineRoom={onlineRoom} onlineUserId={onlineUserId} onlinePending={onlinePending} onOnlineMove={(index) => void makeOnlineMove(index).then(() => sessionProgress.markAction('tic-tac-toe')).catch(showOnlineError)} onRestart={() => resetPractice(selectedGame)} truthMode={truthMode} truthIndex={truthIndex} truthDone={truthDone} onDraw={drawCard} onTruthDone={() => { setTruthDone((value) => value + 1); sessionProgress.markAction('truth-dare') }} mafiaPhase={mafiaPhase} mafiaRole={mafiaRole} mafiaVote={mafiaVote} onBeginMafia={beginMafia} onVote={(name) => { setMafiaVote(name); sessionProgress.markAction('mafia') }} onBack={() => setPage('home')} />
    return <HomePage name={playerName} groups={groups} friends={friends} activeRooms={activeRooms} loading={loading} onPractice={startPractice} onFriendsGame={openFriendsGame} onCreateOnline={createOnlineTicTacToe} onOnlineMafia={() => setPage('mafia-setup')} onResumeRoom={resumeActiveRoom} onGames={() => setPage('games')} onGroups={() => setPage('groups')} onFriends={() => setPage('friends')} started={sessionProgress.started} earnedMedals={sessionProgress.earnedMedals} />
  }

  const pageTitle = page === 'home' ? t.app.home
    : page === 'games' ? t.app.games
      : page === 'friends' ? t.app.friends
        : page === 'groups' ? t.app.groups
          : page === 'profile' ? t.app.profile
            : page === 'activity' ? (language === 'fa' ? 'فعالیت‌ها' : 'Activity')
            : page === 'admin' ? (language === 'fa' ? 'مدیریت' : 'Admin')
              : page === 'room' ? t.app.room
              : page === 'game' || page === 'arcade-game' ? activeGame.title
                : page.startsWith('mafia') ? 'مافیا'
                  : t.app.game

  const overlay = <>
    {profile?.displayName === 'بازیکن جدید' && !localStorage.getItem('partyplay-display-name') && <div className="identity-backdrop" role="presentation"><section className="identity-dialog" role="dialog" aria-modal="true" aria-label="انتخاب نام نمایشی"><span className="eyebrow"><Sparkles size={15}/> خوش اومدی</span><h2>دوستات با چه اسمی صدات کنن؟</h2><p>این نام در اتاق‌ها، دعوت‌ها و نتیجهٔ بازی نشان داده می‌شود؛ بعداً هم قابل تغییر است.</p><input className="text-field" autoFocus value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} placeholder="مثلاً کیان" maxLength={40}/><button className="primary-button full-button" onClick={saveDisplayName} disabled={nameDraft.trim().length < 1}>ادامه با این نام</button></section></div>}
    {sessionProgress.newMedal && <MedalCelebration medal={sessionProgress.newMedal} onDismiss={sessionProgress.dismissMedal}/>}
    {toast && <div className="toast"><Check size={18}/><span>{toast}</span><button onClick={() => setToast('')}><X size={16}/></button></div>}
  </>

  return <AppShell activePage={page} pageTitle={pageTitle} theme={currentTheme} playerName={playerName} playerAvatarSeed={playerAvatarSeed} playerPresence={profile?.presence} activityUnread={activity.unreadCount} onThemeToggle={() => setThemePreference(currentTheme === 'dark' ? 'light' : 'dark')} onNavigate={(destination) => setPage(destination)} overlay={overlay}>{renderPage()}</AppShell>
}

function MedalCelebration({ medal, onDismiss }: { medal: SessionMedal; onDismiss: () => void }) {
  useEffect(() => { const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onDismiss() }; window.addEventListener('keydown', closeOnEscape); return () => window.removeEventListener('keydown', closeOnEscape) }, [onDismiss])
  return <div className="medal-backdrop" role="presentation" onClick={onDismiss}><section className={`medal-celebration medal-${medal.accent}`} role="dialog" aria-modal="true" aria-label={`مدال ${medal.title} باز شد`} onClick={(event) => event.stopPropagation()}><button className="medal-close" onClick={onDismiss} aria-label="بستن جشن مدال"><X size={18}/></button><div className="medal-burst" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div><span className="medal-main-icon">{medal.icon}</span><span className="eyebrow">مدال نمایشی باز شد</span><h2>{medal.title}</h2><p>{medal.description}</p><button className="primary-button" onClick={onDismiss}><Check size={17}/>ادامهٔ بازی</button></section></div>
}

function HomePage({ name, groups, friends, activeRooms, loading, onPractice, onFriendsGame, onCreateOnline, onOnlineMafia, onResumeRoom, onGames, onGroups, onFriends, started, earnedMedals }: { name: string; groups: ReturnType<typeof usePartyPlayData>['groups']; friends: ReturnType<typeof usePartyPlayData>['friends']; activeRooms: ActiveRoomSummary[]; loading: boolean; onPractice: (game: GameId) => void; onFriendsGame: (game: GameId) => void; onCreateOnline: () => void; onOnlineMafia: () => void; onResumeRoom: (room: ActiveRoomSummary) => void; onGames: () => void; onGroups: () => void; onFriends: () => void; started: ReturnType<typeof useSessionPlayProgress>['started']; earnedMedals: SessionMedal[] }) {
  const { language, t, format } = useLanguage()
  const isFa = language === 'fa'
  const localizedGames = games.map((game) => localizeGame(game, language))
  const presenceLabel = (presence: 'online' | 'away' | 'busy' | 'offline') => {
    if (isFa) return presence === 'online' ? 'آنلاین' : presence === 'away' ? 'دور از دسترس' : presence === 'busy' ? 'مشغول' : 'آفلاین'
    return presence === 'online' ? 'Online' : presence === 'away' ? 'Away' : presence === 'busy' ? 'Busy' : 'Offline'
  }

  return <>
    <section className="welcome-row"><div><span className="eyebrow"><Sparkles size={15}/> {isFa ? 'حساب تو' : 'YOUR SPACE'}</span><h1>{format(t.home.greeting, { name })}, <span>{t.home.headline}</span></h1><p>{t.home.description}</p></div><button className="primary-button create-button" onClick={onOnlineMafia}><MoonStar size={19}/>{t.home.mafiaRoom}</button></section>
    <section className="quick-play"><div className="quick-content"><div className="quick-copy"><span className="pill"><MoonStar size={14}/> {isFa ? 'نقش مخفی · دورهمی خصوصی' : 'HIDDEN ROLES · PRIVATE PLAY'}</span><h2>{isFa ? 'شهر را برای مافیا جمع کن.' : 'Gather the town for Mafia.'}</h2><p>{isFa ? 'یک اتاق خصوصی ۵، ۷ یا ۹ نفره بساز؛ نقش‌ها، نوبت‌ها و روایت شب و روز با پارتی پلی است.' : 'Create a private room for 5, 7, or 9 players. PartyPlay manages roles, turns, and the night-and-day flow.'}</p><div className="quick-actions"><button className="quick-primary" onClick={onOnlineMafia}><MoonStar size={17}/>{t.home.mafiaRoom}</button><button className="quick-secondary" onClick={onGames}><Link2 size={18}/>{t.home.viewAll}</button></div></div><div className="quick-signal"><span className="quick-signal-dot" aria-hidden="true"/><div><strong>{isFa ? 'اتاق‌های خصوصی' : 'Private rooms'}</strong><span>{isFa ? 'دوستانت را با لینک دعوت کن' : 'Invite friends with one link'}</span></div></div></div></section>
    {activeRooms.length > 0 && <section className="continue-play-panel"><div className="continue-play-heading"><div><span className="eyebrow"><Radio size={14}/>{isFa ? 'ادامهٔ بازی' : 'CONTINUE PLAYING'}</span><h2>{isFa ? 'اتاق‌های فعالت منتظر تو هستند' : 'Your active rooms are waiting'}</h2></div><span>{activeRooms.length}</span></div><div className="continue-room-list">{activeRooms.map((room) => { const gameId = room.gameType === 'tic_tac_toe' ? 'tic-tac-toe' : room.gameType === 'truth_or_dare' ? 'truth-dare' : room.gameType as GameId; const game = localizeGame(gameById(gameId), language); const GameIcon = game.icon; return <button key={room.id} onClick={() => onResumeRoom(room)}><span className={`continue-room-icon accent-${game.accent}`}><GameIcon size={18}/></span><span><strong>{room.name}</strong><small>{game.title} · {room.status === 'lobby' ? (isFa ? 'لابی آمادهٔ ورود' : 'Lobby ready') : (isFa ? 'بازی در جریان' : 'Game in progress')}</small></span><ArrowLeft size={17}/></button> })}</div></section>}
    <section className="section-heading"><div><span className="eyebrow">{t.home.availableGames}</span><h2>{t.home.chooseAndPlay}</h2></div><button className="text-button" onClick={onGames}>{t.home.viewAll} <ArrowLeft size={16}/></button></section>
    <section className="games-grid">{localizedGames.map((game) => <GameCard key={game.id} game={game} action={game.id === 'freecell' ? (isFa ? 'شروع بازی' : 'Start game') : t.games.playBot} friendAction={t.games.friendsRoom} onPlay={() => onPractice(game.id)} onFriendPlay={game.online ? () => onFriendsGame(game.id) : undefined} started={Boolean(started[game.id])} earned={earnedMedals.some((medal) => medal.game === game.id)} />)}</section>
    <section className="dashboard-grid"><div className="panel friends-panel"><div className="panel-heading"><div><span className="eyebrow">{t.home.friends}</span><h2>{friends.length ? (isFa ? 'دوستان آمادهٔ بازی' : 'Friends ready to play') : t.home.noFriends}</h2></div><button className="text-button" onClick={onFriends}>{t.home.manage} <ArrowLeft size={15}/></button></div>{friends.length ? <div className="home-friend-stack">{friends.slice(0, 3).map((friend) => <button key={friend.id} className="home-friend-row" onClick={onFriends}><PlayerAvatar seed={friend.avatarSeed} label={friend.displayName} size="sm" status={friend.presence}/><span><b>{friend.displayName}</b><small dir="ltr">@{friend.username}</small></span><span className={`friend-presence presence-${friend.presence}`}>{presenceLabel(friend.presence)}</span></button>)}</div> : <div className="empty-inline"><UserPlus size={22}/><p>{t.empty.friends}</p><button className="text-button" onClick={onFriends}>{t.home.addFriend} <ArrowLeft size={15}/></button></div>}</div><div className="panel activity-panel"><div className="panel-heading"><div><span className="eyebrow">{t.app.onlineGame}</span><h2>{isFa ? 'دوز دونفره' : 'Two-player Tic-Tac-Toe'}</h2></div></div><div className="empty-inline"><Grid2X2 size={22}/><p>{isFa ? 'اتاق بساز، لینک را بفرست و پس از ورود حریف بازی را شروع کن.' : 'Create a room, share the link, and start once your opponent arrives.'}</p><button className="text-button" onClick={onCreateOnline}>{isFa ? 'ساخت اتاق' : 'Create room'} <ArrowLeft size={15}/></button></div></div></section>
    <section className="section-heading compact-heading"><div><span className="eyebrow">{isFa ? 'جمع‌های همیشگی' : 'YOUR CREWS'}</span><h2>{t.home.groups}</h2></div><button className="text-button" onClick={onGroups}>{t.home.manage} <ArrowLeft size={16}/></button></section>
    {loading ? <div className="panel loading-panel">{t.app.loading}</div> : groups.length ? <section className="groups-strip">{groups.map((group) => <button className="group-card group-violet" key={group.id} onClick={onGroups}><GroupBadge seed={group.avatarSeed}/><span><strong>{group.name}</strong><small>{group.memberCount} {isFa ? 'عضو' : 'members'}</small></span><ChevronLeft size={18}/></button>)}<button className="group-add" onClick={onGroups}><Plus size={21}/><span>{t.home.createGroup}</span></button></section> : <button className="empty-group-cta" onClick={onGroups}><span><Plus size={22}/></span><strong>{t.home.noGroups}</strong><small>{t.empty.groups}</small></button>}
  </>
}

function GameCard({ game, action, onPlay, friendAction, onFriendPlay, started = false, earned = false }: { game: GameDefinition; action: string; onPlay: () => void; friendAction?: string; onFriendPlay?: () => void; started?: boolean; earned?: boolean }) { const { language } = useLanguage(); const Icon = game.icon; const status = earned ? (language === 'fa' ? 'تجربه شد' : 'Played') : started ? (language === 'fa' ? 'در حال بازی' : 'In progress') : (language === 'fa' ? 'امتحانش کن' : 'Ready'); return <article className={`game-card accent-${game.accent} ${earned ? 'game-experienced' : ''}`}><div className="game-card-top"><div className="game-icon"><Icon size={23}/></div><span className="game-status">{status}</span><span className="game-art">{game.art}</span></div><div className="game-card-copy"><p>{game.tone}</p><h3>{game.title}</h3><span>{game.subtitle}</span></div><div className="game-card-bottom"><div><small><Users size={14}/>{game.players}</small><small>· {game.duration}</small></div><div className="game-card-actions"><button onClick={onPlay}><Play size={16} fill="currentColor"/>{action}</button>{onFriendPlay && <button className="card-friend-button" onClick={onFriendPlay}><Link2 size={14}/>{friendAction || (language === 'fa' ? 'با دوستان' : 'With friends')}</button>}</div></div></article> }

function GamesPage({ onBack, onPractice, onFriendsGame, onOnlineTicTacToe, started, earnedMedals }: { onBack: () => void; onPractice: (game: GameId) => void; onFriendsGame: (game: GameId) => void; onOnlineTicTacToe: () => void; started: ReturnType<typeof useSessionPlayProgress>['started']; earnedMedals: SessionMedal[] }) { const { language, t } = useLanguage(); const isFa = language === 'fa'; const localizedGames = games.map((game) => localizeGame(game, language)); return <section className="sub-page"><PageTitle eyebrow={isFa ? 'بازی کن' : 'PLAY'} title={t.games.title} description={t.games.description} onBack={onBack}/><div className="all-games-grid">{localizedGames.map((game) => <GameCard game={game} key={game.id} action={game.id === 'freecell' ? (isFa ? 'شروع بازی' : 'Start game') : t.games.playBot} friendAction={t.games.friendsRoom} onPlay={() => onPractice(game.id)} onFriendPlay={game.online ? () => onFriendsGame(game.id) : undefined} started={Boolean(started[game.id])} earned={earnedMedals.some((medal) => medal.game === game.id)}/>)}</div><section className="mode-panel"><div><span className="eyebrow">{isFa ? 'دوز واقعی دونفره' : 'REAL TWO-PLAYER MATCH'}</span><h2>{isFa ? 'برای رقابت با دوستت، لینک اختصاصی بساز' : 'Create a private link and challenge a friend.'}</h2></div><button className="primary-button" onClick={onOnlineTicTacToe}><Link2 size={18}/>{isFa ? 'ساخت اتاق آنلاین' : 'Create online room'}</button></section></section> }

function GamePage({ game, onlineRoom, onlineUserId, onlinePending, onOnlineMove, onRestart, truthMode, truthIndex, truthDone, onDraw, onTruthDone, mafiaPhase, mafiaRole, mafiaVote, onBeginMafia, onVote, onBack }: { game: GameDefinition; onlineRoom: ReturnType<typeof useOnlineTicTacToe>['room']; onlineUserId: string | null; onlinePending: boolean; onOnlineMove: (index: number) => void; onRestart: () => void; truthMode: 'truth'|'dare'; truthIndex: number; truthDone: number; onDraw: (mode: 'truth'|'dare') => void; onTruthDone: () => void; mafiaPhase: PracticePhase; mafiaRole: string; mafiaVote: string | null; onBeginMafia: () => void; onVote: (name: string) => void; onBack: () => void }) {
  const Icon = game.icon
  const hasOnlineTicTacToe = game.id === 'tic-tac-toe' && onlineRoom?.session && onlineUserId
  return <section className={`game-page accent-${game.accent}`}><div className="game-topline"><button className="back-link" onClick={onBack}><ChevronLeft size={17}/>خانه</button><div className="live-status"><span className="pulse-dot"/>{hasOnlineTicTacToe ? 'بازی آنلاین' : 'تمرین قابل‌بازی'}</div></div><div className="game-header"><div className="game-header-title"><span className="game-icon"><Icon size={21}/></span><div><strong>{game.title}</strong><span>{hasOnlineTicTacToe ? onlineRoom.room.name : 'شروع فوری'}</span></div></div><button className="secondary-button" onClick={onRestart}><Zap size={16}/>شروع دوباره</button></div>{hasOnlineTicTacToe ? <OnlineTicTacToe room={onlineRoom} session={onlineRoom.session!} currentUserId={onlineUserId} pending={onlinePending} onMove={onOnlineMove} onRematch={onRestart}/> : game.id === 'truth-dare' ? <TruthDare mode={truthMode} index={truthIndex} done={truthDone} onDraw={onDraw} onDone={onTruthDone}/> : <MafiaPractice phase={mafiaPhase} role={mafiaRole} vote={mafiaVote} onBegin={onBeginMafia} onVote={onVote}/>}</section>
}

function TruthDare({ mode, index, done, onDraw, onDone }: { mode: 'truth'|'dare'; index: number; done: number; onDraw: (mode: 'truth'|'dare') => void; onDone: () => void }) { const deck = mode === 'truth' ? truthCards : dareCards; const card = deck[index] || deck[0]; return <div className="practice-stage truth-stage"><span className="preview-symbol"><Sparkles size={48}/></span><div className="truth-card-meta"><span className="pill">کارت {mode === 'truth' ? 'حقیقت' : 'جرئت'}</span><span className={`difficulty-chip ${card.level === 'چالشی و جسورانه' ? 'difficulty-bold' : ''}`}>{card.level}</span></div><div className="truth-card-motion" key={`${mode}-${index}`}><h2>«{card.text}»</h2><p>اختیار کامل با توست؛ انجامش بده، ردش کن یا کارت بعدی را بکش.</p></div><div className="preview-actions truth-choice-actions"><button className={`secondary-button ${mode === 'truth' ? 'choice-active' : ''}`} onClick={() => onDraw('truth')}>حقیقت بعدی</button><button className={`primary-button ${mode === 'dare' ? 'choice-active' : ''}`} onClick={() => onDraw('dare')}>جرئت بعدی</button></div><div className="truth-card-footer"><button className="text-button" onClick={() => onDraw(mode)}><ChevronLeft size={17}/>رد کردن</button><button className="secondary-button" onClick={() => { onDone(); onDraw(mode) }}><Check size={17}/>انجام شد · {done}</button></div></div> }

function MafiaPractice({ phase, role, vote, onBegin, onVote }: { phase: PracticePhase; role: string; vote: string | null; onBegin: () => void; onVote: (name: string) => void }) { const suspects = ['رها', 'نیلا', 'مانی', 'آرین']; if (phase === 'setup') return <div className="practice-stage mafia-stage"><span className="preview-symbol"><MoonStar size={48}/></span><span className="pill">تمرین نقش‌ها</span><h2>نقش محرمانه‌ات را بگیر</h2><p>این تمرین منطق اصلی مافیا—نقش، روز و رأی—را بدون انتظار برای بازیکن‌های دیگر نشان می‌دهد.</p><button className="primary-button" onClick={onBegin}><Play size={17}/>شروع دور تمرینی</button></div>; if (vote) return <div className="practice-stage mafia-stage"><span className="preview-symbol"><Check size={48}/></span><h2>رأی تو ثبت شد</h2><p>به {vote} رأی دادی. در بازی آنلاین، پس از رأی همه نتیجه نمایش داده می‌شود.</p><button className="secondary-button" onClick={onBegin}>دور تازه</button></div>; return <div className="practice-stage mafia-stage"><span className="pill">نقش تو: {role}</span><h2>روز اول؛ وقت رأی</h2><p>به کسی رأی بده که بیشتر به او شک داری.</p><div className="suspect-grid">{suspects.map((suspect) => <button key={suspect} onClick={() => onVote(suspect)}>{avatar(initial(suspect),'violet')}<span>{suspect}</span></button>)}</div></div> }

function PageTitle({ eyebrow, title, description, onBack }: { eyebrow: string; title: string; description: string; onBack: () => void }) { return <div className="page-title"><button className="back-link" onClick={onBack}><ChevronLeft size={17}/>خانه</button><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div> }

export default App
