import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Bell,
  Bot,
  Check,
  ChevronLeft,
  CircleHelp,
  Clock3,
  Copy,
  Crown,
  Dice5,
  Gamepad2,
  Grid2X2,
  Home,
  Link2,
  LockKeyhole,
  Menu,
  Moon,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Swords,
  UserPlus,
  UserRound,
  Users,
  Volume2,
  Wifi,
  X,
  Zap,
} from 'lucide-react'
import './App.css'

type Page = 'home' | 'games' | 'friends' | 'groups' | 'profile' | 'room' | 'game'
type ThemePreference = 'system' | 'light' | 'dark'
type GameId = 'mafia' | 'tic-tac-toe' | 'truth-dare' | 'snakes'

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
  {
    id: 'mafia',
    title: 'مافیای سریع',
    subtitle: 'حرف بزن، شک کن، رأی بده',
    players: '۶ تا ۱۰ نفر',
    duration: '۱۰ تا ۱۵ دقیقه',
    tone: 'ماجراجویی اجتماعی',
    icon: Swords,
    accent: 'pink',
    art: '✦',
  },
  {
    id: 'tic-tac-toe',
    title: 'دوز',
    subtitle: 'رقابت سریع، تصمیم دقیق',
    players: '۲ نفر',
    duration: '۱ تا ۳ دقیقه',
    tone: 'استراتژی فوری',
    icon: Grid2X2,
    accent: 'cyan',
    art: '✕',
  },
  {
    id: 'truth-dare',
    title: 'جرئت یا حقیقت',
    subtitle: 'کارت بکش و جمع رو بخندون',
    players: '۲ تا ۸ نفر',
    duration: 'آزاد',
    tone: 'پارتی و گفتگو',
    icon: Sparkles,
    accent: 'gold',
    art: '✺',
  },
  {
    id: 'snakes',
    title: 'مارپله',
    subtitle: 'تاس بریز و از پله‌ها بالا برو',
    players: '۲ تا ۴ نفر',
    duration: '۸ تا ۱۲ دقیقه',
    tone: 'شانس و هیجان',
    icon: Dice5,
    accent: 'lime',
    art: '⌁',
  },
]

const friends = [
  { name: 'رها', handle: '@raha', status: 'آمادهٔ بازی', color: 'rose', initials: 'ر' },
  { name: 'مانی', handle: '@manix', status: 'در حال بازی', color: 'cyan', initials: 'م' },
  { name: 'نیلا', handle: '@nila', status: 'آنلاین', color: 'violet', initials: 'ن' },
  { name: 'آرین', handle: '@aryan', status: '۲ دقیقه پیش', color: 'gold', initials: 'آ' },
]

const groups = [
  { name: 'شب‌های جمعه', members: 8, online: 4, color: 'violet' },
  { name: 'تیم قهوه‌خورها', members: 12, online: 3, color: 'pink' },
]

const avatar = (label: string, tone = 'violet', extra = '') => (
  <span className={`avatar avatar-${tone} ${extra}`} aria-hidden="true">
    {label}
  </span>
)

