import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import {
  Check, ChevronLeft, LockKeyhole,
  MoonStar, Play, Sparkles,
  X, Zap,
} from 'lucide-react'
import './App.css'
import './mafia.css'
import './arcade.css'
import './admin.css'
import AppShell from './app/AppShell'
import AuthGate, { useAuthGate } from './components/AuthGate'
import { resolveAppRoute, routeHref, type AppPage } from './app/routes'
import { type AppLanguage, useLanguage } from './i18n'
const OnlineTicTacToe = lazy(() => import('./components/OnlineTicTacToe'))
const OnlineTicTacToeRoom = lazy(() => import('./components/OnlineTicTacToeRoom'))
const OnlineTruthDare = lazy(() => import('./components/OnlineTruthDare'))
const OnlineTruthDareRoom = lazy(() => import('./components/OnlineTruthDareRoom'))
const TruthDareRoomSetup = lazy(() => import('./components/OnlineTruthDareRoom').then((module) => ({ default: module.TruthDareRoomSetup })))
const OnlineMafiaRoom = lazy(() => import('./components/OnlineMafiaRoom'))
const MafiaRoomSetup = lazy(() => import('./components/OnlineMafiaRoom').then((module) => ({ default: module.MafiaRoomSetup })))
const OnlineMafia = lazy(() => import('./components/OnlineMafia'))
const AdminConsole = lazy(() => import('./components/AdminConsole'))
const ActivityCenter = lazy(() => import('./components/ActivityCenter'))
const OnlineFullGameRoom = lazy(() => import('./components/OnlineFullGameRoom'))
const FullGameSetup = lazy(() => import('./components/OnlineFullGameRoom').then((module) => ({ default: module.FullGameSetup })))
const OnlineFullGame = lazy(() => import('./components/OnlineFullGame'))
import { useOnlineTicTacToe } from './hooks/useOnlineTicTacToe'
import { useOnlineTruthDare } from './hooks/useOnlineTruthDare'
import { useOnlineMafia } from './hooks/useOnlineMafia'
import { useOnlineFullGame } from './hooks/useOnlineFullGame'
import { usePartyPlayData } from './hooks/usePartyPlayData'
import { useActivityFeed } from './hooks/useActivityFeed'
import { useSessionPlayProgress, type SessionMedal } from './hooks/useSessionPlayProgress'
import { dareCards, shuffledIndexes, truthCards } from './data/truthDareCards'
const ProfileSettingsPage = lazy(() => import('./components/SocialPages').then((module) => ({ default: module.ProfileSettingsPage })))
const SocialFriendsPage = lazy(() => import('./components/SocialPages').then((module) => ({ default: module.SocialFriendsPage })))
const SocialGroupsPage = lazy(() => import('./components/SocialPages').then((module) => ({ default: module.SocialGroupsPage })))
const OpenSourceArcade = lazy(() => import('./components/OpenSourceArcade'))
const RealTicTacToe = lazy(() => import('./components/RealTicTacToe'))
const RealLudo = lazy(() => import('./components/RealLudo'))
const RealConnectFour = lazy(() => import('./components/RealConnectFour'))
const RealUno = lazy(() => import('./components/RealUno'))
const RealSpyfall = lazy(() => import('./components/RealSpyfall'))
const RealCodenames = lazy(() => import('./components/RealCodenames'))
const RealBackgammon = lazy(() => import('./components/RealBackgammon'))
const RealHokm = lazy(() => import('./components/RealHokm'))
const RealFreecell = lazy(() => import('./components/RealFreecell'))
const HomePage = lazy(() => import('./components/PlayPages').then((module) => ({ default: module.HomePage })))
const GamesPage = lazy(() => import('./components/PlayPages').then((module) => ({ default: module.GamesPage })))
const GameDetailsPage = lazy(() => import('./components/PlayPages').then((module) => ({ default: module.GameDetailsPage })))
const RoomsPage = lazy(() => import('./components/PlayPages').then((module) => ({ default: module.RoomsPage })))
const JoinRoomPage = lazy(() => import('./components/PlayPages').then((module) => ({ default: module.JoinRoomPage })))
const CreateRoomPage = lazy(() => import('./components/PlayPages').then((module) => ({ default: module.CreateRoomPage })))
import { gameById, publicGameCatalog, type GameDefinition, type PartyGameId } from './data/gameCatalog'
import type { ActiveRoomSummary, AdminTestRoom, FullPartyPlayGameType } from './lib/partyplay'

