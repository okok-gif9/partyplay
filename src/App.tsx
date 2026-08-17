import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, Bot, Check, ChevronLeft, Dice5, Gamepad2, Grid2X2,
  Home, Link2, Menu, Moon, Play, Plus, Settings2, Sparkles, Sun, Swords,
  UserPlus, Users, X, Zap,
} from 'lucide-react'
import './App.css'
import AuthGate from './components/AuthGate'
import OnlineTicTacToe from './components/OnlineTicTacToe'
import OnlineTicTacToeRoom from './components/OnlineTicTacToeRoom'
import { useOnlineTicTacToe } from './hooks/useOnlineTicTacToe'
import { usePartyPlayData } from './hooks/usePartyPlayData'

type Page = 'home' | 'games' | 'friends' | 'groups' | 'profile' | 'room' | 'game'
type ThemePreference = 'system' | 'light' | 'dark'
type GameId = 'mafia' | 'tic-tac-toe' | 'truth-dare' | 'snakes'
type PracticePhase = 'setup' | 'playing' | 'finished'

type Game = {
  id: GameId
  title: string
  subtitle: string
  players: string
  duration: string
  tone: string
  icon: typeof Swords
  accent: string
  art: string
}

const games: Game[] = [
  { id: 'mafia', title: 'مافیای سریع', subtitle: 'نقش بگیر، شک کن، رأی بده', players: '۶ تا ۱۰ نفر', duration: '۱۰ تا ۱۵ دقیقه', tone: 'ماجراجویی اجتماعی', icon: Swords, accent: 'pink', art: '✦' },
  { id: 'tic-tac-toe', title: 'دوز', subtitle: 'رقابت سریع، تصمیم دقیق', players: '۲ نفر', duration: '۱ تا ۳ دقیقه', tone: 'استراتژی فوری', icon: Grid2X2, accent: 'cyan', art: '✕' },
  { id: 'truth-dare', title: 'جرئت یا حقیقت', subtitle: 'کارت بکش و جمع رو بخندون', players: '۲ تا ۸ نفر', duration: 'آزاد', tone: 'پارتی و گفتگو', icon: Sparkles, accent: 'gold', art: '✺' },
  { id: 'snakes', title: 'مارپله', subtitle: 'تاس بریز و از پله‌ها بالا برو', players: '۲ تا ۴ نفر', duration: '۸ تا ۱۲ دقیقه', tone: 'شانس و هیجان', icon: Dice5, accent: 'lime', art: '⌁' },
]

const truthCards = [
  'آخرین چیزی که بی‌دلیل خندیدت چی بود؟',
  'اگر یک روز نامرئی می‌شدی، اولین کارت چی بود؟',
  'بهترین خاطرهٔ جمعی‌ات با دوستات چیه؟',
  'اگر یک مهارت جادویی داشتی، چی انتخاب می‌کردی؟',
  'آخرین آهنگی که تکراری گوش دادی چی بود؟',
]
const dareCards = [
  'با سه کلمه یک خاطرهٔ خنده‌دار تعریف کن.',
  'برای یکی از بازیکن‌ها یک تعریف واقعی بگو.',
  'تا دور بعدی با یک لقب بامزه صدات می‌کنیم.',
  'یک ایموجی انتخاب کن و بگذار بقیه معنایش را حدس بزنند.',
  'یک خاطره را طوری تعریف کن که انگار گزارشگر مسابقه‌ای.',
]
const snakes = new Map([[17, 7], [54, 34], [62, 19], [87, 36], [93, 73]])
const ladders = new Map([[4, 14], [9, 31], [20, 38], [28, 84], [40, 59], [51, 67], [71, 91]])

const avatar = (label: string, tone = 'violet', extra = '') => <span className={`avatar avatar-${tone} ${extra}`} aria-hidden="true">{label}</span>
const initial = (name?: string) => (name || 'ب').trim().charAt(0) || 'ب'
const gameById = (id: GameId) => games.find((game) => game.id === id) || games[0]