function App() {
  const [page, setPage] = useState<Page>('home')
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    return (localStorage.getItem('partyplay-theme') as ThemePreference) || 'system'
  })
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedGame, setSelectedGame] = useState<GameId>('mafia')
  const [roomName, setRoomName] = useState('دورهمی امشب')
  const [capacity, setCapacity] = useState(6)
  const [hasPassword, setHasPassword] = useState(false)
  const [toast, setToast] = useState('')
  const [board, setBoard] = useState<(null | 'X' | 'O')[]>(Array(9).fill(null))
  const [turn, setTurn] = useState<'X' | 'O'>('X')
  const [gameMessage, setGameMessage] = useState('نوبت توئه؛ X رو روی یک خانه بذار.')

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => setSystemDark(query.matches)
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [])

  useEffect(() => {
    localStorage.setItem('partyplay-theme', themePreference)
  }, [themePreference])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const currentTheme = themePreference === 'system' ? (systemDark ? 'dark' : 'light') : themePreference
  const activeGame = games.find((game) => game.id === selectedGame) || games[0]

  const winner = useMemo(() => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6],
      [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6],
    ]
    for (const [a, b, c] of lines) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a]
    }
    return board.every(Boolean) ? 'draw' : null
  }, [board])

  useEffect(() => {
    if (selectedGame !== 'tic-tac-toe' || turn !== 'O' || winner) return
    const timer = window.setTimeout(() => {
      setBoard((previous) => {
        const free = previous.map((cell, index) => (cell ? -1 : index)).filter((index) => index >= 0)
        if (!free.length) return previous
        const next = [...previous]
        next[free[Math.floor(Math.random() * free.length)]] = 'O'
        return next
      })
      setTurn('X')
      setGameMessage('نوبت توئه؛ X رو روی یک خانه بذار.')
    }, 650)
    return () => window.clearTimeout(timer)
  }, [selectedGame, turn, winner])

  useEffect(() => {
    if (winner === 'X') setGameMessage('بردی! خط X کامل شد.')
    if (winner === 'O') setGameMessage('این دور رو مانی برد. یه دور دیگه؟')
    if (winner === 'draw') setGameMessage('مساوی شد؛ هیچ خانهٔ خالی باقی نمونده.')
  }, [winner])

  const showToast = (message: string) => setToast(message)

  const startQuickGame = (game: GameId) => {
    setSelectedGame(game)
    setPage('room')
    showToast('یک لابی سریع برای تو آماده شد.')
  }

  const createRoom = () => {
    setCreateOpen(false)
    setPage('room')
    showToast(`اتاق «${roomName || 'بدون نام'}» ساخته شد.`)
  }

  const startGame = () => {
    setPage('game')
    if (selectedGame === 'tic-tac-toe') {
      setBoard(Array(9).fill(null))
      setTurn('X')
      setGameMessage('نوبت توئه؛ X رو روی یک خانه بذار.')
    }
    showToast('بازی شروع شد. خوش بگذره!')
  }

  const makeMove = (index: number) => {
    if (selectedGame !== 'tic-tac-toe' || board[index] || turn !== 'X' || winner) return
    const next = [...board]
    next[index] = 'X'
    setBoard(next)
    setTurn('O')
    setGameMessage('مانی داره حرکت بعدیش رو انتخاب می‌کنه…')
  }

  const renderPage = () => {
    if (page === 'games') return <GamesPage onBack={() => setPage('home')} onSelect={startQuickGame} />
    if (page === 'friends') return <FriendsPage onBack={() => setPage('home')} onChallenge={(name) => { setSelectedGame('tic-tac-toe'); setPage('room'); showToast(`چالش برای ${name} آماده شد.`) }} />
    if (page === 'groups') return <GroupsPage onBack={() => setPage('home')} onChallenge={(name) => { setSelectedGame('mafia'); setPage('room'); showToast(`دعوت گروه ${name} آماده شد.`) }} />
    if (page === 'profile') return <ProfilePage theme={themePreference} onTheme={setThemePreference} onBack={() => setPage('home')} />
    if (page === 'room') return <RoomPage game={activeGame} capacity={capacity} hasPassword={hasPassword} onBack={() => setPage('home')} onStart={startGame} onInvite={() => showToast('لینک دعوت در کلیپ‌بورد کپی شد.')} />
    if (page === 'game') return <GamePage game={activeGame} board={board} message={gameMessage} winner={winner} onMove={makeMove} onRestart={() => { setBoard(Array(9).fill(null)); setTurn('X'); setGameMessage('نوبت توئه؛ X رو روی یک خانه بذار.') }} onBack={() => setPage('room')} />
    return <HomePage onSelectGame={startQuickGame} onCreate={() => setCreateOpen(true)} onFriends={() => setPage('friends')} onGroups={() => setPage('groups')} />
  }

  const navItems = [
    { id: 'home' as Page, label: 'خانه', icon: Home },
    { id: 'games' as Page, label: 'بازی‌ها', icon: Gamepad2 },
    { id: 'friends' as Page, label: 'دوستان', icon: Users },
    { id: 'groups' as Page, label: 'گروه‌ها', icon: UserRound },
  ]

  return (
    <div className="app-shell" data-theme={currentTheme} dir="rtl">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        <button className="brand" onClick={() => { setPage('home'); setMobileMenuOpen(false) }} aria-label="خانهٔ پارتی‌پلی">
          <span className="brand-mark"><span>◈</span><i /><i /><i /><i /></span>
          <span className="brand-text">پارتی<span>پلی</span></span>
        </button>
        <div className="nav-section">
          <p className="nav-caption">فضای بازی</p>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${page === id ? 'nav-active' : ''}`} onClick={() => { setPage(id); setMobileMenuOpen(false) }}>
              <Icon size={20} strokeWidth={2.1} />
              <span>{label}</span>
              {id === 'friends' && <em>۳</em>}
            </button>
          ))}
        </div>
        <div className="sidebar-spacer" />
        <div className="mini-card">
          <div className="mini-card-icon"><Sparkles size={17} /></div>
          <div>
            <strong>هر شب یه بازی</strong>
            <span>دوستات رو جمع کن</span>
          </div>
          <ChevronLeft size={17} />
        </div>
        <button className={`nav-item profile-nav ${page === 'profile' ? 'nav-active' : ''}`} onClick={() => { setPage('profile'); setMobileMenuOpen(false) }}>
          {avatar('پ', 'pink')}
          <span>پارسا</span>
          <Settings2 size={18} />
        </button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu-button icon-button" onClick={() => setMobileMenuOpen((open) => !open)} aria-label="باز کردن منو"><Menu size={22} /></button>
          <div className="breadcrumb"><span>پارتی‌پلی</span><ChevronLeft size={16} /><strong>{page === 'home' ? 'خانه' : page === 'games' ? 'بازی‌ها' : page === 'friends' ? 'دوستان' : page === 'groups' ? 'گروه‌ها' : page === 'profile' ? 'پروفایل' : page === 'room' ? 'لابی بازی' : 'در حال بازی'}</strong></div>
          <div className="top-actions">
            <button className="theme-toggle icon-button" onClick={() => setThemePreference(currentTheme === 'dark' ? 'light' : 'dark')} aria-label="تغییر تم">
              {currentTheme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button className="notification-button icon-button" onClick={() => showToast('۳ دعوت تازه منتظر پاسخ توئه.')} aria-label="اعلان‌ها"><Bell size={19} /><span>۳</span></button>
            <button className="top-avatar" onClick={() => setPage('profile')}>{avatar('پ', 'pink')}</button>
          </div>
        </header>
        <div className="page-container">{renderPage()}</div>
      </main>

      {createOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setCreateOpen(false)}>
          <section className="create-modal" role="dialog" aria-modal="true" aria-label="ساخت اتاق" onMouseDown={(event) => event.stopPropagation()}>
            <button className="close-button icon-button" onClick={() => setCreateOpen(false)} aria-label="بستن"><X size={19} /></button>
            <span className="eyebrow"><Plus size={15} /> اتاق تازه</span>
            <h2>یه جمع تازه بساز</h2>
            <p>بازی رو انتخاب کن، دوستات رو دعوت کن و شروع کن.</p>
            <label className="field-label">بازی</label>
            <div className="game-picker">
              {games.map((game) => {
                const Icon = game.icon
                return <button key={game.id} className={`picker-game ${selectedGame === game.id ? 'picker-selected' : ''} accent-${game.accent}`} onClick={() => { setSelectedGame(game.id); setCapacity(game.id === 'mafia' ? 6 : game.id === 'truth-dare' ? 4 : 2) }}><Icon size={19} /><span>{game.title}</span></button>
              })}
            </div>
            <label className="field-label" htmlFor="room-name">نام اتاق <small>اختیاری</small></label>
            <input id="room-name" className="text-field" value={roomName} onChange={(event) => setRoomName(event.target.value)} placeholder="مثلاً دورهمی امشب" />
            <div className="modal-grid">
              <div><label className="field-label">ظرفیت</label><div className="stepper"><button onClick={() => setCapacity((value) => Math.max(2, value - 1))}>−</button><strong>{capacity} نفر</strong><button onClick={() => setCapacity((value) => Math.min(10, value + 1))}>+</button></div></div>
              <div><label className="field-label">رمز اتاق</label><button className={`option-switch ${hasPassword ? 'switch-on' : ''}`} onClick={() => setHasPassword((value) => !value)}><LockKeyhole size={16} /><span>{hasPassword ? 'فعال است' : 'اختیاری'}</span><i /></button></div>
            </div>
            <button className="primary-button full-button" onClick={createRoom}><Zap size={18} />ساخت اتاق</button>
          </section>
        </div>
      )}

      {toast && <div className="toast"><Check size={18} /><span>{toast}</span><button onClick={() => setToast('')}><X size={16} /></button></div>}
    </div>
  )
}

function HomePage({ onSelectGame, onCreate, onFriends, onGroups }: { onSelectGame: (game: GameId) => void; onCreate: () => void; onFriends: () => void; onGroups: () => void }) {
  return <>
    <section className="welcome-row">
      <div><span className="eyebrow"><Wifi size={15} /> ۴ دوستت آنلاینن</span><h1>سلام پارسا، <span>آمادهٔ بازی‌ای؟</span></h1><p>یه بازی انتخاب کن یا جمع خودت رو به چالش بکش.</p></div>
      <button className="primary-button create-button" onClick={onCreate}><Plus size={19} />ساخت اتاق</button>
    </section>

    <section className="quick-play">
      <div className="quick-content"><div className="quick-copy"><span className="pill"><Zap size={14} /> سریع شروع کن</span><h2>یه حریف منتظرته.</h2><p>بدون ساخت اتاق، فقط بازی رو انتخاب کن و وارد مسابقه شو.</p><div className="quick-actions"><button className="quick-primary" onClick={() => onSelectGame('tic-tac-toe')}><Swords size={17} />حریف تصادفی</button><button className="quick-secondary" onClick={() => onSelectGame('tic-tac-toe')}><Bot size={18} />بازی با ربات</button></div></div><div className="quick-orbit"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><span className="orbit-token token-x">✕</span><span className="orbit-token token-o">○</span><span className="orbit-token token-dice">⚄</span><div className="quick-badge"><div className="pulse-dot"/><strong>۳۲ نفر</strong><span>در حال بازی</span></div></div></div>
    </section>

    <section className="section-heading"><div><span className="eyebrow">بازی‌ها</span><h2>امشب چی بازی کنیم؟</h2></div><button className="text-button" onClick={() => onSelectGame('mafia')}>دیدن همه <ArrowLeft size={16} /></button></section>
    <section className="games-grid">{games.map((game) => <GameCard key={game.id} game={game} onPlay={() => onSelectGame(game.id)} />)}</section>

    <section className="dashboard-grid">
      <div className="panel friends-panel"><div className="panel-heading"><div><span className="eyebrow">جمع تو</span><h2>دوستان آمادهٔ بازی</h2></div><button className="icon-button soft-button" onClick={onFriends}><Users size={18}/></button></div><div className="friend-list">{friends.slice(0, 3).map((friend) => <div className="friend-row" key={friend.handle}>{avatar(friend.initials, friend.color, 'has-status')}<div className="friend-meta"><strong>{friend.name}</strong><span>{friend.status}</span></div><button className="challenge-button" onClick={() => onSelectGame('tic-tac-toe')}><Swords size={15}/>چالش</button></div>)}</div><button className="list-link" onClick={onFriends}>دیدن همهٔ دوستان <ArrowLeft size={15}/></button></div>
      <div className="panel activity-panel"><div className="panel-heading"><div><span className="eyebrow">یادآوری</span><h2>دعوت‌های فعال</h2></div><button className="icon-button soft-button"><Bell size={18}/></button></div><div className="invite-card"><div className="invite-icon"><Swords size={19}/></div><div><strong>شب‌های جمعه</strong><span>به مافیای سریع دعوتت کرده</span><small><Clock3 size={13}/> ۸ دقیقه باقی مونده</small></div><button className="round-play" onClick={() => onSelectGame('mafia')}><Play size={17} fill="currentColor"/></button></div><div className="activity-divider"/><div className="last-game"><span className="game-dot"/><div><strong>آخرین بازی: مارپله</strong><span>تو و نیلا — ۱۲ دقیقه پیش</span></div><b>بردی</b></div></div>
    </section>

    <section className="section-heading compact-heading"><div><span className="eyebrow">جمع‌های همیشگی</span><h2>گروه‌هات</h2></div><button className="text-button" onClick={onGroups}>مدیریت گروه‌ها <ArrowLeft size={16} /></button></section>
    <section className="groups-strip">{groups.map((group) => <button className={`group-card group-${group.color}`} key={group.name} onClick={onGroups}><span className="group-icon"><Users size={20}/></span><span><strong>{group.name}</strong><small>{group.online} نفر آنلاین از {group.members} نفر</small></span><ChevronLeft size={18}/></button>)}<button className="group-add" onClick={onGroups}><Plus size={21}/><span>ساخت گروه</span></button></section>
  </>
}

function GameCard({ game, onPlay }: { game: Game; onPlay: () => void }) {
  const Icon = game.icon
  return <article className={`game-card accent-${game.accent}`}><div className="game-card-top"><div className="game-icon"><Icon size={23}/></div><span className="game-art">{game.art}</span><button className="game-more" aria-label={`گزینه‌های ${game.title}`}><MoreHorizontal size={18}/></button></div><div className="game-card-copy"><p>{game.tone}</p><h3>{game.title}</h3><span>{game.subtitle}</span></div><div className="game-card-bottom"><div><small><Users size={14}/>{game.players}</small><small><Clock3 size={14}/>{game.duration}</small></div><button onClick={onPlay}><Play size={16} fill="currentColor"/> بازی</button></div></article>
}

function GamesPage({ onBack, onSelect }: { onBack: () => void; onSelect: (game: GameId) => void }) {
  return <section className="sub-page"><PageTitle eyebrow="چهار بازی برای شروع" title="بازی رو انتخاب کن" description="هر بازی رو با دوست، گروه، حریف تصادفی یا ربات شروع کن." onBack={onBack}/><div className="all-games-grid">{games.map((game) => <GameCard game={game} key={game.id} onPlay={() => onSelect(game.id)} />)}</div><section className="mode-panel"><div><span className="eyebrow">راه‌های بازی</span><h2>فقط بازی رو انتخاب کن، باقی‌ش با پارتی‌پلی</h2></div><div className="mode-list"><span><Users/>دعوت دوست</span><span><Link2/>لینک اتاق</span><span><Zap/>حریف تصادفی</span><span><Bot/>ربات</span></div></section></section>
}

function FriendsPage({ onBack, onChallenge }: { onBack: () => void; onChallenge: (name: string) => void }) {
  return <section className="sub-page"><PageTitle eyebrow="جمع تو" title="دوستان" description="چالش بده، گروه بساز یا درخواست‌های تازه رو ببین." onBack={onBack}/><div className="social-toolbar"><div className="search-box"><Search size={18}/><input placeholder="جست‌وجو با نام یا شناسه" /></div><button className="primary-button"><UserPlus size={18}/>افزودن دوست</button></div><div className="tabs"><button className="tab-active">دوستان <span>۱۸</span></button><button>درخواست‌ها <span>۳</span></button><button>مسدودشده‌ها</button></div><div className="friends-layout"><section className="panel friend-directory">{friends.map((friend) => <div className="directory-row" key={friend.handle}>{avatar(friend.initials, friend.color, 'has-status')}<div><strong>{friend.name}</strong><span>{friend.handle} · {friend.status}</span></div><button className="challenge-button" onClick={() => onChallenge(friend.name)}><Swords size={15}/>چالش</button><button className="icon-button soft-button"><MoreHorizontal size={18}/></button></div>)}</section><aside className="panel requests-panel"><div className="panel-heading"><div><span className="eyebrow">تازه‌ها</span><h2>درخواست دوستی</h2></div></div><div className="request-user">{avatar('س', 'lime')}<div><strong>سارا</strong><span>@sara.play</span></div></div><div className="request-actions"><button className="accept-button"><Check size={17}/>قبول</button><button className="decline-button"><X size={17}/>رد</button></div><div className="request-user second">{avatar('ک', 'gold')}<div><strong>کیان</strong><span>@kian.g</span></div></div><div className="request-actions"><button className="accept-button"><Check size={17}/>قبول</button><button className="decline-button"><X size={17}/>رد</button></div></aside></div></section>
}

function GroupsPage({ onBack, onChallenge }: { onBack: () => void; onChallenge: (name: string) => void }) {
  return <section className="sub-page"><PageTitle eyebrow="جمع‌های همیشگی" title="گروه‌ها" description="برای دورهمی‌های تکراری یه گروه بساز و با یک لمس همه رو دعوت کن." onBack={onBack}/><div className="group-page-grid">{groups.map((group) => <article className={`group-detail-card group-${group.color}`} key={group.name}><div className="group-detail-head"><span className="group-icon"><Users size={25}/></span><button className="icon-button soft-button"><MoreHorizontal size={18}/></button></div><h2>{group.name}</h2><p>{group.members} عضو · {group.online} نفر آنلاین</p><div className="avatar-stack">{avatar('پ','pink')}{avatar('ر','rose')}{avatar('م','cyan')}{avatar('ن','violet')}<span>+{group.members - 4}</span></div><button className="primary-button full-button" onClick={() => onChallenge(group.name)}><Swords size={17}/>چالش گروهی</button></article>)}<button className="new-group-card"><span><Plus size={24}/></span><strong>گروه تازه بساز</strong><small>جمع خودت رو اینجا نگه دار</small></button></div></section>
}

function ProfilePage({ theme, onTheme, onBack }: { theme: ThemePreference; onTheme: (value: ThemePreference) => void; onBack: () => void }) {
  return <section className="sub-page"><PageTitle eyebrow="حساب کاربری" title="پروفایل و تنظیمات" description="ظاهر، صدا و حریم خصوصی فضای بازی‌ات رو اینجا تنظیم کن." onBack={onBack}/><div className="profile-grid"><section className="panel profile-card"><div className="profile-hero">{avatar('پ', 'pink', 'profile-avatar')}<button className="edit-avatar">ویرایش</button></div><h2>پارسا</h2><p>@parsa.play</p><div className="profile-stats"><span><b>۴۲</b>بازی</span><span><b>۲۶</b>برد</span><span><b>۱۸</b>دوست</span></div><button className="secondary-button full-button"><UserPlus size={17}/>اشتراک‌گذاری پروفایل</button></section><section className="settings-list"><div className="panel setting-block"><div className="setting-heading"><div><span className="eyebrow">ظاهر</span><h2>تم بازی</h2></div><Settings2 size={20}/></div><div className="theme-options">{([['system','همگام با سیستم', Settings2], ['light','روشن', Sun], ['dark','تاریک', Moon]] as const).map(([value, label, Icon]) => <button key={value} className={`theme-option ${theme === value ? 'theme-selected' : ''}`} onClick={() => onTheme(value)}><Icon size={19}/><span>{label}</span>{theme === value && <Check size={17}/>}</button>)}</div></div><div className="panel setting-block"><div className="setting-heading"><div><span className="eyebrow">تجربهٔ بازی</span><h2>صدا و حرکت</h2></div><Volume2 size={20}/></div><ToggleRow label="صدای بازی" detail="افکت‌ها و موسیقی کوتاه" checked/><ToggleRow label="لرزش روی موبایل" detail="برای نوبت و اعلان مهم" checked/><ToggleRow label="کاهش حرکت" detail="پویانمایی‌های غیرضروری" /></div><div className="panel setting-block"><div className="setting-heading"><div><span className="eyebrow">حریم خصوصی</span><h2>فضای اجتماعی</h2></div><ShieldCheck size={20}/></div><ToggleRow label="نمایش وضعیت آنلاین" detail="فقط به دوستان" checked/><ToggleRow label="دریافت دعوت بازی" detail="از دوستان و گروه‌ها" checked/></div></section></div></section>
}

function ToggleRow({ label, detail, checked = false }: { label: string; detail: string; checked?: boolean }) { const [on, setOn] = useState(checked); return <button className="toggle-row" onClick={() => setOn(!on)}><div><strong>{label}</strong><span>{detail}</span></div><i className={`toggle ${on ? 'toggle-on' : ''}`}><b/></i></button> }

function RoomPage({ game, capacity, hasPassword, onBack, onStart, onInvite }: { game: Game; capacity: number; hasPassword: boolean; onBack: () => void; onStart: () => void; onInvite: () => void }) {
  const Icon = game.icon
  const occupied = [{ label: 'پ', tone: 'pink', name: 'پارسا', host: true }, { label: 'ر', tone: 'rose', name: 'رها' }, { label: 'م', tone: 'cyan', name: 'مانی' }].slice(0, capacity)
  const seats = Array.from({ length: capacity }, (_, index) => index)
  const emptySlots = Math.max(capacity - occupied.length, 0)
  return <section className="room-page"><button className="back-link" onClick={onBack}><ArrowRightIcon/>بازگشت به خانه</button><div className={`room-hero accent-${game.accent}`}><div className="room-game-symbol"><Icon size={29}/></div><div><span className="eyebrow">لابی خصوصی</span><h1>دورهمی امشب <span className="room-code">K8M4</span></h1><p>{game.title} · {capacity} نفر ظرفیت · {hasPassword ? 'رمزدار' : 'بدون رمز'}</p></div><div className="room-hero-actions"><button className="secondary-button" onClick={onInvite}><Copy size={17}/>کپی لینک</button><button className="icon-button soft-button"><MoreHorizontal size={19}/></button></div></div><div className="room-layout"><section className="panel lobby-panel"><div className="panel-heading"><div><span className="eyebrow">بازیکن‌ها</span><h2>منتظر جمع‌شدنیم</h2></div><span className="ready-counter"><span/> {occupied.length} از {capacity}</span></div><div className="seat-grid">{seats.slice(0, Math.min(seats.length, 10)).map((seat) => { const player = occupied[seat]; return <div className={`seat ${player ? 'seat-filled' : ''}`} key={seat}>{player ? <><div className="seat-avatar">{avatar(player.label, player.tone)}{player.host && <Crown size={14}/>}</div><strong>{player.name}</strong><small>{seat === 2 ? 'آماده' : player.host ? 'میزبان' : 'در لابی'}</small></> : <><span className="empty-seat"><UserPlus size={20}/></span><strong>جای خالی</strong><small>دعوت کن یا ربات بیار</small></>}</div>})}</div><div className="lobby-footer"><div><Bot size={18}/><span>{emptySlots ? `${emptySlots} جای خالی رو با ربات پر کن` : 'اتاق کامل شد؛ آمادهٔ شروعید'}</span></div>{emptySlots > 0 && <button className="text-button">افزودن ربات <ArrowLeft size={16}/></button>}</div></section><aside className="room-side"><section className="panel game-rules"><div className="panel-heading"><div><span className="eyebrow">قوانین این دور</span><h2>{game.title}</h2></div><CircleHelp size={19}/></div><ul><li><Users size={16}/>{game.players}</li><li><Clock3 size={16}/>{game.duration}</li><li><Zap size={16}>{}</Zap>گردانندهٔ خودکار</li></ul><div className="start-note"><Sparkles size={17}/><span>همه آماده‌ان؛ می‌تونی بازی رو شروع کنی.</span></div><button className="primary-button full-button large-button" onClick={onStart}><Play size={18} fill="currentColor"/>شروع بازی</button></section><section className="panel lobby-chat"><div className="chat-heading"><strong>گفت‌وگوی لابی</strong><span><span/> فعال</span></div><div className="chat-line">{avatar('ر','rose')}<p><b>رها</b>من آماده‌ام!</p></div><div className="chat-line own"><p><b>تو</b>بریم شروع کنیم؟</p>{avatar('پ','pink')}</div><div className="chat-input"><input placeholder="یه پیام بنویس…"/><button><Send size={17}/></button></div></section></aside></div></section>
}

function GamePage({ game, board, message, winner, onMove, onRestart, onBack }: { game: Game; board: (null|'X'|'O')[]; message: string; winner: string | null; onMove: (index: number) => void; onRestart: () => void; onBack: () => void }) {
  const Icon = game.icon
  return <section className={`game-page accent-${game.accent}`}><div className="game-topline"><button className="back-link" onClick={onBack}><ArrowRightIcon/>لابی</button><div className="live-status"><span className="pulse-dot"/> اتصال پایدار</div><button className="exit-game"><X size={16}/>خروج از بازی</button></div><div className="game-header"><div className="game-header-title"><span className="game-icon"><Icon size={21}/></span><div><strong>{game.title}</strong><span>اتاق دورهمی امشب</span></div></div><div className="game-timer"><Clock3 size={18}/><b>۰۰:۱۸</b><span>زمان نوبت</span></div></div>{game.id === 'tic-tac-toe' ? <TicTacToe board={board} message={message} winner={winner} onMove={onMove} onRestart={onRestart}/> : <GamePreview game={game} onRestart={onRestart} />}</section>
}

function TicTacToe({ board, message, winner, onMove, onRestart }: { board: (null|'X'|'O')[]; message: string; winner: string | null; onMove: (index: number) => void; onRestart: () => void }) {
  return <div className="play-layout"><aside className="player-card current-player">{avatar('پ','pink','large-avatar')}<div><span>تو</span><strong>پارسا</strong><small><i/> نوبت {winner ? 'پایان' : 'تو'}</small></div><b className="player-mark">X</b></aside><main className="board-panel"><div className="turn-message"><span className="turn-badge">X</span><p>{message}</p></div><div className="tic-board" aria-label="صفحهٔ بازی دوز">{board.map((cell, index) => <button key={index} className={`tic-cell ${cell ? `mark-${cell}` : ''}`} onClick={() => onMove(index)} aria-label={`خانهٔ ${index + 1}`}>{cell}</button>)}</div>{winner && <button className="primary-button rematch-button" onClick={onRestart}><Zap size={17}/>یه دور دیگه</button>}<div className="board-meta"><span>بهترین از ۳</span><i/><span>دور ۱ از ۳</span></div></main><aside className="player-card rival-player">{avatar('م','cyan','large-avatar')}<div><span>حریف</span><strong>مانی</strong><small><i/> آنلاین</small></div><b className="player-mark">O</b></aside></div>
}

function GamePreview({ game, onRestart }: { game: Game; onRestart: () => void }) { const Icon = game.icon; return <div className="game-preview"><div className="preview-stage"><span className="preview-symbol"><Icon size={52}/></span><span className="preview-spark spark-a">✦</span><span className="preview-spark spark-b">✺</span><span className="preview-spark spark-c">✧</span><h2>{game.id === 'mafia' ? 'شب اول شروع شد' : game.id === 'truth-dare' ? 'گردونه آماده‌ست' : 'تاس رو بنداز'}</h2><p>{game.id === 'mafia' ? 'نقشت فقط برای خودت نمایش داده می‌شه.' : game.id === 'truth-dare' ? 'این دور نوبت رهاست؛ حقیقت یا جرئت؟' : 'نوبت توئه؛ یه تاس خوب بنداز!'}</p><button className="primary-button" onClick={onRestart}><Play size={17} fill="currentColor"/>ادامهٔ نمایشی</button></div><section className="preview-players"><span>{avatar('پ','pink')}پارسا</span><span>{avatar('ر','rose')}رها</span><span>{avatar('م','cyan')}مانی</span><span>{avatar('ن','violet')}نیلا</span></section></div> }

function PageTitle({ eyebrow, title, description, onBack }: { eyebrow: string; title: string; description: string; onBack: () => void }) { return <div className="page-title"><button className="back-link" onClick={onBack}><ArrowRightIcon/>خانه</button><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div> }
function ArrowRightIcon() { return <ChevronLeft size={17} className="back-arrow"/> }

export default App
