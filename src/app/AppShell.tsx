import { type ReactNode, useState } from 'react'
import { BellRing, Gamepad2, Globe2, Home, Menu, Moon, Settings2, Sun, Users } from 'lucide-react'
import { useLanguage } from '../i18n'
import { PlayerAvatar } from '../components/SocialIdentity'
import AuthGate from '../components/AuthGate'

export type ShellDestination = 'home' | 'games' | 'friends' | 'groups' | 'profile' | 'activity'

type AppShellProps = {
  activePage: string
  pageTitle: string
  theme: 'light' | 'dark'
  playerName: string
  playerAvatarSeed: string
  playerPresence?: 'online' | 'away' | 'busy' | 'offline'
  onThemeToggle: () => void
  onNavigate: (destination: ShellDestination) => void
  activityUnread?: number
  children: ReactNode
  overlay?: ReactNode
}

export default function AppShell({
  activePage,
  pageTitle,
  theme,
  playerName,
  playerAvatarSeed,
  playerPresence,
  onThemeToggle,
  onNavigate,
  activityUnread = 0,
  children,
  overlay,
}: AppShellProps) {
  const { language, setPreference, t } = useLanguage()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navItems: Array<{ id: ShellDestination; label: string; icon: typeof Home }> = [
    { id: 'home', label: t.app.home, icon: Home },
    { id: 'games', label: t.app.games, icon: Gamepad2 },
    { id: 'friends', label: t.app.friends, icon: Users },
    { id: 'groups', label: t.app.groups, icon: Users },
  ]

  const navigate = (destination: ShellDestination) => {
    onNavigate(destination)
    setMobileMenuOpen(false)
  }

  return (
    <AuthGate theme={theme}>
      <div className="app-shell" data-theme={theme}>
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`} aria-label={t.app.navCaption}>
          <button className="brand" onClick={() => navigate('home')} aria-label={t.app.home}>
            <span className="brand-mark"><span>◈</span><i /><i /><i /><i /></span>
            <span className="brand-text">{t.app.brand}</span>
          </button>
          <div className="nav-section">
            <p className="nav-caption">{t.app.navCaption}</p>
            {navItems.map(({ id, label, icon: Icon }) => (
              <button key={id} className={`nav-item ${activePage === id ? 'nav-active' : ''}`} onClick={() => navigate(id)}>
                <Icon size={20} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="sidebar-spacer" />
          <button className={`nav-item profile-nav ${activePage === 'profile' ? 'nav-active' : ''}`} onClick={() => navigate('profile')}>
            <PlayerAvatar seed={playerAvatarSeed} label={playerName} size="sm" status={playerPresence} />
            <span>{playerName}</span>
            <Settings2 size={18} />
          </button>
        </aside>
        <main className="main-content">
          <header className="topbar">
            <button className="mobile-menu-button icon-button" onClick={() => setMobileMenuOpen((open) => !open)} aria-label={t.app.menu}>
              <Menu size={22} />
            </button>
            <div className="breadcrumb"><span>{t.app.brand}</span><strong>{pageTitle}</strong></div>
            <div className="top-actions">
              <button className="language-toggle icon-button" onClick={() => setPreference(language === 'fa' ? 'en' : 'fa')} aria-label={t.app.language} title={t.app.language}>
                <Globe2 size={18} /><span>{language === 'fa' ? 'FA' : 'EN'}</span>
              </button>
              <button className={`activity-toggle icon-button ${activityUnread ? 'has-unread' : ''}`} onClick={() => navigate('activity')} aria-label="مرکز فعالیت" title="مرکز فعالیت"><BellRing size={18}/>{activityUnread > 0 && <i>{activityUnread > 9 ? '9+' : activityUnread}</i>}</button>
              <button className="theme-toggle icon-button" onClick={onThemeToggle} aria-label={t.app.theme} title={t.app.theme}>
                {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
              </button>
              <button className="top-avatar" onClick={() => navigate('profile')} aria-label={t.app.profile}>
                <PlayerAvatar seed={playerAvatarSeed} label={playerName} size="sm" status={playerPresence} />
              </button>
            </div>
          </header>
          <div className="page-container">{children}</div>
        </main>
        {overlay}
      </div>
    </AuthGate>
  )
}