type Page = AppPage
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

function PartyPlayApp() {
  const { language, t } = useLanguage()
  const { isAuthenticated, openAuth } = useAuthGate()
  const [initialRoute] = useState(resolveAppRoute)
  const [page, setPageState] = useState<Page>(initialRoute.page)
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => (localStorage.getItem('partyplay-theme') as ThemePreference) || 'system')
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [selectedGame, setSelectedGameState] = useState<GameId>(initialRoute.game)
  const selectedGameRef = useRef<GameId>(initialRoute.game)
  const setSelectedGame = (game: GameId) => { selectedGameRef.current = game; setSelectedGameState(game) }
  const setPage = (nextPage: Page) => {
    setPageState(nextPage)
    const url = new URL(window.location.href)
    if (nextPage !== 'admin') url.searchParams.delete('view')
    window.history.pushState({}, '', `${url.pathname}${url.search}${routeHref(nextPage, selectedGameRef.current)}`)
  }
  const [toast, setToast] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [browserOnline, setBrowserOnline] = useState(() => navigator.onLine)
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
  const localizedGames = games.map((game) => localizeGame(game, language))
  const currentTheme = themePreference === 'system' ? (systemDark ? 'dark' : 'light') : themePreference
  const defaultPlayerName = language === 'fa' ? 'بازیکن جدید' : 'New player'
  const storedPlayerName = localStorage.getItem('partyplay-display-name')
  const playerName = profile?.displayName === 'بازیکن جدید' ? defaultPlayerName : profile?.displayName || storedPlayerName || defaultPlayerName
  const playerAvatarSeed = profile?.avatarSeed || 'mint'
  const truthIndex = truthMode === 'truth' ? truthOrder[truthCursor] : dareOrder[dareCursor]

  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true)
    const handleOffline = () => setBrowserOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline) }
  }, [])
  useEffect(() => {
    const syncRoute = () => {
      const route = resolveAppRoute()
      selectedGameRef.current = route.game
      setSelectedGameState(route.game)
      setPageState(route.page)
    }
    window.addEventListener('popstate', syncRoute)
    window.addEventListener('hashchange', syncRoute)
    return () => { window.removeEventListener('popstate', syncRoute); window.removeEventListener('hashchange', syncRoute) }
  }, [])
  useEffect(() => {
    if (!isAuthenticated) return
    const pendingGame = sessionStorage.getItem('partyplay-pending-game')
    const pendingPage = sessionStorage.getItem('partyplay-pending-page')
    if (pendingGame && games.some((game) => game.id === pendingGame)) {
      sessionStorage.removeItem('partyplay-pending-game')
      setSelectedGame(pendingGame as GameId)
    }
    if (pendingPage && ['friends', 'groups', 'profile', 'activity', 'games', 'rooms', 'create-room', 'join', 'game-details'].includes(pendingPage)) {
      sessionStorage.removeItem('partyplay-pending-page')
      setPage(pendingPage as Page)
    }
  }, [isAuthenticated])
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
    const queryCode = new URLSearchParams(window.location.search).get('room')
    const inviteCode = queryCode || (page === 'join' ? localStorage.getItem('partyplay-pending-room-code') : null)
    if (!inviteCode || onlineRoom || truthDare.room || mafia.room) return
    if (!isAuthenticated) {
      if (queryCode) {
        localStorage.setItem('partyplay-pending-room-code', inviteCode)
        if (page !== 'join') setPage('join')
      }
      return
    }
    void joinOnlineRoom(inviteCode).then((joined) => {
      localStorage.removeItem('partyplay-pending-room-code')
      const nextUrl = new URL(window.location.href)
      nextUrl.searchParams.delete('room')
      window.history.replaceState({}, '', nextUrl)
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
  }, [fullGame.refreshRoom, fullGame.room, isAuthenticated, joinOnlineRoom, mafia.refreshRoom, mafia.room, onlineRoom, page, truthDare.room])

  const showOnlineError = (error: unknown) => {
    const message = error instanceof Error ? error.message : ''
    if (/NOT_AUTHENTICATED/i.test(message)) { setToast(t.join.signInNote); if (!isAuthenticated) openAuth(); return }
    setToast(message || (language === 'fa' ? 'ارتباط با بازی کامل نشد. دوباره تلاش کن.' : 'We could not connect to the game. Please try again.'))
  }
  const enterJoinedRoom = (joined: Awaited<ReturnType<typeof joinOnlineRoom>>) => {
    if (joined.room.game_type === 'truth_or_dare') {
      void truthDare.refreshRoom(joined.room.id).then(() => { setSelectedGame('truth-dare'); setPage(joined.room.status === 'lobby' ? 'truth-room' : 'truth-game') }).catch(showOnlineError)
      return
    }
    if (joined.room.game_type === 'mafia') {
      void mafia.refreshRoom(joined.room.id).then(() => { setSelectedGame('mafia'); setPage(joined.room.status === 'lobby' ? 'mafia-room' : 'mafia-game') }).catch(showOnlineError)
      return
    }
    const fullGameId = fullGameIdByRoomType[joined.room.game_type as FullPartyPlayGameType]
    if (fullGameId) {
      void fullGame.refreshRoom(joined.room.id).then(() => { setSelectedGame(fullGameId); setPage(joined.room.status === 'lobby' ? 'full-game-room' : 'full-game') }).catch(showOnlineError)
      return
    }
    setSelectedGame('tic-tac-toe')
    void refreshOnlineTicTacToe(joined.room.id).then(() => setPage(joined.room.status === 'lobby' ? 'room' : 'game')).catch(showOnlineError)
  }
  const joinRoomByCode = (code: string) => {
    localStorage.setItem('partyplay-pending-room-code', code)
    if (!isAuthenticated) { openAuth(); return }
    void joinOnlineRoom(code).then((joined) => { localStorage.removeItem('partyplay-pending-room-code'); enterJoinedRoom(joined) }).catch(showOnlineError)
  }
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
    if (!isAuthenticated) {
      sessionStorage.setItem('partyplay-pending-page', page)
      sessionStorage.setItem('partyplay-pending-game', game)
      openAuth()
      return
    }
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
    if (!isAuthenticated) { openAuth(); return }
    sessionProgress.markStarted('tic-tac-toe')
    setSelectedGame('tic-tac-toe')
    void createOnlineRoom('چالش دوز').then(() => {
      setPage('room')
      setToast('لابی خصوصی آماده شد؛ دوستت می‌تواند از فهرست اتاق‌ها یا با کد کوتاه وارد شود.')
    }).catch(showOnlineError)
  }
  const createOnlineTruthDare = (capacity: number) => {
    if (!isAuthenticated) { openAuth(); return }
    sessionProgress.markStarted('truth-dare')
    setSelectedGame('truth-dare')
    void truthDare.createRoom(capacity).then(() => {
      setPage('truth-room')
      setToast('لابی جرئت‌وحقیقت آماده شد؛ لینک را برای جمع بفرست.')
    }).catch(showOnlineError)
  }
  const createOnlineFullGame = (capacity: number) => {
    if (!isAuthenticated) { openAuth(); return }
    const gameType = fullRoomTypeByGameId[selectedGame]
    if (!gameType) return
    sessionProgress.markStarted(selectedGame)
    void fullGame.createRoom(gameType, `میز ${gameById(selectedGame).title}`, capacity).then(() => {
      setPage('full-game-room')
      setToast('لابی خصوصی آماده شد؛ لینک دعوت را برای دوستانت بفرست.')
    }).catch(showOnlineError)
  }
  const createOnlineMafia = (capacity: number) => {
    if (!isAuthenticated) { openAuth(); return }
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
    if (!isAuthenticated && ['friends', 'groups', 'profile', 'activity'].includes(page)) return <section className="account-access-prompt"><span className="account-access-icon"><LockKeyhole size={22}/></span><span className="eyebrow">{t.app.guestMode}</span><h1>{t.app.signInRequired}</h1><p>{t.app.signInRequiredDescription}</p><button className="primary-button" onClick={openAuth}>{t.app.signIn}</button></section>
    if (page === 'home') return <HomePage browserOnline={browserOnline} name={playerName} activeRooms={activeRooms} onPractice={startPractice} onGameDetails={(game) => { setSelectedGame(game); setPage('game-details') }} onFriendsGame={openFriendsGame} onCreateRoom={() => setPage('create-room')} onJoinRoom={() => setPage('join')} onGames={() => setPage('games')} onRooms={() => setPage('rooms')} onResumeRoom={resumeActiveRoom} games={localizedGames} started={sessionProgress.started} earnedMedals={sessionProgress.earnedMedals}/>
    if (page === 'rooms') return <RoomsPage activeRooms={activeRooms} authenticated={isAuthenticated} onCreateRoom={() => setPage('create-room')} onJoinRoom={() => setPage('join')} onResumeRoom={resumeActiveRoom} onSignIn={openAuth}/>
    if (page === 'join') return <JoinRoomPage authenticated={isAuthenticated} onJoin={joinRoomByCode} onSignIn={joinRoomByCode}/>
    if (page === 'create-room') return <CreateRoomPage games={localizedGames} authenticated={isAuthenticated} onCreate={openFriendsGame} onSignIn={openAuth} onBack={() => setPage('rooms')}/>
    if (page === 'game-details') return <GameDetailsPage game={activeGame} onBack={() => setPage('games')} onPractice={() => startPractice(selectedGame)} onFriendsGame={() => openFriendsGame(selectedGame)}/>
    if (page === 'games') return <GamesPage games={localizedGames} onPractice={startPractice} onGameDetails={(game) => { setSelectedGame(game); setPage('game-details') }} onFriendsGame={openFriendsGame} onCreateRoom={() => setPage('create-room')} onJoinRoom={() => setPage('join')} started={sessionProgress.started} earnedMedals={sessionProgress.earnedMedals} searchQuery={searchQuery} onSearchQuery={setSearchQuery}/>
    if (page === 'admin') return <AdminConsole onBack={closeAdminConsole} onOpenPractice={startPractice} onEnterRoom={openAdminRoom} notify={setToast}/>
    if (page === 'arcade-game') return <OpenSourceArcade game={activeGame} onBack={() => setPage('games')}/>
    if (page === 'full-game-setup') return <FullGameSetup game={activeGame} pending={fullGame.pending} error={fullGame.error} onCreate={createOnlineFullGame} onBack={() => setPage('games')}/>
    if (page === 'full-game-room' && fullGame.room) return <OnlineFullGameRoom game={activeGame} room={fullGame.room} currentUserId={fullGame.currentUserId} pending={fullGame.pending} error={fullGame.error} onStart={() => void fullGame.start().then(() => setPage('full-game')).catch(showOnlineError)} onBack={() => setPage('games')}/>
    if (page === 'full-game' && fullGame.room?.session) return <OnlineFullGame game={activeGame} room={fullGame.room} currentUserId={fullGame.currentUserId} pending={fullGame.pending} privateState={fullGame.privateState} onSavePrivate={(state) => void fullGame.savePrivateState(state)} onApply={(state, turnUserId, status, eventType) => void fullGame.applyState(state, turnUserId, status, eventType).then(() => sessionProgress.markAction(selectedGame)).catch(showOnlineError)} onBack={() => setPage('games')}/>
    if (page === 'friends') return <SocialFriendsPage onBack={() => setPage('home')} friends={friends} requests={requests} lookupProfile={lookupProfile} sendFriendRequest={sendFriendRequest} respondToRequest={respondToRequest} removeFriend={removeFriend} onSocialChange={() => void refresh()} notify={setToast}/>
    if (page === 'groups') return <SocialGroupsPage onBack={() => setPage('home')} groups={groups} createGroup={createGroup} addGroupMember={addGroupMember} updateGroupIdentity={updateGroupIdentity} notify={setToast}/>
    if (page === 'profile') return <ProfileSettingsPage onBack={() => setPage('home')} profile={profile} loading={loading} onRetry={() => void refresh().catch(showOnlineError)} updateProfile={updateProfile} theme={themePreference} onTheme={setThemePreference} notify={setToast}/>
    if (page === 'activity') return <ActivityCenter items={activity.items} loading={activity.loading} unreadCount={activity.unreadCount} onBack={() => setPage('home')} onMarkAllRead={() => void activity.markAllRead().catch(showOnlineError)} onNavigate={(destination) => setPage(destination)}/>
    if (page === 'room' && onlineRoom) return <OnlineTicTacToeRoom room={onlineRoom} currentUserId={onlineUserId} pending={onlinePending} onBack={() => setPage('home')} onStart={() => void startOnlineRoom().then(() => setPage('game')).catch(showOnlineError)} onInvite={() => { if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(onlineRoom.room.invite_code); setToast('کد کوتاه اتاق کپی شد؛ لینک لازم نیست.') }} />
    if (page === 'truth-setup') return <TruthDareRoomSetup pending={truthDare.pending} onBack={() => setPage('games')} onCreate={createOnlineTruthDare}/>
    if (page === 'mafia-setup') return <MafiaRoomSetup pending={mafia.pending} error={mafia.error} onCreate={createOnlineMafia}/>
    if (page === 'truth-room' && truthDare.room) return <OnlineTruthDareRoom room={truthDare.room} currentUserId={truthDare.currentUserId} pending={truthDare.pending} onBack={() => setPage('home')} onStart={() => void truthDare.start().then(() => setPage('truth-game')).catch(showOnlineError)} onInvite={() => { const link = `${window.location.origin}${window.location.pathname}?room=${truthDare.room!.room.invite_code}`; if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(link); setToast('لینک دعوت کپی شد.') }}/>
    if (page === 'mafia-room' && mafia.room) return <OnlineMafiaRoom room={mafia.room} currentUserId={mafia.currentUserId} pending={mafia.pending} error={mafia.error} onBack={() => setPage('games')} onStart={() => void mafia.start().then(() => setPage('mafia-game')).catch(showOnlineError)}/>
    if (page === 'truth-game' && truthDare.room?.session && truthDare.currentUserId) return <section className="game-page accent-gold"><div className="game-topline"><button className="back-link" onClick={() => setPage('home')}><ChevronLeft size={17}/>خانه</button><div className="live-status"><span className="pulse-dot"/>بازی آنلاین</div></div><div className="game-header"><div className="game-header-title"><span className="game-icon"><Sparkles size={21}/></span><div><strong>جرئت یا حقیقت</strong><span>{truthDare.room.room.name}</span></div></div></div><OnlineTruthDare room={truthDare.room} session={truthDare.room.session} messages={truthDare.messages} currentUserId={truthDare.currentUserId} pending={truthDare.pending} onChoose={(choice) => void truthDare.choose(choice).then(() => sessionProgress.markAction('truth-dare')).catch(showOnlineError)} onNextTurn={() => void truthDare.nextTurn().then(() => sessionProgress.markAction('truth-dare')).catch(showOnlineError)} onFinish={() => void truthDare.finish().catch(showOnlineError)} onSendMessage={(body) => void truthDare.sendMessage(body).catch(showOnlineError)} onToggleReaction={(messageId, reaction) => void truthDare.toggleReaction(messageId, reaction).catch(showOnlineError)}/></section>
    if (page === 'mafia-game' && mafia.room?.session && mafia.privateView) return <section className="game-page accent-pink"><div className="game-topline"><button className="back-link" onClick={() => setPage('home')}><ChevronLeft size={17}/>خانه</button><div className="live-status"><span className="pulse-dot"/>بازی آنلاین</div></div><OnlineMafia room={mafia.room} view={mafia.privateView} messages={mafia.messages} teamMessages={mafia.teamMessages} speakerReactions={mafia.speakerReactions} currentUserId={mafia.currentUserId} pending={mafia.pending} error={mafia.error} onAcknowledge={() => void mafia.acknowledgeRole().then(() => sessionProgress.markAction('mafia')).catch(showOnlineError)} onSetSpeaking={(mode) => void mafia.setSpeaking(mode).catch(showOnlineError)} onNextSpeaker={() => void mafia.nextSpeaker().catch(showOnlineError)} onSendDayMessage={(body) => void mafia.sendDayMessage(body).catch(showOnlineError)} onReact={(reaction) => void mafia.react(reaction).catch(showOnlineError)} onVote={(choice, targetUserId) => void mafia.vote(choice, targetUserId).catch(showOnlineError)} onResolveVote={() => void mafia.resolveVote().catch(showOnlineError)} onOpenNight={() => void mafia.openNight().catch(showOnlineError)} onSendTeamMessage={(body) => void mafia.sendTeamMessage(body).catch(showOnlineError)} onSubmitNightAction={(targetUserId) => void mafia.submitNightAction(targetUserId).catch(showOnlineError)} onAdvanceNight={() => void mafia.advanceNight().catch(showOnlineError)}/></section>
    if (page === 'game' && selectedGame === 'tic-tac-toe' && !(onlineRoom?.session && onlineUserId)) return <RealTicTacToe onBack={() => setPage('games')} onFriends={() => openFriendsGame('tic-tac-toe')}/>
    if (page === 'game' && selectedGame === 'ludo') return <RealLudo onBack={() => setPage('games')} onFriends={() => openFriendsGame('ludo')}/>
    if (page === 'game' && selectedGame === 'connect-four') return <RealConnectFour onBack={() => setPage('games')} onFriends={() => openFriendsGame('connect-four')}/>
    if (page === 'game' && selectedGame === 'uno') return <RealUno onBack={() => setPage('games')} onFriends={() => openFriendsGame('uno')}/>
    if (page === 'game' && selectedGame === 'spyfall') return <RealSpyfall onBack={() => setPage('games')} onFriends={() => openFriendsGame('spyfall')}/>
    if (page === 'game' && selectedGame === 'codenames') return <RealCodenames onBack={() => setPage('games')} onFriends={() => openFriendsGame('codenames')}/>
    if (page === 'game' && selectedGame === 'backgammon') return <RealBackgammon onBack={() => setPage('games')} onFriends={() => openFriendsGame('backgammon')}/>
    if (page === 'game' && selectedGame === 'hokm') return <RealHokm onBack={() => setPage('games')}/>
    if (page === 'game' && selectedGame === 'freecell') return <RealFreecell onBack={() => setPage('games')}/>
    if (page === 'game') return <GamePage game={activeGame} onlineRoom={onlineRoom} onlineUserId={onlineUserId} onlinePending={onlinePending} onOnlineMove={(index) => void makeOnlineMove(index).then(() => sessionProgress.markAction('tic-tac-toe')).catch(showOnlineError)} onRestart={() => resetPractice(selectedGame)} truthMode={truthMode} truthIndex={truthIndex} truthDone={truthDone} onDraw={drawCard} onTruthDone={() => { setTruthDone((value) => value + 1); sessionProgress.markAction('truth-dare') }} mafiaPhase={mafiaPhase} mafiaRole={mafiaRole} mafiaVote={mafiaVote} onBeginMafia={beginMafia} onVote={(name) => { setMafiaVote(name); sessionProgress.markAction('mafia') }} onBack={() => setPage('home')} />
    return <HomePage browserOnline={browserOnline} name={playerName} activeRooms={activeRooms} onPractice={startPractice} onGameDetails={(game) => { setSelectedGame(game); setPage('game-details') }} onFriendsGame={openFriendsGame} onCreateRoom={() => setPage('create-room')} onJoinRoom={() => setPage('join')} onGames={() => setPage('games')} onRooms={() => setPage('rooms')} onResumeRoom={resumeActiveRoom} games={localizedGames} started={sessionProgress.started} earnedMedals={sessionProgress.earnedMedals}/>
  }

  const pageTitle = page === 'home' ? t.app.home
    : page === 'games' || page === 'game-details' ? t.app.games
      : page === 'rooms' || page === 'create-room' ? t.app.rooms
        : page === 'join' ? t.app.join
      : page === 'friends' ? t.app.friends
        : page === 'groups' ? t.app.groups
          : page === 'profile' ? t.app.profile
            : page === 'activity' ? t.app.activity
            : page === 'admin' ? t.app.admin
              : page === 'room' ? t.app.room
              : page === 'game' || page === 'arcade-game' ? activeGame.title
                : page.startsWith('mafia') ? t.app.mafia
                  : t.app.game

  const overlay = <>
    {profile?.displayName === 'بازیکن جدید' && !localStorage.getItem('partyplay-display-name') && <div className="identity-backdrop" role="presentation"><section className="identity-dialog" role="dialog" aria-modal="true" aria-label={language === 'fa' ? 'انتخاب نام نمایشی' : 'Choose display name'}><span className="eyebrow"><Sparkles size={15}/> {language === 'fa' ? 'خوش اومدی' : 'WELCOME'}</span><h2>{language === 'fa' ? 'دوستات با چه اسمی صدات کنن؟' : 'What should your friends call you?'}</h2><p>{language === 'fa' ? 'این نام در اتاق‌ها، دعوت‌ها و نتیجهٔ بازی نشان داده می‌شود؛ بعداً هم قابل تغییر است.' : 'This name appears in rooms, invitations, and game results. You can change it later.'}</p><input className="text-field" autoFocus value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} placeholder={language === 'fa' ? 'مثلاً کیان' : 'e.g. Kian'} maxLength={40}/><button className="primary-button full-button" onClick={saveDisplayName} disabled={nameDraft.trim().length < 1}>{language === 'fa' ? 'ادامه با این نام' : 'Continue with this name'}</button></section></div>}
    {sessionProgress.newMedal && <MedalCelebration medal={sessionProgress.newMedal} onDismiss={sessionProgress.dismissMedal}/>}
    {toast && <div className="toast"><Check size={18}/><span>{toast}</span><button onClick={() => setToast('')}><X size={16}/></button></div>}
  </>

  return <AppShell activePage={page} pageTitle={pageTitle} theme={currentTheme} playerName={playerName} playerAvatarSeed={playerAvatarSeed} playerAvatarAssetPath={profile?.avatarAssetPath} playerPresence={profile?.presence} playerPremiumRingEnabled={profile?.premiumRingEnabled} playerPremiumRingColor={profile?.premiumRingColor} isAdmin={profile?.siteRole === 'site_admin'} activityUnread={activity.unreadCount} activityItems={activity.items} searchQuery={searchQuery} onSearchQuery={setSearchQuery} onMarkAllActivityRead={() => void activity.markAllRead().catch(showOnlineError)} onThemeToggle={() => setThemePreference(currentTheme === 'dark' ? 'light' : 'dark')} onNavigate={(destination) => setPage(destination)} overlay={overlay}><Suspense fallback={<RouteLoading/>}>{renderPage()}</Suspense></AppShell>
}

