import { useState } from 'react'
import { AlertTriangle, Check, KeyRound, LoaderCircle, LogOut, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react'
import { useLanguage } from '../i18n'
import { useAccountSecurity } from '../hooks/useAccountSecurity'

type AccountSecurityProps = { notify: (message: string) => void }

const dateLabel = (value: string | null | undefined, language: 'fa' | 'en') => {
  if (!value) return '—'
  return new Intl.DateTimeFormat(language === 'fa' ? 'fa-IR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default function AccountSecurity({ notify }: AccountSecurityProps) {
  const { language } = useLanguage()
  const fa = language === 'fa'
  const account = useAccountSecurity()
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')

  const copy = fa ? {
    eyebrow: 'امنیت حساب', title: 'ورود و محافظت از حساب', description: 'رمز فقط در Supabase مدیریت می‌شود و هرگز در PartyPlay ذخیره یا نمایش داده نمی‌شود.',
    password: 'تنظیم یا تغییر رمز', passwordDescription: 'برای ورود بعدی با ایمیل و رمز، یک رمز تازه انتخاب کن.', newPassword: 'رمز تازه', confirmPassword: 'تکرار رمز', savePassword: 'ذخیرهٔ رمز',
    providers: 'روش‌های ورود', link: 'لینک ایمیلی', google: 'Google', googleReady: 'فعال', googleWaiting: 'نیازمند پیکربندی مدیر پروژه', signOut: 'خروج از این حساب',
    state: 'وضعیت حساب', active: 'فعال', restricted: 'محدود', suspended: 'تعلیق‌شده', pending: 'حذف در انتظار بازیابی', restrictionUntil: 'پایان محدودیت', purgeAfter: 'پاک‌سازی نهایی پس از', reason: 'دلیل ثبت‌شده',
    restore: 'بازیابی حساب', restoreDescription: 'درخواست حذف لغو می‌شود و حساب دوباره فعال خواهد شد.', deleteZone: 'منطقهٔ حساس', deleteTitle: 'حذف حساب PartyPlay', deleteDescription: 'با تأیید حذف، فوراً خارج می‌شوی. تا ۳۰ روز با ورود دوباره می‌توانی حساب را بازیابی کنی؛ بعد از آن داده‌ها پاک می‌شوند.', openDelete: 'شروع حذف حساب', deleteInstruction: 'برای تأیید، عبارت DELETE را دقیق وارد کن.', deleteNow: 'حذف و خروج از حساب', cancel: 'انصراف', saved: 'رمز ورود با موفقیت ذخیره شد.', restored: 'حساب دوباره فعال شد.', scheduled: 'حذف حساب برای ۳۰ روز دیگر ثبت شد؛ اکنون خارج می‌شوی.',
  } : {
    eyebrow: 'ACCOUNT SECURITY', title: 'Sign-in and account protection', description: 'Passwords are managed only by Supabase and are never stored or displayed by PartyPlay.',
    password: 'Set or change password', passwordDescription: 'Choose a password to use email-and-password sign-in next time.', newPassword: 'New password', confirmPassword: 'Confirm password', savePassword: 'Save password',
    providers: 'Sign-in methods', link: 'Email link', google: 'Google', googleReady: 'Enabled', googleWaiting: 'Project admin setup required', signOut: 'Sign out of this account',
    state: 'Account state', active: 'Active', restricted: 'Restricted', suspended: 'Suspended', pending: 'Deletion pending recovery', restrictionUntil: 'Restriction ends', purgeAfter: 'Final purge after', reason: 'Recorded reason',
    restore: 'Restore account', restoreDescription: 'This cancels the deletion request and makes the account active again.', deleteZone: 'DANGER ZONE', deleteTitle: 'Delete your PartyPlay account', deleteDescription: 'After confirmation you will be signed out immediately. You can recover by signing in within 30 days; after that, data is removed.', openDelete: 'Begin account deletion', deleteInstruction: 'To confirm, type DELETE exactly.', deleteNow: 'Delete and sign out', cancel: 'Cancel', saved: 'Your sign-in password was saved.', restored: 'Your account is active again.', scheduled: 'Your account is scheduled for deletion in 30 days; signing you out now.',
  }

  const state = account.state?.state || 'active'
  const stateLabel = state === 'restricted' ? copy.restricted : state === 'suspended' ? copy.suspended : state === 'pending_deletion' ? copy.pending : copy.active

  const savePassword = async () => {
    try {
      await account.setPassword(password, passwordConfirmation)
      setPassword('')
      setPasswordConfirmation('')
      notify(copy.saved)
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Password could not be saved.')
    }
  }

  const restore = async () => {
    try {
      await account.restore()
      notify(copy.restored)
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Account could not be restored.')
    }
  }

  const scheduleDeletion = async () => {
    try {
      await account.scheduleDeletion(deleteConfirmation)
      notify(copy.scheduled)
      await account.signOut()
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Account deletion could not be scheduled.')
    }
  }

  return <section className="panel setting-block-live account-security-card">
    <div className="section-panel-heading">
      <div><span className="eyebrow"><ShieldCheck size={15}/>{copy.eyebrow}</span><h2>{copy.title}</h2><p>{copy.description}</p></div>
      <span className={`account-state-chip state-${state}`}>{account.loading ? '…' : stateLabel}</span>
    </div>

    <div className="account-security-grid">
      <div className="account-security-subsection">
        <span className="field-label"><KeyRound size={15}/>{copy.password}</span>
        <p>{copy.passwordDescription}</p>
        <div className="account-password-fields">
          <input className="text-field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={copy.newPassword} autoComplete="new-password" dir="ltr" />
          <input className="text-field" type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void savePassword()} placeholder={copy.confirmPassword} autoComplete="new-password" dir="ltr" />
          <button className="primary-button" type="button" disabled={account.busy || !password || !passwordConfirmation} onClick={() => void savePassword()}>{account.busy ? <LoaderCircle className="spin" size={16}/> : <Check size={16}/>} {copy.savePassword}</button>
        </div>
      </div>

      <div className="account-security-subsection">
        <span className="field-label"><ShieldCheck size={15}/>{copy.providers}</span>
        <div className="signin-method-list"><span><b>{copy.link}</b><small>{fa ? 'همیشه فعال' : 'Always available'}</small></span><span><b>{copy.google}</b><small className={account.state?.google_configured ? 'provider-ready' : ''}>{account.state?.google_configured ? copy.googleReady : copy.googleWaiting}</small></span></div>
        <button className="secondary-button account-signout-button" type="button" disabled={account.busy} onClick={() => void account.signOut().catch((cause) => notify(cause instanceof Error ? cause.message : 'Sign-out could not be completed.'))}><LogOut size={16}/>{copy.signOut}</button>
      </div>
    </div>

    {(state === 'restricted' || state === 'suspended' || state === 'pending_deletion') && <div className={`account-state-detail state-${state}`}>
      <AlertTriangle size={18}/><div><strong>{stateLabel}</strong>{account.state?.reason && <p>{copy.reason}: {account.state.reason}</p>}{state === 'restricted' && <p>{copy.restrictionUntil}: {dateLabel(account.state?.restricted_until, language)}</p>}{state === 'pending_deletion' && <p>{copy.purgeAfter}: {dateLabel(account.state?.purge_after, language)}</p>}</div>
      {state === 'pending_deletion' && <button className="secondary-button" type="button" disabled={account.busy} onClick={() => void restore()}><RotateCcw size={16}/>{copy.restore}</button>}
    </div>}
    {state === 'pending_deletion' && <p className="account-recovery-copy">{copy.restoreDescription}</p>}

    <div className="account-danger-zone">
      <div><span className="eyebrow"><AlertTriangle size={15}/>{copy.deleteZone}</span><h3>{copy.deleteTitle}</h3><p>{copy.deleteDescription}</p></div>
      {!deleteOpen ? <button className="danger-button" type="button" onClick={() => setDeleteOpen(true)}><Trash2 size={16}/>{copy.openDelete}</button> : <div className="account-delete-confirmation"><label>{copy.deleteInstruction}<input className="text-field" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder="DELETE" dir="ltr" autoComplete="off" /></label><div><button className="danger-button" type="button" disabled={account.busy || deleteConfirmation !== 'DELETE'} onClick={() => void scheduleDeletion()}>{account.busy ? <LoaderCircle className="spin" size={16}/> : <Trash2 size={16}/>} {copy.deleteNow}</button><button className="secondary-button" type="button" disabled={account.busy} onClick={() => { setDeleteOpen(false); setDeleteConfirmation('') }}>{copy.cancel}</button></div></div>}
    </div>
    {account.error && <p className="form-error">{account.error}</p>}
  </section>
}
