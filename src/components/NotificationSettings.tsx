import { BellRing, Check, Gamepad2, LoaderCircle, MonitorSmartphone, ShieldCheck, Trophy, UserPlus, UsersRound } from 'lucide-react'
import type { NotificationCategory, NotificationPreferences } from '../lib/partyplay'

const items: Array<{ id: NotificationCategory; icon: typeof BellRing; fa: string; en: string; descriptionFa: string; descriptionEn: string }> = [
  { id: 'friend_request', icon: UserPlus, fa: 'درخواست دوستی', en: 'Friend requests', descriptionFa: 'وقتی کسی می‌خواهد به جمع تو اضافه شود.', descriptionEn: 'When someone wants to join your circle.' },
  { id: 'room_invite', icon: UsersRound, fa: 'دعوت اتاق', en: 'Room invites', descriptionFa: 'برای دعوت‌های مستقیم بازی.', descriptionEn: 'For direct game invitations.' },
  { id: 'game_started', icon: Gamepad2, fa: 'شروع بازی', en: 'Game starts', descriptionFa: 'وقتی اتاقی که در آن هستی آغاز می‌شود.', descriptionEn: 'When a room you joined starts.' },
  { id: 'your_turn', icon: BellRing, fa: 'نوبت تو', en: 'Your turn', descriptionFa: 'برای نوبت‌های حساس در بازی آنلاین.', descriptionEn: 'For time-sensitive online turns.' },
  { id: 'achievement', icon: Trophy, fa: 'دستاوردها', en: 'Achievements', descriptionFa: 'وقتی یک مدال یا دستاورد تازه می‌گیری.', descriptionEn: 'When you earn a new badge or achievement.' },
  { id: 'security', icon: ShieldCheck, fa: 'امنیت حساب', en: 'Account security', descriptionFa: 'رویدادهای مهم ورود و حفاظت حساب.', descriptionEn: 'Important account sign-in and security events.' },
]

const browserError = (code: string, fa: boolean) => {
  if (code.includes('BROWSER_NOT_SUPPORTED')) return fa ? 'این مرورگر از اعلان پوش پشتیبانی نمی‌کند.' : 'This browser does not support push notifications.'
  if (code.includes('WEB_PUSH_NOT_CONFIGURED')) return fa ? 'ارسال اعلان مرورگر هنوز توسط مدیر پروژه کامل نشده است.' : 'Browser push delivery is not configured by the project administrator yet.'
  if (code.includes('BROWSER_PERMISSION_DENIED')) return fa ? 'اجازهٔ اعلان در مرورگر داده نشد. از تنظیمات مرورگر می‌توانی آن را فعال کنی.' : 'Browser notification permission was not granted. You can enable it in browser settings.'
  return fa ? 'تنظیم اعلان مرورگر کامل نشد؛ دوباره تلاش کن.' : 'Browser notification setup did not complete. Please try again.'
}

export default function NotificationSettings({
  language,
  preferences,
  permission,
  subscribed,
  loading,
  isSupported,
  isConfigured,
  onEnable,
  onDisable,
  onCategory,
  notify,
}: {
  language: 'fa' | 'en'
  preferences: NotificationPreferences | null
  permission: NotificationPermission
  subscribed: boolean
  loading: boolean
  isSupported: boolean
  isConfigured: boolean
  onEnable: () => Promise<unknown>
  onDisable: () => Promise<unknown>
  onCategory: (category: NotificationCategory, enabled: boolean) => Promise<unknown>
  notify: (message: string) => void
}) {
  const fa = language === 'fa'
  const active = Boolean(preferences?.browserEnabled && subscribed && permission === 'granted')
  const handleToggle = async () => {
    try {
      if (active) await onDisable()
      else await onEnable()
      notify(active ? (fa ? 'اعلان مرورگر خاموش شد.' : 'Browser notifications are off.') : (fa ? 'اعلان مرورگر فعال شد.' : 'Browser notifications are on.'))
    } catch (cause) { notify(browserError(cause instanceof Error ? cause.message : '', fa)) }
  }

  return <section className="panel setting-block-live notification-settings">
    <div className="section-panel-heading"><div><span className="eyebrow"><BellRing size={15}/>{fa ? 'اعلان‌ها' : 'NOTIFICATIONS'}</span><h2>{fa ? 'خبرهای مهم را از دست نده' : 'Do not miss the important moments'}</h2><p>{fa ? 'اعلان داخلی همیشه در زنگ بالای برنامه دیده می‌شود. اعلان مرورگر فقط با اجازهٔ خودت فعال می‌شود.' : 'In-app alerts always appear under the top bell. Browser alerts are enabled only with your permission.'}</p></div></div>
    <div className={`browser-notification-card ${active ? 'notification-enabled' : ''}`}>
      <span className="browser-notification-icon"><MonitorSmartphone size={22}/></span>
      <div><strong>{fa ? 'اعلان مرورگر' : 'Browser notifications'}</strong><p>{active ? (fa ? 'برای رویدادهای انتخاب‌شده فعال است؛ حتی وقتی تب بسته باشد.' : 'Enabled for the selected events, even when the tab is closed.') : permission === 'denied' ? (fa ? 'اجازهٔ مرورگر بسته است.' : 'Browser permission is blocked.') : (fa ? 'برای دریافت رویدادهای مهم خارج از PartyPlay فعالش کن.' : 'Enable it to receive important updates outside PartyPlay.')}</p></div>
      <button type="button" className={active ? 'secondary-button' : 'primary-button'} disabled={loading || !isSupported || (!isConfigured && !active) || permission === 'denied'} onClick={() => void handleToggle()}>{loading ? <LoaderCircle className="spin" size={16}/> : active ? <Check size={16}/> : <BellRing size={16}/>}{active ? (fa ? 'خاموش‌کردن' : 'Turn off') : (fa ? 'فعال‌سازی' : 'Enable')}</button>
    </div>
    {!isSupported && <p className="notification-status-note">{fa ? 'این مرورگر از قابلیت اعلان پوش پشتیبانی نمی‌کند؛ اعلان داخلی همچنان فعال است.' : 'This browser does not support push notifications; in-app alerts remain available.'}</p>}
    {!isConfigured && isSupported && <p className="notification-status-note">{fa ? 'ارسال اعلان مرورگر در حال آماده‌سازی است. اعلان داخلی هم‌اکنون قابل استفاده است.' : 'Browser push delivery is being prepared. In-app alerts are available now.'}</p>}
    <div className="notification-category-list">{items.map(({ id, icon: Icon, fa: faLabel, en, descriptionFa, descriptionEn }) => {
      const enabled = preferences?.categories[id] ?? false
      return <button key={id} type="button" className={`notification-category ${enabled ? 'category-enabled' : ''}`} disabled={loading || !preferences} onClick={() => void onCategory(id, !enabled).catch((cause) => notify(browserError(cause instanceof Error ? cause.message : '', fa)))}><span className="notification-category-icon"><Icon size={17}/></span><span><b>{fa ? faLabel : en}</b><small>{fa ? descriptionFa : descriptionEn}</small></span><i aria-hidden="true"><b/></i></button>
    })}</div>
  </section>
}