export default function App() {
  const storedTheme = localStorage.getItem('partyplay-theme')
  const theme: ThemePreference = storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : 'system'
  const resolvedTheme = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'
  return <AuthGate theme={resolvedTheme}><PartyPlayApp/></AuthGate>
}

function RouteLoading() { const { t } = useLanguage(); return <section className="route-loading" aria-live="polite"><span/><strong>{t.app.loadingGame}</strong></section> }

function MedalCelebration({ medal, onDismiss }: { medal: SessionMedal; onDismiss: () => void }) {
  const { language } = useLanguage()
  const fa = language === 'fa'
  useEffect(() => { const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onDismiss() }; window.addEventListener('keydown', closeOnEscape); return () => window.removeEventListener('keydown', closeOnEscape) }, [onDismiss])
  return <div className="medal-backdrop" role="presentation" onClick={onDismiss}><section className={`medal-celebration medal-${medal.accent}`} role="dialog" aria-modal="true" aria-label={fa ? `مدال ${medal.title} باز شد` : `${medal.title} medal unlocked`} onClick={(event) => event.stopPropagation()}><button className="medal-close" onClick={onDismiss} aria-label={fa ? 'بستن جشن مدال' : 'Close medal celebration'}><X size={18}/></button><div className="medal-burst" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div><iframe className="medal-lottie" src="https://embed.lottiefiles.com/animation/A7NLwfdqzd" title="PartyPlay medal animation" loading="lazy" aria-hidden="true"/><span className="medal-main-icon">{medal.icon}</span><span className="eyebrow">{fa ? 'مدال نمایشی باز شد' : 'SHOWCASE MEDAL UNLOCKED'}</span><h2>{medal.title}</h2><p>{medal.description}</p><button className="primary-button" onClick={onDismiss}><Check size={17}/>{fa ? 'ادامهٔ بازی' : 'Continue playing'}</button></section></div>
}

