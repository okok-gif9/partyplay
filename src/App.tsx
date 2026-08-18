import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, Check, ChevronLeft, Dice5, Gamepad2, Grid2X2,
  Home, Link2, Menu, Moon, MoonStar, Play, Plus, Settings2, Sparkles, Sun,
  UserPlus, Users, X, Zap,
} from 'lucide-react'
import './App.css'
import './mafia.css'
import './arcade.css'
import AuthGate from './components/AuthGate'
import OnlineTicTacToe from './components/OnlineTicTacToe'
import OnlineTicTacToeRoom from './components/OnlineTicTacToeRoom'
import OnlineTruthDare from './components/OnlineTruthDare'
import OnlineTruthDareRoom, { TruthDareRoomSetup } from './components/OnlineTruthDareRoom'
import OnlineMafiaRoom, { MafiaRoomSetup } from './components/OnlineMafiaRoom'
import OnlineMafia from './components/OnlineMafia'
import OnlineFullGameRoom, { FullGameSetup } from './components/OnlineFullGameRoom'
import OnlineFullGame from './components/OnlineFullGame'
import { useOnlineTicTacToe } from './hooks/useOnlineTicTacToe'
import { useOnlineTruthDare } from './hooks/useOnlineTruthDare'
import { useOnlineMafia } from './hooks/useOnlineMafia'
import { useOnlineFullGame } from './hooks/useOnlineFullGame'
import { usePartyPlayData } from './hooks/usePartyPlayData'
import { sessionMedals, useSessionPlayProgress, type SessionMedal } from './hooks/useSessionPlayProgress'
import { dareCards, shuffledIndexes, truthCards } from './data/truthDareCards'
import { GroupBadge, PlayerAvatar } from './components/SocialIdentity'
import { ProfileSettingsPage, SocialFriendsPage, SocialGroupsPage } from './components/SocialPages'
import SnakesBoard from './components/SnakesBoard'
import OpenSourceArcade from './components/OpenSourceArcade'
import { gameById, gameCatalog, type GameDefinition, type PartyGameId } from './data/gameCatalog'
import type { FullPartyPlayGameType } from './lib/partyplay'

type Page = 'home' | 'games' | 'friends' | 'groups' | 'profile' | 'room' | 'game' | 'arcade-game' | 'truth-setup' | 'truth-room' | 'truth-game' | 'mafia-setup' | 'mafia-room' | 'mafia-game' | 'full-game-setup' | 'full-game-room' | 'full-game'
type ThemePreference = 'system' | 'light' | 'dark'
type GameId = PartyGameId
type PracticePhase = 'setup' | 'playing' | 'finished'

const games: GameDefinition[] = gameCatalog
const fullGameIdByRoomType: Record<FullPartyPlayGameType, PartyGameId> = { spyfall: 'spyfall', uno: 'uno', pictionary: 'pictionary', connect_four: 'connect-four', backgammon: 'backgammon', ludo: 'ludo', codenames: 'codenames', hokm: 'hokm', snakes_ladders: 'snakes' }
const fullRoomTypeByGameId: Partial<Record<PartyGameId, FullPartyPlayGameType>> = Object.fromEntries(Object.entries(fullGameIdByRoomType).map(([roomType, gameId]) => [gameId, roomType as FullPartyPlayGameType]))

const snakes = new Map([[17, 7], [54, 34], [62, 19], [87, 36], [93, 73]])
const ladders = new Map([[4, 14], [9, 31], [20, 38], [28, 84], [40, 59], [51, 67], [71, 91]])

const avatar = (label: string, tone = 'violet', extra = '') => <span className={`avatar avatar-${tone} ${extra}`} aria-hidden="true">{label}</span>
const initial = (name?: string) => (name || 'ب').trim().charAt(0) || 'ب'