function App() {
  const [page, setPage] = useState<Page>('home')
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => (localStorage.getItem('partyplay-theme') as ThemePreference) || 'system')
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedGame, setSelectedGame] = useState<GameId>('tic-tac-toe')
  const [toast, setToast] = useState('')
  const [nameDraft, setNameDraft] = useState('')
  const [groupDraft, setGroupDraft] = useState('')
  const [localBoard, setLocalBoard] = useState<(null | 'X' | 'O')[]>(Array(9).fill(null))
  const [localTurn, setLocalTurn] = useState<'X' | 'O'>('X')
  const [truthMode, setTruthMode] = useState<'truth' | 'dare'>('truth')
  const [truthIndex, setTruthIndex] = useState(0)
  const [truthDone, setTruthDone] = useState(0)
  const [snakePosition, setSnakePosition] = useState(1)
  const [lastRoll, setLastRoll] = useState<number | null>(null)
  const [mafiaPhase, setMafiaPhase] = useState<PracticePhase>('setup')
  const [mafiaRole, setMafiaRole] = useState('')
  const [mafiaVote, setMafiaVote] = useState<string | null>(null)
  const { profile, groups, loading, refresh, createGroup } = usePartyPlayData()
  const { room: onlineRoom, currentUserId: onlineUserId, pending: onlinePending, createRoom: createOnlineRoom, joinRoom: joinOnlineRoom, start: startOnlineRoom, move: makeOnlineMove } = useOnlineTicTacToe()

  const activeGame = gameById(selectedGame)
  const currentTheme = themePreference === 'system' ? (systemDark ? 'dark' : 'light') : themePreference
  const playerName = profile?.displayName || 'بازیکن'
  const playerInitial = initial(playerName)
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
    if (!inviteCode || onlineRoom) return
    void joinOnlineRoom(inviteCode).then(() => {
      setSelectedGame('tic-tac-toe')
      setPage('room')
      setToast('وارد لابی دوز شدی.')
    }).catch(showOnlineError)
  }, [joinOnlineRoom, onlineRoom])

  const showOnlineError = (error: unknown) => setToast(error instanceof Error ? error.message : 'ارتباط با بازی کامل نشد. دوباره تلاش کن.')
  const resetPractice = (game: GameId) => {
    setSelectedGame(game)
    setLocalBoard(Array(9).fill(null))
    setLocalTurn('X')
    setTruthMode('truth')
    setTruthIndex(0)
    setTruthDone(0)
    setSnakePosition(1)
    setLastRoll(null)
    setMafiaPhase('setup')
    setMafiaRole('')
    setMafiaVote(null)
  }
  const startPractice = (game: GameId) => {
    resetPractice(game)
    setPage('game')
    setToast(game === 'tic-tac-toe' ? 'تمرین دوز با ربات شروع شد.' : `${gameById(game).title} آماده است؛ شروع کن.`)
  }
  const createOnlineTicTacToe = () => {
    setSelectedGame('tic-tac-toe')
    void createOnlineRoom('چالش دوز').then(() => {
      setPage('room')
      setToast('لابی خصوصی آماده شد؛ لینک را برای یک حریف بفرست.')
    }).catch(showOnlineError)
  }
  const makePracticeMove = (index: number) => {
    if (selectedGame !== 'tic-tac-toe' || localBoard[index] || localTurn !== 'X' || localWinner) return
    setLocalBoard((previous) => previous.map((value, cellIndex) => cellIndex === index ? 'X' : value))
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
  }
  const drawCard = (mode: 'truth' | 'dare') => {
    const deck = mode === 'truth' ? truthCards : dareCards
    setTruthMode(mode)
    setTruthIndex((index) => (index + 1) % deck.length)
  }
  const beginMafia = () => {
    const roles = ['شهروند', 'کارآگاه', 'پزشک', 'مافیا']
    setMafiaRole(roles[Math.floor(Math.random() * roles.length)])
    setMafiaPhase('playing')
    setMafiaVote(null)
  }
  const saveDisplayName = () => {
    void refresh(nameDraft).then((next) => {
      if (next) setToast('نام نمایشی‌ات ذخیره شد.')
    }).catch(showOnlineError)
  }
  const addGroup = () => {
    void createGroup(groupDraft).then((group) => {
      setGroupDraft('')
      setToast(`گروه «${group.name}» ساخته شد.`)
    }).catch(showOnlineError)
  }

  const renderPage = () => {
    if (page === 'games') return <GamesPage onBack={() => setPage('home')} onPractice={startPractice} onOnlineTicTacToe={createOnlineTicTacToe} />
    if (page === 'friends') return <FriendsPage onBack={() => setPage('home')} onPractice={() => startPractice('tic-tac-toe')} />
    if (page === 'groups') return <GroupsPage onBack={() => setPage('home')} groups={groups} draft={groupDraft} onDraft={setGroupDraft} onCreate={addGroup} />
    if (page === 'profile') return <ProfilePage profileName={playerName} username={profile?.username || ''} draft={nameDraft} onDraft={setNameDraft} onSave={saveDisplayName} theme={themePreference} onTheme={setThemePreference} onBack={() => setPage('home')} />
    if (page === 'room' && onlineRoom) return <OnlineTicTacToeRoom room={onlineRoom} currentUserId={onlineUserId} pending={onlinePending} onBack={() => setPage('home')} onStart={() => void startOnlineRoom().then(() => setPage('game')).catch(showOnlineError)} onInvite={() => { const link = `${window.location.origin}${window.location.pathname}?room=${onlineRoom.room.invite_code}`; if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(link); setToast('لینک دعوت کپی شد.') }} />
    if (page === 'game') return <GamePage game={activeGame} playerName={playerName} playerInitial={playerInitial} onlineRoom={onlineRoom} onlineUserId={onlineUserId} onlinePending={onlinePending} localBoard={localBoard} localWinner={localWinner} localTurn={localTurn} onLocalMove={makePracticeMove} onOnlineMove={(index) => void makeOnlineMove(index).catch(showOnlineError)} onRestart={() => resetPractice(selectedGame)} truthMode={truthMode} truthIndex={truthIndex} truthDone={truthDone} onDraw={drawCard} onTruthDone={() => setTruthDone((value) => value + 1)} snakePosition={snakePosition} lastRoll={lastRoll} onRoll={rollDice} onSnakeRestart={() => { setSnakePosition(1); setLastRoll(null) }} mafiaPhase={mafiaPhase} mafiaRole={mafiaRole} mafiaVote={mafiaVote} onBeginMafia={beginMafia} onVote={setMafiaVote} onBack={() => setPage('home')} />
    return <HomePage name={playerName} initial={playerInitial} groups={groups} loading={loading} onPractice={startPractice} onCreateOnline={createOnlineTicTacToe} onGames={() => setPage('games')} onGroups={() => setPage('groups')} />
  }

  const navItems: Array<{ id: Page; label: string; icon: typeof Home }> = [
    { id: 'home', label: 'خانه', icon: Home }, { id: 'games', label: 'بازی‌ها', icon: Gamepad2 }, { id: 'friends', label: 'دوستان', icon: Users }, { id: 'groups', label: 'گروه‌ها', icon: Users },
  ]

  return <AuthGate theme={currentTheme}>
    <div className="app-shell" data-theme={currentTheme} dir="rtl">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        <button className="brand" onClick={() => { setPage('home'); setMobileMenuOpen(false) }} aria-label="خانهٔ پارتی‌پلی"><span className="brand-mark"><span>◈</span><i/><i/><i/><i/></span><span className="brand-text">پارتی<span>پلی</span></span></button>
        <div className="nav-section"><p className="nav-caption">فضای بازی</p>{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? 'nav-active' : ''}`} onClick={() => { setPage(id); setMobileMenuOpen(false) }}><Icon size={20}/><span>{label}</span></button>)}</div>
        <div className="sidebar-spacer" />
        <button className={`nav-item profile-nav ${page === 'profile' ? 'nav-active' : ''}`} onClick={() => setPage('profile')}>{avatar(playerInitial, 'pink')}<span>{playerName}</span><Settings2 size={18}/></button>
      </aside>
      <main className="main-content">
        <header className="topbar"><button className="mobile-menu-button icon-button" onClick={() => setMobileMenuOpen((open) => !open)} aria-label="باز کردن منو"><Menu size={22}/></button><div className="breadcrumb"><span>پارتی‌پلی</span><ChevronLeft size={16}/><strong>{page === 'home' ? 'خانه' : page === 'game' ? 'بازی' : page === 'room' ? 'لابی دوز' : page === 'profile' ? 'پروفایل' : page === 'groups' ? 'گروه‌ها' : page === 'friends' ? 'دوستان' : 'بازی‌ها'}</strong></div><div className="top-actions"><button className="theme-toggle icon-button" onClick={() => setThemePreference(currentTheme === 'dark' ? 'light' : 'dark')} aria-label="تغییر تم">{currentTheme === 'dark' ? <Sun size={19}/> : <Moon size={19}/>}</button><button className="top-avatar" onClick={() => setPage('profile')}>{avatar(playerInitial, 'pink')}</button></div></header>
        <div className="page-container">{renderPage()}</div>
      </main>
      {profile?.displayName === 'بازیکن جدید' && <div className="identity-backdrop" role="presentation"><section className="identity-dialog" role="dialog" aria-modal="true" aria-label="انتخاب نام نمایشی"><span className="eyebrow"><Sparkles size={15}/> خوش اومدی</span><h2>دوستات با چه اسمی صدات کنن؟</h2><p>این نام در اتاق‌ها، دعوت‌ها و نتیجهٔ بازی نشان داده می‌شود؛ بعداً هم قابل تغییر است.</p><input className="text-field" autoFocus value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} placeholder="مثلاً کیان" maxLength={40}/><button className="primary-button full-button" onClick={saveDisplayName} disabled={nameDraft.trim().length < 1}>ادامه با این نام</button></section></div>}
      {toast && <div className="toast"><Check size={18}/><span>{toast}</span><button onClick={() => setToast('')}><X size={16}/></button></div>}
    </div>
  </AuthGate>
}

function HomePage({ name, initial, groups, loading, onPractice, onCreateOnline, onGames, onGroups }: { name: string; initial: string; groups: ReturnType<typeof usePartyPlayData>['groups']; loading: boolean; onPractice: (game: GameId) => void; onCreateOnline: () => void; onGames: () => void; onGroups: () => void }) {
  return <>
    <section className="welcome-row"><div><span className="eyebrow"><Sparkles size={15}/> حساب تو</span><h1>سلام {name}، <span>بازی رو شروع کنیم؟</span></h1><p>با ربات تمرین کن یا برای یک دوست، اتاق آنلاین دوز بساز.</p></div><button className="primary-button create-button" onClick={onCreateOnline}><Plus size={19}/>اتاق دوز آنلاین</button></section>
    <section className="quick-play"><div className="quick-content"><div className="quick-copy"><span className="pill"><Bot size={14}/> همیشه آماده</span><h2>بدون معطلی بازی کن.</h2><p>تمرین‌ها فوری‌اند؛ برای دوز آنلاین، لینک اختصاصی حریفت را بفرست.</p><div className="quick-actions"><button className="quick-primary" onClick={() => onPractice('tic-tac-toe')}><Bot size={17}/>تمرین دوز</button><button className="quick-secondary" onClick={onCreateOnline}><Link2 size={18}/>ساخت لینک دعوت</button></div></div><div className="quick-orbit"><span className="orbit-token token-x">✕</span><span className="orbit-token token-o">○</span><span className="orbit-token token-dice">⚄</span><div className="quick-badge">{avatar(initial, 'pink')}<strong>آماده‌ای</strong><span>یک بازی انتخاب کن</span></div></div></div>
    </section>
    <section className="section-heading"><div><span className="eyebrow">بازی‌های قابل اجرا</span><h2>انتخاب کن و شروع کن</h2></div><button className="text-button" onClick={onGames}>دیدن همه <ArrowLeft size={16}/></button></section>
    <section className="games-grid">{games.map((game) => <GameCard key={game.id} game={game} action={game.id === 'tic-tac-toe' ? 'تمرین با ربات' : 'شروع تمرین'} onPlay={() => onPractice(game.id)} />)}</section>
    <section className="dashboard-grid"><div className="panel friends-panel"><div className="panel-heading"><div><span className="eyebrow">دوستان</span><h2>فعلاً دوستی نداری</h2></div></div><div className="empty-inline"><UserPlus size={22}/><p>اولین دوستت را با شناسهٔ کاربری‌اش اضافه کن؛ بعد چالش مستقیم هم فعال می‌شود.</p></div></div><div className="panel activity-panel"><div className="panel-heading"><div><span className="eyebrow">بازی آنلاین</span><h2>دوز دونفره</h2></div></div><div className="empty-inline"><Grid2X2 size={22}/><p>اتاق بساز، لینک را بفرست و بعد از ورود حریف، بازی را شروع کن.</p><button className="text-button" onClick={onCreateOnline}>ساخت اتاق <ArrowLeft size={15}/></button></div></div></section>
    <section className="section-heading compact-heading"><div><span className="eyebrow">جمع‌های همیشگی</span><h2>گروه‌های تو</h2></div><button className="text-button" onClick={onGroups}>مدیریت گروه‌ها <ArrowLeft size={16}/></button></section>
    {loading ? <div className="panel loading-panel">در حال خواندن داده‌های حساب…</div> : groups.length ? <section className="groups-strip">{groups.map((group) => <button className="group-card group-violet" key={group.id} onClick={onGroups}><span className="group-icon"><Users size={20}/></span><span><strong>{group.name}</strong><small>{group.memberCount} عضو</small></span><ChevronLeft size={18}/></button>)}<button className="group-add" onClick={onGroups}><Plus size={21}/><span>ساخت گروه</span></button></section> : <button className="empty-group-cta" onClick={onGroups}><span><Plus size={22}/></span><strong>هنوز گروهی نساختی</strong><small>برای دورهمی‌های همیشگی یک گروه واقعی بساز</small></button>}
  </>
}

function GameCard({ game, action, onPlay }: { game: Game; action: string; onPlay: () => void }) { const Icon = game.icon; return <article className={`game-card accent-${game.accent}`}><div className="game-card-top"><div className="game-icon"><Icon size={23}/></div><span className="game-art">{game.art}</span></div><div className="game-card-copy"><p>{game.tone}</p><h3>{game.title}</h3><span>{game.subtitle}</span></div><div className="game-card-bottom"><div><small><Users size={14}/>{game.players}</small><small>· {game.duration}</small></div><button onClick={onPlay}><Play size={16} fill="currentColor"/>{action}</button></div></article> }

function GamesPage({ onBack, onPractice, onOnlineTicTacToe }: { onBack: () => void; onPractice: (game: GameId) => void; onOnlineTicTacToe: () => void }) { return <section className="sub-page"><PageTitle eyebrow="بازی کن" title="بازی رو انتخاب کن" description="هر کارت همین حالا یک تجربهٔ قابل‌بازی باز می‌کند." onBack={onBack}/><div className="all-games-grid">{games.map((game) => <GameCard game={game} key={game.id} action={game.id === 'tic-tac-toe' ? 'تمرین' : 'شروع'} onPlay={() => onPractice(game.id)}/>)}</div><section className="mode-panel"><div><span className="eyebrow">دوز واقعی دونفره</span><h2>برای رقابت با دوستت، لینک اختصاصی بساز</h2></div><button className="primary-button" onClick={onOnlineTicTacToe}><Link2 size={18}/>ساخت اتاق آنلاین</button></section></section> }

function FriendsPage({ onBack, onPractice }: { onBack: () => void; onPractice: () => void }) { return <section className="sub-page"><PageTitle eyebrow="جمع تو" title="دوستان" description="فهرست فقط دوستان واقعی تأییدشدهٔ حساب تو را نمایش می‌دهد." onBack={onBack}/><section className="panel empty-page"><span className="empty-icon"><Users size={28}/></span><h2>هنوز دوستی اضافه نکردی</h2><p>دوست‌ها و درخواست‌ها از دادهٔ واقعی حسابت خوانده می‌شوند؛ به‌جای مخاطب ساختگی، اینجا تا اولین افزودن خالی می‌ماند.</p><button className="primary-button" onClick={onPractice}><Bot size={18}/>تا آن موقع با ربات تمرین کن</button></section></section> }

function GroupsPage({ onBack, groups, draft, onDraft, onCreate }: { onBack: () => void; groups: ReturnType<typeof usePartyPlayData>['groups']; draft: string; onDraft: (value: string) => void; onCreate: () => void }) { return <section className="sub-page"><PageTitle eyebrow="جمع‌های همیشگی" title="گروه‌ها" description="فقط گروه‌های واقعی ساخته‌شده در حساب خودت اینجا دیده می‌شوند." onBack={onBack}/><section className="panel group-create-panel"><div><span className="eyebrow">گروه تازه</span><h2>جمع خودت را بساز</h2><p>بعداً می‌توانی دوست‌ها را به این گروه اضافه و همه را یک‌جا دعوت کنی.</p></div><div className="group-create-form"><input className="text-field" value={draft} onChange={(event) => onDraft(event.target.value)} placeholder="مثلاً شب‌های بازی" maxLength={40}/><button className="primary-button" onClick={onCreate} disabled={draft.trim().length < 2}><Plus size={18}/>ساخت گروه</button></div></section>{groups.length ? <section className="group-page-grid">{groups.map((group) => <article className="group-detail-card group-violet" key={group.id}><div className="group-detail-head"><span className="group-icon"><Users size={25}/></span><span className="pill">واقعی</span></div><h2>{group.name}</h2><p>{group.description || 'هنوز توضیحی ثبت نشده'} </p><div className="group-meta"><Users size={16}/>{group.memberCount} عضو</div></article>)}</section> : <section className="panel empty-page"><span className="empty-icon"><Users size={28}/></span><h2>گروهی نداری</h2><p>نمونه‌های نمایشی حذف شده‌اند. نام گروهت را بالا وارد کن تا اولین گروه واقعی ساخته شود.</p></section>}</section> }

function ProfilePage({ profileName, username, draft, onDraft, onSave, theme, onTheme, onBack }: { profileName: string; username: string; draft: string; onDraft: (value: string) => void; onSave: () => void; theme: ThemePreference; onTheme: (value: ThemePreference) => void; onBack: () => void }) { return <section className="sub-page"><PageTitle eyebrow="حساب کاربری" title="پروفایل و تنظیمات" description="این نام و شناسه واقعاً از حساب PartyPlay تو خوانده می‌شوند." onBack={onBack}/><div className="profile-grid"><section className="panel profile-card"><div className="profile-hero">{avatar(initial(profileName), 'pink', 'profile-avatar')}</div><h2>{profileName}</h2><p>{username ? `@${username}` : 'در حال آماده‌سازی شناسه…'}</p><div className="profile-stats"><span><b>۰</b>بازی ثبت‌شده</span><span><b>۰</b>برد</span><span><b>۰</b>دوست</span></div></section><section className="settings-list"><div className="panel setting-block"><div className="setting-heading"><div><span className="eyebrow">هویت</span><h2>نام نمایشی</h2></div><Settings2 size={20}/></div><div className="inline-form"><input className="text-field" value={draft} onChange={(event) => onDraft(event.target.value)} maxLength={40} placeholder="نامی که دوستات می‌بینند"/><button className="primary-button" onClick={onSave} disabled={draft.trim().length < 1}>ذخیره</button></div></div><div className="panel setting-block"><div className="setting-heading"><div><span className="eyebrow">ظاهر</span><h2>تم بازی</h2></div><Settings2 size={20}/></div><div className="theme-options">{([['system', 'همگام با سیستم'], ['light', 'روشن'], ['dark', 'تاریک']] as const).map(([value, label]) => <button key={value} className={`theme-option ${theme === value ? 'theme-selected' : ''}`} onClick={() => onTheme(value)}><span>{label}</span>{theme === value && <Check size={17}/>}</button>)}</div></div></section></div></section> }

function GamePage({ game, playerName, playerInitial, onlineRoom, onlineUserId, onlinePending, localBoard, localWinner, localTurn, onLocalMove, onOnlineMove, onRestart, truthMode, truthIndex, truthDone, onDraw, onTruthDone, snakePosition, lastRoll, onRoll, onSnakeRestart, mafiaPhase, mafiaRole, mafiaVote, onBeginMafia, onVote, onBack }: { game: Game; playerName: string; playerInitial: string; onlineRoom: ReturnType<typeof useOnlineTicTacToe>['room']; onlineUserId: string | null; onlinePending: boolean; localBoard: (null|'X'|'O')[]; localWinner: string | null; localTurn: 'X'|'O'; onLocalMove: (index: number) => void; onOnlineMove: (index: number) => void; onRestart: () => void; truthMode: 'truth'|'dare'; truthIndex: number; truthDone: number; onDraw: (mode: 'truth'|'dare') => void; onTruthDone: () => void; snakePosition: number; lastRoll: number | null; onRoll: () => void; onSnakeRestart: () => void; mafiaPhase: PracticePhase; mafiaRole: string; mafiaVote: string | null; onBeginMafia: () => void; onVote: (name: string) => void; onBack: () => void }) {
  const Icon = game.icon
  const hasOnlineTicTacToe = game.id === 'tic-tac-toe' && onlineRoom?.session && onlineUserId
  return <section className={`game-page accent-${game.accent}`}><div className="game-topline"><button className="back-link" onClick={onBack}><ChevronLeft size={17}/>خانه</button><div className="live-status"><span className="pulse-dot"/>{hasOnlineTicTacToe ? 'بازی آنلاین' : 'تمرین قابل‌بازی'}</div></div><div className="game-header"><div className="game-header-title"><span className="game-icon"><Icon size={21}/></span><div><strong>{game.title}</strong><span>{hasOnlineTicTacToe ? onlineRoom.room.name : 'شروع فوری'}</span></div></div><button className="secondary-button" onClick={onRestart}><Zap size={16}/>شروع دوباره</button></div>{hasOnlineTicTacToe ? <OnlineTicTacToe room={onlineRoom} session={onlineRoom.session!} currentUserId={onlineUserId} pending={onlinePending} onMove={onOnlineMove} onRematch={onRestart}/> : game.id === 'tic-tac-toe' ? <PracticeTicTacToe board={localBoard} winner={localWinner} turn={localTurn} playerName={playerName} playerInitial={playerInitial} onMove={onLocalMove} onRestart={onRestart}/> : game.id === 'truth-dare' ? <TruthDare mode={truthMode} index={truthIndex} done={truthDone} onDraw={onDraw} onDone={onTruthDone}/> : game.id === 'snakes' ? <SnakesAndLadders position={snakePosition} lastRoll={lastRoll} onRoll={onRoll} onRestart={onSnakeRestart}/> : <MafiaPractice phase={mafiaPhase} role={mafiaRole} vote={mafiaVote} onBegin={onBeginMafia} onVote={onVote}/>}</section>
}

function PracticeTicTacToe({ board, winner, turn, playerName, playerInitial, onMove, onRestart }: { board: (null|'X'|'O')[]; winner: string | null; turn: 'X'|'O'; playerName: string; playerInitial: string; onMove: (index: number) => void; onRestart: () => void }) { const message = winner === 'X' ? 'بردی! خط X کامل شد.' : winner === 'O' ? 'ربات این دور را برد؛ یک دور دیگر؟' : winner === 'draw' ? 'مساوی شد؛ حرکت بعدی با توست.' : turn === 'X' ? 'نوبت توئه؛ یک خانه انتخاب کن.' : 'ربات در حال انتخاب حرکت است…'; return <div className="play-layout"><aside className="player-card current-player">{avatar(playerInitial,'pink','large-avatar')}<div><span>تو</span><strong>{playerName}</strong><small>مهرهٔ X</small></div><b className="player-mark">X</b></aside><main className="board-panel"><div className="turn-message"><span className="turn-badge">{turn}</span><p>{message}</p></div><div className="tic-board" aria-label="صفحهٔ تمرین دوز">{board.map((cell, index) => <button key={index} className={`tic-cell ${cell ? `mark-${cell}` : ''}`} onClick={() => onMove(index)} disabled={Boolean(cell) || Boolean(winner) || turn !== 'X'} aria-label={`خانهٔ ${index + 1}`}>{cell}</button>)}</div>{winner && <button className="primary-button rematch-button" onClick={onRestart}><Zap size={17}/>یه دور دیگه</button>}<div className="board-meta"><span>تمرین با ربات</span><i/><span>قابل بازی آفلاین</span></div></main><aside className="player-card rival-player">{avatar('ر','cyan','large-avatar')}<div><span>حریف</span><strong>ربات پارتی‌پلی</strong><small>مهرهٔ O</small></div><b className="player-mark">O</b></aside></div> }

function TruthDare({ mode, index, done, onDraw, onDone }: { mode: 'truth'|'dare'; index: number; done: number; onDraw: (mode: 'truth'|'dare') => void; onDone: () => void }) { const card = (mode === 'truth' ? truthCards : dareCards)[index]; return <div className="practice-stage truth-stage"><span className="preview-symbol"><Sparkles size={48}/></span><span className="pill">کارت {mode === 'truth' ? 'حقیقت' : 'جرئت'}</span><h2>«{card}»</h2><p>کارت را انجام دادی؟ علامت بزن و کارت بعدی را بکش.</p><div className="preview-actions"><button className={`secondary-button ${mode === 'truth' ? 'choice-active' : ''}`} onClick={() => onDraw('truth')}>حقیقت</button><button className={`primary-button ${mode === 'dare' ? 'choice-active' : ''}`} onClick={() => onDraw('dare')}>جرئت</button></div><button className="text-button done-button" onClick={onDone}><Check size={17}/>انجام شد ({done})</button></div> }

function SnakesAndLadders({ position, lastRoll, onRoll, onRestart }: { position: number; lastRoll: number | null; onRoll: () => void; onRestart: () => void }) { const special = snakes.has(position) ? 'مار!' : ladders.has(position) ? 'پله!' : ''; return <div className="snakes-layout"><div className="snake-board" aria-label="صفحهٔ مارپله">{Array.from({ length: 100 }, (_, index) => { const cell = 100 - index; return <div className={`snake-cell ${position === cell ? 'token-here' : ''} ${snakes.has(cell) ? 'snake-cell-snake' : ladders.has(cell) ? 'snake-cell-ladder' : ''}`} key={cell}><small>{cell}</small>{position === cell && <span>●</span>}{snakes.has(cell) && <i>⌁</i>}{ladders.has(cell) && <i>⇡</i>}</div> })}</div><aside className="practice-side"><span className="preview-symbol"><Dice5 size={44}/></span><h2>{position >= 100 ? 'برنده شدی!' : 'تاس را بنداز'}</h2><p>{lastRoll ? `تاس ${lastRoll} آمد. روی خانهٔ ${position} هستی. ${special}` : 'با تاس حرکت کن؛ پله‌ها کمکت می‌کنند و مارها غافلگیرت می‌کنند.'}</p><button className="primary-button full-button" onClick={onRoll} disabled={position >= 100}><Dice5 size={18}/>انداختن تاس</button><button className="secondary-button full-button" onClick={onRestart}>شروع دوباره</button></aside></div> }

function MafiaPractice({ phase, role, vote, onBegin, onVote }: { phase: PracticePhase; role: string; vote: string | null; onBegin: () => void; onVote: (name: string) => void }) { const suspects = ['رها', 'نیلا', 'مانی', 'آرین']; if (phase === 'setup') return <div className="practice-stage mafia-stage"><span className="preview-symbol"><Swords size={48}/></span><span className="pill">تمرین نقش‌ها</span><h2>نقش محرمانه‌ات را بگیر</h2><p>این تمرین منطق اصلی مافیا—نقش، روز و رأی—را بدون انتظار برای بازیکن‌های دیگر نشان می‌دهد.</p><button className="primary-button" onClick={onBegin}><Play size={17}/>شروع دور تمرینی</button></div>; if (vote) return <div className="practice-stage mafia-stage"><span className="preview-symbol"><Check size={48}/></span><h2>رأی تو ثبت شد</h2><p>به {vote} رأی دادی. در بازی آنلاین، پس از رأی همه نتیجه نمایش داده می‌شود.</p><button className="secondary-button" onClick={onBegin}>دور تازه</button></div>; return <div className="practice-stage mafia-stage"><span className="pill">نقش تو: {role}</span><h2>روز اول؛ وقت رأی</h2><p>به کسی رأی بده که بیشتر به او شک داری.</p><div className="suspect-grid">{suspects.map((suspect) => <button key={suspect} onClick={() => onVote(suspect)}>{avatar(initial(suspect),'violet')}<span>{suspect}</span></button>)}</div></div> }

function PageTitle({ eyebrow, title, description, onBack }: { eyebrow: string; title: string; description: string; onBack: () => void }) { return <div className="page-title"><button className="back-link" onClick={onBack}><ChevronLeft size={17}/>خانه</button><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div> }

export default App