function GamePage({ game, onlineRoom, onlineUserId, onlinePending, onOnlineMove, onRestart, truthMode, truthIndex, truthDone, onDraw, onTruthDone, mafiaPhase, mafiaRole, mafiaVote, onBeginMafia, onVote, onBack }: { game: GameDefinition; onlineRoom: ReturnType<typeof useOnlineTicTacToe>['room']; onlineUserId: string | null; onlinePending: boolean; onOnlineMove: (index: number) => void; onRestart: () => void; truthMode: 'truth'|'dare'; truthIndex: number; truthDone: number; onDraw: (mode: 'truth'|'dare') => void; onTruthDone: () => void; mafiaPhase: PracticePhase; mafiaRole: string; mafiaVote: string | null; onBeginMafia: () => void; onVote: (name: string) => void; onBack: () => void }) {
  const { t } = useLanguage()
  const Icon = game.icon
  const hasOnlineTicTacToe = game.id === 'tic-tac-toe' && onlineRoom?.session && onlineUserId
  return <section className={`game-page accent-${game.accent}`}><div className="game-topline"><button className="back-link" onClick={onBack}><ChevronLeft size={17}/>{t.app.home}</button><div className="live-status"><span className="pulse-dot"/>{hasOnlineTicTacToe ? t.app.onlineGame : t.games.practiceGame}</div></div><div className="game-header"><div className="game-header-title"><span className="game-icon"><Icon size={21}/></span><div><strong>{game.title}</strong><span>{hasOnlineTicTacToe ? onlineRoom.room.name : t.games.quickStart}</span></div></div><button className="secondary-button" onClick={onRestart}><Zap size={16}/>{t.games.restart}</button></div>{hasOnlineTicTacToe ? <OnlineTicTacToe room={onlineRoom} session={onlineRoom.session!} currentUserId={onlineUserId} pending={onlinePending} onMove={onOnlineMove} onRematch={onRestart}/> : game.id === 'truth-dare' ? <TruthDare mode={truthMode} index={truthIndex} done={truthDone} onDraw={onDraw} onDone={onTruthDone}/> : <MafiaPractice phase={mafiaPhase} role={mafiaRole} vote={mafiaVote} onBegin={onBeginMafia} onVote={onVote}/>}</section>
}