function App() {
  const [page, setPage] = useState<Page>('home')
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => (localStorage.getItem('partyplay-theme') as ThemePreference) || 'system')
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedGame, setSelectedGame] = useState<GameId>('tic-tac-toe')
  const [toast, setToast] = useState('')
  const [nameDraft, setNameDraft] = useState('')
  const [localBoard, setLocalBoard] = useState<(null | 'X' | 'O')[]>(Array(9).fill(null))
  const [localTurn, setLocalTurn] = useState<'X' | 'O'>('X')
  const [truthMode, setTruthMode] = useState<'truth' | 'dare'>('truth')
  const [truthOrder, setTruthOrder] = useState(() => shuffledIndexes(truthCards.length))
  const [dareOrder, setDareOrder] = useState(() => shuffledIndexes(dareCards.length))
  const [truthCursor, setTruthCursor] = useState(0)
  const [dareCursor, setDareCursor] = useState(0)
  const [truthDone, setTruthDone] = useState(0)
  const [snakePosition, setSnakePosition] = useState(1)
  const [lastRoll, setLastRoll] = useState<number | null>(null)
  const [mafiaPhase, setMafiaPhase] = useState<PracticePhase>('setup')
  const [mafiaRole, setMafiaRole] = useState('')
  const [mafiaVote, setMafiaVote] = useState<string | null>(null)
  const { profile, groups, friends, requests, loading, refresh, updateProfile, lookupProfile, sendFriendRequest, respondToRequest, removeFriend, createGroup, addGroupMember, updateGroupIdentity } = usePartyPlayData()
  const { room: onlineRoom, currentUserId: onlineUserId, pending: onlinePending, createRoom: createOnlineRoom, joinRoom: joinOnlineRoom, start: startOnlineRoom, move: makeOnlineMove } = useOnlineTicTacToe()
  const truthDare = useOnlineTruthDare()
  const mafia = useOnlineMafia()
  const fullGame = useOnlineFullGame()
  const sessionProgress = useSessionPlayProgress()

  const activeGame = gameById(selectedGame)
  const currentTheme = themePreference === 'system' ? (systemDark ? 'dark' : 'light') : themePreference
  const playerName = profile?.displayName || localStorage.getItem('partyplay-display-name') || 'بازیکن جدید'
  const playerInitial = initial(playerName)
  const playerAvatarSeed = profile?.avatarSeed || 'mint'
  const truthIndex = truthMode === 'truth' ? truthOrder[truthCursor] : dareOrder[dareCursor]
  const localWinner = useMemo(() => {
    const lines = [[0,1,2], [3,4,5], [6,7,8], [0,3,6], [1,4,7], [2,5,8], [0,4,8], [2,4,6]]
    for (const [a, b, c] of lines) if (localBoard[a] && localBoard[a] === localBoard[b] && localBoard[a] === localBoard[c]) return localBoard[a]
    return localBoard.every(Boolean) ? 'draw' : null
  }, [localBoard])

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
    if (page !== 'game' || selectedGame !== 'tic-tac-toe' || localTurn !== 'O' || localWinner) return
    const timer = window.setTimeout(() => {
      setLocalBoard((previous) => {
        const options = previous.map((value, index) => value ? -1 : index).filter((index) => index >= 0)
        if (!options.length) return previous
        const next = [...previous]
        next[options[Math.floor(Math.random() * options.length)]] = 'O'
        return next
      })
      setLocalTurn('X')
    }, 520)
    return () => window.clearTimeout(timer)
  }, [page, selectedGame, localTurn, localWinner])
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
    setLocalBoard(Array(9).fill(null))
    setLocalTurn('X')
    setTruthMode('truth')
    setTruthOrder(shuffledIndexes(truthCards.length))
    setDareOrder(shuffledIndexes(dareCards.length))
    setTruthCursor(0)
    setDareCursor(0)
    setTruthDone(0)
    setSnakePosition(1)
    setLastRoll(null)
    setMafiaPhase('setup')
    setMafiaRole('')
    setMafiaVote(null)
  }
  const startPractice = (game: GameId) => {
    sessionProgress.markStarted(game)
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
  const makePracticeMove = (index: number) => {
    if (selectedGame !== 'tic-tac-toe' || localBoard[index] || localTurn !== 'X' || localWinner) return
    setLocalBoard((previous) => previous.map((value, cellIndex) => cellIndex === index ? 'X' : value))
    sessionProgress.markAction('tic-tac-toe')
    setLocalTurn('O')
  }
  const rollDice = () => {
    if (snakePosition >= 100) return
    const roll = Math.floor(Math.random() * 6) + 1
    let next = snakePosition + roll
    if (next > 100) next = snakePosition
    if (ladders.has(next)) next = ladders.get(next)!
    if (snakes.has(next)) next = snakes.get(next)!
    setLastRoll(roll)
    setSnakePosition(next)
    sessionProgress.markAction('snakes')
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
    if (page === 'games') return <GamesPage onBack={() => setPage('home')} onPractice={startPractice} onFriendsGame={openFriendsGame} onOnlineTicTacToe={createOnlineTicTacToe} onOnlineTruthDare={() => setPage('truth-setup')} started={sessionProgress.started} earnedMedals={sessionProgress.earnedMedals} />
    if (page === 'arcade-game') return <OpenSourceArcade game={activeGame} onBack={() => setPage('games')}/>
    if (page === 'full-game-setup') return <FullGameSetup game={activeGame} pending={fullGame.pending} error={fullGame.error} onCreate={createOnlineFullGame} onBack={() => setPage('games')}/>
    if (page === 'full-game-room' && fullGame.room) return <OnlineFullGameRoom game={activeGame} room={fullGame.room} currentUserId={fullGame.currentUserId} pending={fullGame.pending} error={fullGame.error} onStart={() => void fullGame.start().then(() => setPage('full-game')).catch(showOnlineError)} onBack={() => setPage('games')}/>
    if (page === 'full-game' && fullGame.room?.session) return <OnlineFullGame game={activeGame} room={fullGame.room} currentUserId={fullGame.currentUserId} pending={fullGame.pending} privateState={fullGame.privateState} onSavePrivate={(state) => void fullGame.savePrivateState(state)} onApply={(state, turnUserId, status, eventType) => void fullGame.applyState(state, turnUserId, status, eventType).then(() => sessionProgress.markAction(selectedGame)).catch(showOnlineError)} onBack={() => setPage('games')}/>
    if (page === 'friends') return <SocialFriendsPage onBack={() => setPage('home')} friends={friends} requests={requests} lookupProfile={lookupProfile} sendFriendRequest={sendFriendRequest} respondToRequest={respondToRequest} removeFriend={removeFriend} notify={setToast}/>
    if (page === 'groups') return <SocialGroupsPage onBack={() => setPage('home')} groups={groups} createGroup={createGroup} addGroupMember={addGroupMember} updateGroupIdentity={updateGroupIdentity} notify={setToast}/>
    if (page === 'profile') return <ProfileSettingsPage onBack={() => setPage('home')} profile={profile} loading={loading} onRetry={() => void refresh().catch(showOnlineError)} updateProfile={updateProfile} theme={themePreference} onTheme={setThemePreference} notify={setToast}/>
    if (page === 'room' && onlineRoom) return <OnlineTicTacToeRoom room={onlineRoom} currentUserId={onlineUserId} pending={onlinePending} onBack={() => setPage('home')} onStart={() => void startOnlineRoom().then(() => setPage('game')).catch(showOnlineError)} onInvite={() => { const link = `${window.location.origin}${window.location.pathname}?room=${onlineRoom.room.invite_code}`; if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(link); setToast('لینک دعوت کپی شد.') }} />
    if (page === 'truth-setup') return <TruthDareRoomSetup pending={truthDare.pending} onBack={() => setPage('games')} onCreate={createOnlineTruthDare}/>
    if (page === 'mafia-setup') return <MafiaRoomSetup pending={mafia.pending} error={mafia.error} onCreate={createOnlineMafia}/>
    if (page === 'truth-room' && truthDare.room) return <OnlineTruthDareRoom room={truthDare.room} currentUserId={truthDare.currentUserId} pending={truthDare.pending} onBack={() => setPage('home')} onStart={() => void truthDare.start().then(() => setPage('truth-game')).catch(showOnlineError)} onInvite={() => { const link = `${window.location.origin}${window.location.pathname}?room=${truthDare.room!.room.invite_code}`; if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(link); setToast('لینک دعوت کپی شد.') }}/>
    if (page === 'mafia-room' && mafia.room) return <OnlineMafiaRoom room={mafia.room} currentUserId={mafia.currentUserId} pending={mafia.pending} error={mafia.error} onStart={() => void mafia.start().then(() => setPage('mafia-game')).catch(showOnlineError)}/>
    if (page === 'truth-game' && truthDare.room?.session && truthDare.currentUserId) return <section className="game-page accent-gold"><div className="game-topline"><button className="back-link" onClick={() => setPage('home')}><ChevronLeft size={17}/>خانه</button><div className="live-status"><span className="pulse-dot"/>بازی آنلاین</div></div><div className="game-header"><div className="game-header-title"><span className="game-icon"><Sparkles size={21}/></span><div><strong>جرئت یا حقیقت</strong><span>{truthDare.room.room.name}</span></div></div></div><OnlineTruthDare room={truthDare.room} session={truthDare.room.session} messages={truthDare.messages} currentUserId={truthDare.currentUserId} pending={truthDare.pending} onChoose={(choice) => void truthDare.choose(choice).then(() => sessionProgress.markAction('truth-dare')).catch(showOnlineError)} onNextTurn={() => void truthDare.nextTurn().then(() => sessionProgress.markAction('truth-dare')).catch(showOnlineError)} onFinish={() => void truthDare.finish().catch(showOnlineError)} onSendMessage={(body) => void truthDare.sendMessage(body).catch(showOnlineError)} onToggleReaction={(messageId, reaction) => void truthDare.toggleReaction(messageId, reaction).catch(showOnlineError)}/></section>
    if (page === 'mafia-game' && mafia.room?.session && mafia.privateView) return <section className="game-page accent-pink"><div className="game-topline"><button className="back-link" onClick={() => setPage('home')}><ChevronLeft size={17}/>خانه</button><div className="live-status"><span className="pulse-dot"/>بازی آنلاین</div></div><OnlineMafia room={mafia.room} view={mafia.privateView} messages={mafia.messages} teamMessages={mafia.teamMessages} speakerReactions={mafia.speakerReactions} currentUserId={mafia.currentUserId} pending={mafia.pending} error={mafia.error} onAcknowledge={() => void mafia.acknowledgeRole().then(() => sessionProgress.markAction('mafia')).catch(showOnlineError)} onSetSpeaking={(mode) => void mafia.setSpeaking(mode).catch(showOnlineError)} onNextSpeaker={() => void mafia.nextSpeaker().catch(showOnlineError)} onSendDayMessage={(body) => void mafia.sendDayMessage(body).catch(showOnlineError)} onReact={(reaction) => void mafia.react(reaction).catch(showOnlineError)} onVote={(choice, targetUserId) => void mafia.vote(choice, targetUserId).catch(showOnlineError)} onResolveVote={() => void mafia.resolveVote().catch(showOnlineError)} onOpenNight={() => void mafia.openNight().catch(showOnlineError)} onSendTeamMessage={(body) => void mafia.sendTeamMessage(body).catch(showOnlineError)} onSubmitNightAction={(targetUserId) => void mafia.submitNightAction(targetUserId).catch(showOnlineError)} onAdvanceNight={() => void mafia.advanceNight().catch(showOnlineError)}/></section>
    if (page === 'game') return <GamePage game={activeGame} playerName={playerName} playerInitial={playerInitial} onlineRoom={onlineRoom} onlineUserId={onlineUserId} onlinePending={onlinePending} localBoard={localBoard} localWinner={localWinner} localTurn={localTurn} onLocalMove={makePracticeMove} onOnlineMove={(index) => void makeOnlineMove(index).then(() => sessionProgress.markAction('tic-tac-toe')).catch(showOnlineError)} onRestart={() => resetPractice(selectedGame)} truthMode={truthMode} truthIndex={truthIndex} truthDone={truthDone} onDraw={drawCard} onTruthDone={() => { setTruthDone((value) => value + 1); sessionProgress.markAction('truth-dare') }} snakePosition={snakePosition} lastRoll={lastRoll} onRoll={rollDice} onSnakeRestart={() => { setSnakePosition(1); setLastRoll(null) }} mafiaPhase={mafiaPhase} mafiaRole={mafiaRole} mafiaVote={mafiaVote} onBeginMafia={beginMafia} onVote={(name) => { setMafiaVote(name); sessionProgress.markAction('mafia') }} onBack={() => setPage('home')} />
    return <HomePage name={playerName} avatarSeed={playerAvatarSeed} groups={groups} friends={friends} loading={loading} onPractice={startPractice} onFriendsGame={openFriendsGame} onCreateOnline={createOnlineTicTacToe} onOnlineMafia={() => setPage('mafia-setup')} onGames={() => setPage('games')} onGroups={() => setPage('groups')} onFriends={() => setPage('friends')} started={sessionProgress.started} earnedMedals={sessionProgress.earnedMedals} />
  }

  const navItems: Array<{ id: Page; label: string; icon: typeof Home }> = [
    { id: 'home', label: 'خانه', icon: Home }, { id: 'games', label: 'بازی‌ها', icon: Gamepad2 }, { id: 'friends', label: 'دوستان', icon: Users }, { id: 'groups', label: 'گروه‌ها', icon: Users },
  ]

  return <AuthGate theme={currentTheme}>
    <div className="app-shell" data-theme={currentTheme} dir="rtl">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        <button className="brand" onClick={() => { setPage('home'); setMobileMenuOpen(false) }} aria-label="خانهٔ پارتی پلی"><span className="brand-mark"><span>◈</span><i/><i/><i/><i/></span><span className="brand-text">پارتی <span>پلی</span></span></button>
        <div className="nav-section"><p className="nav-caption">فضای بازی</p>{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? 'nav-active' : ''}`} onClick={() => { setPage(id); setMobileMenuOpen(false) }}><Icon size={20}/><span>{label}</span></button>)}</div>
        <div className="sidebar-spacer" />
        <button className={`nav-item profile-nav ${page === 'profile' ? 'nav-active' : ''}`} onClick={() => setPage('profile')}><PlayerAvatar seed={playerAvatarSeed} label={playerName} size="sm" status={profile?.presence}/><span>{playerName}</span><Settings2 size={18}/></button>
      </aside>
      <main className="main-content">
        <header className="topbar"><button className="mobile-menu-button icon-button" onClick={() => setMobileMenuOpen((open) => !open)} aria-label="باز کردن منو"><Menu size={22}/></button><div className="breadcrumb"><span>پارتی پلی</span><ChevronLeft size={16}/><strong>{page === 'home' ? 'خانه' : page === 'game' || page === 'arcade-game' ? activeGame.title : page === 'room' ? 'لابی دوز' : page === 'truth-setup' ? 'اتاق جرئت‌وحقیقت' : page === 'truth-room' ? 'لابی جرئت‌وحقیقت' : page === 'truth-game' ? 'جرئت‌وحقیقت آنلاین' : page === 'mafia-setup' ? 'ساخت اتاق مافیا' : page === 'mafia-room' ? 'لابی مافیا' : page === 'mafia-game' ? 'مافیا آنلاین' : page === 'profile' ? 'پروفایل' : page === 'groups' ? 'گروه‌ها' : page === 'friends' ? 'دوستان' : 'بازی‌ها'}</strong></div><div className="top-actions"><button className="theme-toggle icon-button" onClick={() => setThemePreference(currentTheme === 'dark' ? 'light' : 'dark')} aria-label="تغییر تم">{currentTheme === 'dark' ? <Sun size={19}/> : <Moon size={19}/>}</button><button className="top-avatar" onClick={() => setPage('profile')}><PlayerAvatar seed={playerAvatarSeed} label={playerName} size="sm" status={profile?.presence}/></button></div></header>
        <div className="page-container">{renderPage()}</div>
      </main>
      {profile?.displayName === 'بازیکن جدید' && !localStorage.getItem('partyplay-display-name') && <div className="identity-backdrop" role="presentation"><section className="identity-dialog" role="dialog" aria-modal="true" aria-label="انتخاب نام نمایشی"><span className="eyebrow"><Sparkles size={15}/> خوش اومدی</span><h2>دوستات با چه اسمی صدات کنن؟</h2><p>این نام در اتاق‌ها، دعوت‌ها و نتیجهٔ بازی نشان داده می‌شود؛ بعداً هم قابل تغییر است.</p><input className="text-field" autoFocus value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} placeholder="مثلاً کیان" maxLength={40}/><button className="primary-button full-button" onClick={saveDisplayName} disabled={nameDraft.trim().length < 1}>ادامه با این نام</button></section></div>}
      {sessionProgress.newMedal && <MedalCelebration medal={sessionProgress.newMedal} onDismiss={sessionProgress.dismissMedal}/>} 
      {toast && <div className="toast"><Check size={18}/><span>{toast}</span><button onClick={() => setToast('')}><X size={16}/></button></div>}
    </div>
  </AuthGate>
}

function SessionProgress({ started, earnedMedals }: { started: ReturnType<typeof useSessionPlayProgress>['started']; earnedMedals: SessionMedal[] }) {
  const triedCount = Object.values(started).filter(Boolean).length
  return <section className="session-progress panel"><div className="session-progress-head"><div><span className="eyebrow"><Sparkles size={15}/> پیشرفت این نشست</span><h2>{triedCount ? `${triedCount} بازی را شروع کردی` : 'یک بازی انتخاب کن و اولین مدالت را بگیر'}</h2></div><span className="session-count">{earnedMedals.length}/۴</span></div><div className="session-game-track">{sessionMedals.map((medal) => { const game = gameById(medal.game); const earned = earnedMedals.some((item) => item.id === medal.id); return <div className={`session-game-step accent-${game.accent} ${started[game.id] ? 'step-started' : ''} ${earned ? 'step-earned' : ''}`} key={game.id}><span className="step-orb">{earned ? <Check size={15}/> : game.art}</span><span><b>{game.title}</b><small>{earned ? medal.title : started[game.id] ? 'در حال بازی' : 'شروع نشده'}</small></span></div> })}</div><MedalShelf earnedMedals={earnedMedals}/></section>
}

function MedalShelf({ earnedMedals, compact = false }: { earnedMedals: SessionMedal[]; compact?: boolean }) {
  return <div className={`medal-shelf ${compact ? 'medal-shelf-compact' : ''}`}>{sessionMedals.map((medal) => { const earned = earnedMedals.some((item) => item.id === medal.id); return <div className={`medal-token medal-${medal.accent} ${earned ? 'medal-earned' : ''}`} key={medal.id} title={earned ? medal.description : 'با انجام اولین حرکت این بازی باز می‌شود'}><span>{earned ? medal.icon : '◇'}</span><div><b>{medal.title}</b><small>{earned ? 'باز شد' : 'قفل است'}</small></div></div> })}</div>
}

function MedalCelebration({ medal, onDismiss }: { medal: SessionMedal; onDismiss: () => void }) {
  useEffect(() => { const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onDismiss() }; window.addEventListener('keydown', closeOnEscape); return () => window.removeEventListener('keydown', closeOnEscape) }, [onDismiss])
  return <div className="medal-backdrop" role="presentation" onClick={onDismiss}><section className={`medal-celebration medal-${medal.accent}`} role="dialog" aria-modal="true" aria-label={`مدال ${medal.title} باز شد`} onClick={(event) => event.stopPropagation()}><button className="medal-close" onClick={onDismiss} aria-label="بستن جشن مدال"><X size={18}/></button><div className="medal-burst" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div><span className="medal-main-icon">{medal.icon}</span><span className="eyebrow">مدال نمایشی باز شد</span><h2>{medal.title}</h2><p>{medal.description}</p><button className="primary-button" onClick={onDismiss}><Check size={17}/>ادامهٔ بازی</button></section></div>
}

function HomePage({ name, avatarSeed, groups, friends, loading, onPractice, onFriendsGame, onCreateOnline, onOnlineMafia, onGames, onGroups, onFriends, started, earnedMedals }: { name: string; avatarSeed: string; groups: ReturnType<typeof usePartyPlayData>['groups']; friends: ReturnType<typeof usePartyPlayData>['friends']; loading: boolean; onPractice: (game: GameId) => void; onFriendsGame: (game: GameId) => void; onCreateOnline: () => void; onOnlineMafia: () => void; onGames: () => void; onGroups: () => void; onFriends: () => void; started: ReturnType<typeof useSessionPlayProgress>['started']; earnedMedals: SessionMedal[] }) {
  return <>
    <section className="welcome-row"><div><span className="eyebrow"><Sparkles size={15}/> حساب تو</span><h1>سلام {name}، <span>بازی رو شروع کنیم؟</span></h1><p>برای یک جمع واقعی، اتاق خصوصی مافیا بساز یا از بین بازی‌ها انتخاب کن.</p></div><button className="primary-button create-button" onClick={onOnlineMafia}><MoonStar size={19}/>اتاق مافیا</button></section>
    <section className="quick-play"><div className="quick-content"><div className="quick-copy"><span className="pill"><MoonStar size={14}/> نقش مخفی و دورهمی</span><h2>شهر را برای مافیا جمع کن.</h2><p>یک اتاق ۵، ۷ یا ۹ نفره بساز؛ سایت نقش‌ها، نوبت‌ها و روایت شب و روز را مدیریت می‌کند.</p><div className="quick-actions"><button className="quick-primary" onClick={onOnlineMafia}><MoonStar size={17}/>ساخت اتاق مافیا</button><button className="quick-secondary" onClick={onGames}><Link2 size={18}/>دیدن همهٔ بازی‌ها</button></div></div><div className="quick-orbit"><span className="orbit-token token-x">✕</span><span className="orbit-token token-o">○</span><span className="orbit-token token-dice">⚄</span><div className="quick-badge"><PlayerAvatar seed={avatarSeed} label={name} size="sm"/><strong>آماده‌ای</strong><span>یک بازی انتخاب کن</span></div></div></div>
    </section>
    <section className="section-heading"><div><span className="eyebrow">بازی‌های قابل اجرا</span><h2>انتخاب کن و شروع کن</h2></div><button className="text-button" onClick={onGames}>دیدن همه <ArrowLeft size={16}/></button></section>
    <section className="games-grid">{games.map((game) => <GameCard key={game.id} game={game} action="بازی با ربات" friendAction="اتاق دوستان" onPlay={() => onPractice(game.id)} onFriendPlay={() => onFriendsGame(game.id)} started={Boolean(started[game.id])} earned={earnedMedals.some((medal) => medal.game === game.id)} />)}</section>
    <SessionProgress started={started} earnedMedals={earnedMedals}/>
    <section className="dashboard-grid"><div className="panel friends-panel"><div className="panel-heading"><div><span className="eyebrow">دوستان</span><h2>{friends.length ? 'دوستان آنلاین و آماده' : 'هنوز دوستی نداری'}</h2></div><button className="text-button" onClick={onFriends}>مدیریت <ArrowLeft size={15}/></button></div>{friends.length ? <div className="home-friend-stack">{friends.slice(0, 3).map((friend) => <button key={friend.id} className="home-friend-row" onClick={onFriends}><PlayerAvatar seed={friend.avatarSeed} label={friend.displayName} size="sm" status={friend.presence}/><span><b>{friend.displayName}</b><small dir="ltr">@{friend.username}</small></span><span className={`friend-presence presence-${friend.presence}`}>{friend.presence === 'online' ? 'آنلاین' : friend.presence === 'away' ? 'دور از دسترس' : friend.presence === 'busy' ? 'مشغول' : 'آفلاین'}</span></button>)}</div> : <div className="empty-inline"><UserPlus size={22}/><p>اولین دوستت را با شناسهٔ کاربری‌اش اضافه کن؛ بعد چالش مستقیم هم فعال می‌شود.</p><button className="text-button" onClick={onFriends}>افزودن دوست <ArrowLeft size={15}/></button></div>}</div><div className="panel activity-panel"><div className="panel-heading"><div><span className="eyebrow">بازی آنلاین</span><h2>دوز دونفره</h2></div></div><div className="empty-inline"><Grid2X2 size={22}/><p>اتاق بساز، لینک را بفرست و بعد از ورود حریف، بازی را شروع کن.</p><button className="text-button" onClick={onCreateOnline}>ساخت اتاق <ArrowLeft size={15}/></button></div></div></section>
    <section className="section-heading compact-heading"><div><span className="eyebrow">جمع‌های همیشگی</span><h2>گروه‌های تو</h2></div><button className="text-button" onClick={onGroups}>مدیریت گروه‌ها <ArrowLeft size={16}/></button></section>
    {loading ? <div className="panel loading-panel">در حال خواندن داده‌های حساب…</div> : groups.length ? <section className="groups-strip">{groups.map((group) => <button className="group-card group-violet" key={group.id} onClick={onGroups}><GroupBadge seed={group.avatarSeed}/><span><strong>{group.name}</strong><small>{group.memberCount} عضو</small></span><ChevronLeft size={18}/></button>)}<button className="group-add" onClick={onGroups}><Plus size={21}/><span>ساخت گروه</span></button></section> : <button className="empty-group-cta" onClick={onGroups}><span><Plus size={22}/></span><strong>هنوز گروهی نساختی</strong><small>برای دورهمی‌های همیشگی یک گروه واقعی بساز</small></button>}
  </>
}

function GameCard({ game, action, onPlay, friendAction, onFriendPlay, started = false, earned = false }: { game: GameDefinition; action: string; onPlay: () => void; friendAction?: string; onFriendPlay?: () => void; started?: boolean; earned?: boolean }) { const Icon = game.icon; return <article className={`game-card accent-${game.accent} ${earned ? 'game-experienced' : ''}`}><div className="game-card-top"><div className="game-icon"><Icon size={23}/></div><span className="game-status">{earned ? 'تجربه شد' : started ? 'در حال بازی' : 'امتحانش کن'}</span><span className="game-art">{game.art}</span></div><div className="game-card-copy"><p>{game.tone}</p><h3>{game.title}</h3><span>{game.subtitle}</span></div><div className="game-card-bottom"><div><small><Users size={14}/>{game.players}</small><small>· {game.duration}</small></div><div className="game-card-actions"><button onClick={onPlay}><Play size={16} fill="currentColor"/>{action}</button>{onFriendPlay && <button className="card-friend-button" onClick={onFriendPlay}><Link2 size={14}/>{friendAction || 'با دوستان'}</button>}</div></div></article> }

function GamesPage({ onBack, onPractice, onFriendsGame, onOnlineTicTacToe, onOnlineTruthDare, started, earnedMedals }: { onBack: () => void; onPractice: (game: GameId) => void; onFriendsGame: (game: GameId) => void; onOnlineTicTacToe: () => void; onOnlineTruthDare: () => void; started: ReturnType<typeof useSessionPlayProgress>['started']; earnedMedals: SessionMedal[] }) { return <section className="sub-page"><PageTitle eyebrow="بازی کن" title="بازی رو انتخاب کن" description="تنها هستی؟ ربات را انتخاب کن. جمع داری؟ اتاق خصوصی بساز." onBack={onBack}/><div className="all-games-grid">{games.map((game) => <GameCard game={game} key={game.id} action="بازی با ربات" friendAction="اتاق دوستان" onPlay={() => onPractice(game.id)} onFriendPlay={() => onFriendsGame(game.id)} started={Boolean(started[game.id])} earned={earnedMedals.some((medal) => medal.game === game.id)}/>)}</div><section className="mode-panel"><div><span className="eyebrow">دوز واقعی دونفره</span><h2>برای رقابت با دوستت، لینک اختصاصی بساز</h2></div><button className="primary-button" onClick={onOnlineTicTacToe}><Link2 size={18}/>ساخت اتاق آنلاین</button></section><section className="mode-panel truth-mode-panel"><div><span className="eyebrow">جرئت‌وحقیقت گروهی</span><h2>دوست‌ها را با لینک خصوصی وارد کن</h2></div><button className="primary-button" onClick={onOnlineTruthDare}><Sparkles size={18}/>ساخت اتاق گروهی</button></section></section> }

function GamePage({ game, playerName, playerInitial, onlineRoom, onlineUserId, onlinePending, localBoard, localWinner, localTurn, onLocalMove, onOnlineMove, onRestart, truthMode, truthIndex, truthDone, onDraw, onTruthDone, snakePosition, lastRoll, onRoll, onSnakeRestart, mafiaPhase, mafiaRole, mafiaVote, onBeginMafia, onVote, onBack }: { game: GameDefinition; playerName: string; playerInitial: string; onlineRoom: ReturnType<typeof useOnlineTicTacToe>['room']; onlineUserId: string | null; onlinePending: boolean; localBoard: (null|'X'|'O')[]; localWinner: string | null; localTurn: 'X'|'O'; onLocalMove: (index: number) => void; onOnlineMove: (index: number) => void; onRestart: () => void; truthMode: 'truth'|'dare'; truthIndex: number; truthDone: number; onDraw: (mode: 'truth'|'dare') => void; onTruthDone: () => void; snakePosition: number; lastRoll: number | null; onRoll: () => void; onSnakeRestart: () => void; mafiaPhase: PracticePhase; mafiaRole: string; mafiaVote: string | null; onBeginMafia: () => void; onVote: (name: string) => void; onBack: () => void }) {
  const Icon = game.icon
  const hasOnlineTicTacToe = game.id === 'tic-tac-toe' && onlineRoom?.session && onlineUserId
  return <section className={`game-page accent-${game.accent}`}><div className="game-topline"><button className="back-link" onClick={onBack}><ChevronLeft size={17}/>خانه</button><div className="live-status"><span className="pulse-dot"/>{hasOnlineTicTacToe ? 'بازی آنلاین' : 'تمرین قابل‌بازی'}</div></div><div className="game-header"><div className="game-header-title"><span className="game-icon"><Icon size={21}/></span><div><strong>{game.title}</strong><span>{hasOnlineTicTacToe ? onlineRoom.room.name : 'شروع فوری'}</span></div></div><button className="secondary-button" onClick={onRestart}><Zap size={16}/>شروع دوباره</button></div>{hasOnlineTicTacToe ? <OnlineTicTacToe room={onlineRoom} session={onlineRoom.session!} currentUserId={onlineUserId} pending={onlinePending} onMove={onOnlineMove} onRematch={onRestart}/> : game.id === 'tic-tac-toe' ? <PracticeTicTacToe board={localBoard} winner={localWinner} turn={localTurn} playerName={playerName} playerInitial={playerInitial} onMove={onLocalMove} onRestart={onRestart}/> : game.id === 'truth-dare' ? <TruthDare mode={truthMode} index={truthIndex} done={truthDone} onDraw={onDraw} onDone={onTruthDone}/> : game.id === 'snakes' ? <SnakesAndLadders position={snakePosition} lastRoll={lastRoll} playerName={playerName} playerInitial={playerInitial} onRoll={onRoll} onRestart={onSnakeRestart}/> : <MafiaPractice phase={mafiaPhase} role={mafiaRole} vote={mafiaVote} onBegin={onBeginMafia} onVote={onVote}/>}</section>
}

function PracticeTicTacToe({ board, winner, turn, playerName, playerInitial, onMove, onRestart }: { board: (null|'X'|'O')[]; winner: string | null; turn: 'X'|'O'; playerName: string; playerInitial: string; onMove: (index: number) => void; onRestart: () => void }) { const message = winner === 'X' ? 'بردی! خط X کامل شد.' : winner === 'O' ? 'ربات این دور را برد؛ یک دور دیگر؟' : winner === 'draw' ? 'مساوی شد؛ حرکت بعدی با توست.' : turn === 'X' ? 'نوبت توئه؛ یک خانه انتخاب کن.' : 'ربات در حال انتخاب حرکت است…'; return <div className="play-layout"><aside className="player-card current-player">{avatar(playerInitial,'pink','large-avatar')}<div><span>تو</span><strong>{playerName}</strong><small>مهرهٔ X</small></div><b className="player-mark">X</b></aside><main className="board-panel"><div className="turn-message"><span className="turn-badge">{turn}</span><p>{message}</p></div><div className="tic-board" aria-label="صفحهٔ تمرین دوز">{board.map((cell, index) => <button key={index} className={`tic-cell ${cell ? `mark-${cell}` : ''}`} onClick={() => onMove(index)} disabled={Boolean(cell) || Boolean(winner) || turn !== 'X'} aria-label={`خانهٔ ${index + 1}`}>{cell}</button>)}</div>{winner && <button className="primary-button rematch-button" onClick={onRestart}><Zap size={17}/>یه دور دیگه</button>}<div className="board-meta"><span>تمرین با ربات</span><i/><span>قابل بازی آفلاین</span></div></main><aside className="player-card rival-player">{avatar('ر','cyan','large-avatar')}<div><span>حریف</span><strong>ربات پارتی‌پلی</strong><small>مهرهٔ O</small></div><b className="player-mark">O</b></aside></div> }

function TruthDare({ mode, index, done, onDraw, onDone }: { mode: 'truth'|'dare'; index: number; done: number; onDraw: (mode: 'truth'|'dare') => void; onDone: () => void }) { const deck = mode === 'truth' ? truthCards : dareCards; const card = deck[index] || deck[0]; return <div className="practice-stage truth-stage"><span className="preview-symbol"><Sparkles size={48}/></span><div className="truth-card-meta"><span className="pill">کارت {mode === 'truth' ? 'حقیقت' : 'جرئت'}</span><span className={`difficulty-chip ${card.level === 'چالشی و جسورانه' ? 'difficulty-bold' : ''}`}>{card.level}</span></div><div className="truth-card-motion" key={`${mode}-${index}`}><h2>«{card.text}»</h2><p>اختیار کامل با توست؛ انجامش بده، ردش کن یا کارت بعدی را بکش.</p></div><div className="preview-actions truth-choice-actions"><button className={`secondary-button ${mode === 'truth' ? 'choice-active' : ''}`} onClick={() => onDraw('truth')}>حقیقت بعدی</button><button className={`primary-button ${mode === 'dare' ? 'choice-active' : ''}`} onClick={() => onDraw('dare')}>جرئت بعدی</button></div><div className="truth-card-footer"><button className="text-button" onClick={() => onDraw(mode)}><ChevronLeft size={17}/>رد کردن</button><button className="secondary-button" onClick={() => { onDone(); onDraw(mode) }}><Check size={17}/>انجام شد · {done}</button></div></div> }

function SnakesAndLadders({ position, lastRoll, playerName, playerInitial, onRoll, onRestart }: { position: number; lastRoll: number | null; playerName: string; playerInitial: string; onRoll: () => void; onRestart: () => void }) {
  const special = snakes.has(position) ? 'مار!' : ladders.has(position) ? 'پله!' : ''
  return <div className="snakes-layout storybook-snakes-layout"><SnakesBoard position={position} playerInitial={playerInitial} snakes={snakes} ladders={ladders}/><aside className="practice-side snake-control-panel"><div className="snake-control-heading"><span className="preview-symbol"><Dice5 size={44}/></span><div><span className="eyebrow">مهرهٔ {playerName}</span><h2>{position >= 100 ? 'برنده شدی!' : 'تاس را بنداز'}</h2></div></div><p>{lastRoll ? `تاس ${lastRoll} آمد. روی خانهٔ ${position} هستی. ${special}` : 'از خانهٔ ۱ شروع کن؛ پله‌ها تو را بالا می‌برند و مارها غافلگیرت می‌کنند.'}</p><div className="snake-progress"><span>خانهٔ فعلی</span><strong>{position}<small>/۱۰۰</small></strong></div><button className="primary-button full-button" onClick={onRoll} disabled={position >= 100}><Dice5 size={18}/>انداختن تاس</button><button className="secondary-button full-button" onClick={onRestart}>شروع دوباره</button><small className="snake-dice-note">انیمیشن تاس به‌زودی به همین کنترل متصل می‌شود.</small></aside></div>
}

function MafiaPractice({ phase, role, vote, onBegin, onVote }: { phase: PracticePhase; role: string; vote: string | null; onBegin: () => void; onVote: (name: string) => void }) { const suspects = ['رها', 'نیلا', 'مانی', 'آرین']; if (phase === 'setup') return <div className="practice-stage mafia-stage"><span className="preview-symbol"><MoonStar size={48}/></span><span className="pill">تمرین نقش‌ها</span><h2>نقش محرمانه‌ات را بگیر</h2><p>این تمرین منطق اصلی مافیا—نقش، روز و رأی—را بدون انتظار برای بازیکن‌های دیگر نشان می‌دهد.</p><button className="primary-button" onClick={onBegin}><Play size={17}/>شروع دور تمرینی</button></div>; if (vote) return <div className="practice-stage mafia-stage"><span className="preview-symbol"><Check size={48}/></span><h2>رأی تو ثبت شد</h2><p>به {vote} رأی دادی. در بازی آنلاین، پس از رأی همه نتیجه نمایش داده می‌شود.</p><button className="secondary-button" onClick={onBegin}>دور تازه</button></div>; return <div className="practice-stage mafia-stage"><span className="pill">نقش تو: {role}</span><h2>روز اول؛ وقت رأی</h2><p>به کسی رأی بده که بیشتر به او شک داری.</p><div className="suspect-grid">{suspects.map((suspect) => <button key={suspect} onClick={() => onVote(suspect)}>{avatar(initial(suspect),'violet')}<span>{suspect}</span></button>)}</div></div> }

function PageTitle({ eyebrow, title, description, onBack }: { eyebrow: string; title: string; description: string; onBack: () => void }) { return <div className="page-title"><button className="back-link" onClick={onBack}><ChevronLeft size={17}/>خانه</button><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div> }

export default App
