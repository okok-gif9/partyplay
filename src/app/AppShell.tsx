import { type ReactNode, useState } from 'react'
import { Gamepad2, Globe2, Home, Menu, Moon, Settings2, ShieldCheck, Sun, UserRound, Users, UsersRound } from 'lucide-react'
import { useLanguage } from '../i18n'
import type { PartyPlayActivity, PremiumRingColor } from '../lib/partyplay'
import { PlayerAvatar } from '../components/SocialIdentity'
import AuthGate from '../components/AuthGate'
import NotificationCenter from '../components/NotificationCenter'

export type ShellDestination = 'home' | 'games' | 'friends' | 'groups' | 'profile' | 'activity' | 'admin'

type AppShellProps = {
  activePage: string
  pageTitle: string
  theme: 'light' | 'dark'
  playerName: string
  playerAvatarSeed: string
  playerAvatarAssetPath?: string | null
  playerPresence?: 'online' | 'away' | 'busy' | 'offline'
  playerPremiumRingEnabled?: boolean
  playerPremiumRingColor?: PremiumRingColor
  isAdmin?: boolean
  onThemeToggle: () => void
  onNavigate: (destination: ShellDestination) => void
  activityUnread?: number
  activityItems?: PartyPlayActivity[]
  onMarkAllActivityRead?: () => void
  children: ReactNode
  overlay?: ReactNode
}

export default function AppShell({
  activePage,
  pageTitle,
  theme,
  playerName,
  playerAvatarSeed,
  playerAvatarAssetPath,
  playerPresence,
  playerPremiumRingEnabled = false,
  playerPremiumRingColor = 'violet',
  isAdmin = false,
  onThemeToggle,
  onNavigate,
  activityUnread = 0,
  activityItems = [],
  onMarkAllActivityRead = () => undefined,
  children,
  overlay,
}: AppShellProps) {
  const { language, setPreference, t } = useLanguage()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const navItems: Array<{ id: ShellDestination; label: string; icon: typeof Home }> = [
    { id: 'home', label: t.app.home, icon: Home },
    { id: 'games', label: t.app.games, icon: Gamepad2 },
    { id: 'friends', label: t.app.friends, icon: Users },
    { id: 'groups', label: t.app.groups, icon: UsersRound },
  ]
  const mobileItems: Array<{ id: ShellDestination; label: string; icon: typeof Home }> = [...navItems, { id: 'profile', label: t.app.profile, icon: UserRound }, ...(isAdmin ? [{ id: 'admin' as const, label: language === 'fa' ? 'مدیریت' : 'Admin', icon: ShieldCheck }] : [])]

  const navigate = (destination: ShellDestination) => {
    onNavigate(destination)
    setMobileMenuOpen(false)
    setNotificationsOpen(false)
  }

  return (
    <AuthGate theme={theme}>
      <div className="app-shell" data-theme={theme}>
        <div className="ambient ambient-one" /><div className="ambient ambient-two" />
        <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`} aria-label={t.app.navCaption}>
          <button className="brand" onClick={() => navigate('home')} aria-label={t.app.home}><span className="brand-mark"><span>◈</span><i /><i /><i /><i /></span><span className="brand-text">{t.app.brand}</span></button>
          <div className="nav-section"><p className="nav-caption">{t.app.navCaption}</p>{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${activePage === id ? 'nav-active' : ''}`} onClick={() => navigate(id)}><Icon size={20}/><span>{label}</span></button>)}</div>
          <div className="sidebar-spacer" />
          {isAdmin && <div className="nav-section admin-nav-section"><p className="nav-caption">{language === 'fa' ? 'مدیریت پلتفرم' : 'PLATFORM'}</p><button className={`nav-item admin-command-link ${activePage === 'admin' ? 'nav-active' : ''}`} onClick={() => navigate('admin')}><ShieldCheck size={20}/><span>{language === 'fa' ? 'مرکز فرمان' : 'Command Center'}</span></button></div>}
          <button className={`nav-item profile-nav ${activePage === 'profile' ? 'nav-active' : ''}`} onClick={() => navigate('profile')}><PlayerAvatar seed={playerAvatarSeed} assetPath={playerAvatarAssetPath} label={playerName} size="sm" status={playerPresence} premiumRingEnabled={playerPremiumRingEnabled} premiumRingColor={playerPremiumRingColor}/><span>{playerName}</span><Settings2 size={18}/></button>
        </aside>
        <main className="main-content">
          <header className="topbar">
            <button className="mobile-menu-button icon-button" onClick={() => setMobileMenuOpen((open) => !open)} aria-label={t.app.menu}><Menu size={22}/></button>
            <div className="breadcrumb"><span>{t.app.brand}</span><strong>{pageTitle}</strong></div>
            <div className="top-actions">
              <button className="language-toggle icon-button" onClick={() => setPreference(language === 'fa' ? 'en' : 'fa')} aria-label={t.app.language} title={t.app.language}><Globe2 size={18}/><span>{language === 'fa' ? 'FA' : 'EN'}</span></button>
              <NotificationCenter open={notificationsOpen} onToggle={() => setNotificationsOpen((value) => !value)} items={activityItems} unreadCount={activityUnread} onOpenActivity={() => navigate('activity')} onMarkAllRead={onMarkAllActivityRead}/>
              <button className="theme-toggle icon-button" onClick={onThemeToggle} aria-label={t.app.theme} title={t.app.theme}>{theme === 'dark' ? <Sun size={19}/> : <Moon size={19}/>}</button>
              <button className="top-avatar" onClick={() => navigate('profile')} aria-label={t.app.profile}><PlayerAvatar seed={playerAvatarSeed} assetPath={playerAvatarAssetPath} label={playerName} size="sm" status={playerPresence} premiumRingEnabled={playerPremiumRingEnabled} premiumRingColor={playerPremiumRingColor}/></button>
            </div>
          </header>
          <div className="page-container">{children}</div>
        </main>
        <nav className="mobile-bottom-nav" aria-label={t.app.navCaption}>{mobileItems.map(({ id, label, icon: Icon }) => <button key={id} className={activePage === id ? 'mobile-nav-active' : ''} onClick={() => navigate(id)}><Icon size={19}/><span>{label}</span></button>)}</nav>
        {overlay}
      </div>
    </AuthGate>
  )
}