function TruthDare({ mode, index, done, onDraw, onDone }: { mode: 'truth'|'dare'; index: number; done: number; onDraw: (mode: 'truth'|'dare') => void; onDone: () => void }) { const { t, format } = useLanguage(); const deck = mode === 'truth' ? truthCards : dareCards; const card = deck[index] || deck[0]; return <div className="practice-stage truth-stage"><span className="preview-symbol"><Sparkles size={48}/></span><div className="truth-card-meta"><span className="pill">{mode === 'truth' ? t.games.truthCard : t.games.dareCard}</span><span className={`difficulty-chip ${card.level === 'چالشی و جسورانه' ? 'difficulty-bold' : ''}`}>{card.level}</span></div><div className="truth-card-motion" key={`${mode}-${index}`}><h2>«{card.text}»</h2><p>{t.games.choiceIsYours}</p></div><div className="preview-actions truth-choice-actions"><button className={`secondary-button ${mode === 'truth' ? 'choice-active' : ''}`} onClick={() => onDraw('truth')}>{t.games.nextTruth}</button><button className={`primary-button ${mode === 'dare' ? 'choice-active' : ''}`} onClick={() => onDraw('dare')}>{t.games.nextDare}</button></div><div className="truth-card-footer"><button className="text-button" onClick={() => onDraw(mode)}><ChevronLeft size={17}/>{t.games.skip}</button><button className="secondary-button" onClick={() => { onDone(); onDraw(mode) }}><Check size={17}/>{format(t.games.completeCount, { count: done })}</button></div></div> }

function MafiaPractice({ phase, role, vote, onBegin, onVote }: { phase: PracticePhase; role: string; vote: string | null; onBegin: () => void; onVote: (name: string) => void }) { const { t, format } = useLanguage(); const suspects = ['رها', 'نیلا', 'مانی', 'آرین']; if (phase === 'setup') return <div className="practice-stage mafia-stage"><span className="preview-symbol"><MoonStar size={48}/></span><span className="pill">{t.games.rolePractice}</span><h2>{t.games.takeSecretRole}</h2><p>{t.games.mafiaPracticeDescription}</p><button className="primary-button" onClick={onBegin}><Play size={17}/>{t.games.startPracticeRound}</button></div>; if (vote) return <div className="practice-stage mafia-stage"><span className="preview-symbol"><Check size={48}/></span><h2>{t.games.voteRecorded}</h2><p>{format(t.games.votedFor, { name: vote })}</p><button className="secondary-button" onClick={onBegin}>{t.games.newRound}</button></div>; return <div className="practice-stage mafia-stage"><span className="pill">{format(t.games.yourRole, { role })}</span><h2>{t.games.dayOneVote}</h2><p>{t.games.votePrompt}</p><div className="suspect-grid">{suspects.map((suspect) => <button key={suspect} onClick={() => onVote(suspect)}>{avatar(initial(suspect),'violet')}<span>{suspect}</span></button>)}</div></div> }
