import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, LoaderCircle, Mail, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { useLanguage } from '../i18n'
import { requireProductAccess, restoreAccountAfterSignIn } from '../lib/partyplay'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type AuthStage = 'magic-link' | 'password' | 'sent'

type AuthGateProps = {
  theme: 'light' | 'dark'
  children: ReactNode
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const googleEnabled = import.meta.env.VITE_PARTYPLAY_GOOGLE_AUTH_ENABLED === 'true'

export default function AuthGate({ theme, children }: AuthGateProps) {
  const { language, t } = useLanguage()
  const [isReady, setIsReady] = useState(!isSupabaseConfigured)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [accessBlocked, setAccessBlocked] = useState('')
  const [stage, setStage] = useState<AuthStage>('magic-link')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const BackIcon = language === 'fa' ? ArrowRight : ArrowLeft
  const gamePreview = language === 'fa'
    ? ['مافیا', 'جاسوس', 'اونو', 'تخته‌نرد', 'منچ', 'رمز', 'دوز', 'حکم', 'فری‌سل']
    : ['Mafia', 'Spyfall', 'UNO', 'Backgammon', 'Ludo', 'Codenames', 'Tic-Tac-Toe', 'Hokm', 'FreeCell']

  const copy = language === 'fa' ? {
    methodChooser: 'روش ورود', magic: 'لینک ایمیلی', password: 'ورود با رمز', google: 'ادامه با Google',
    passwordHint: 'با ایمیل و رمزی که قبلاً در امنیت حساب تنظیم کرده‌ای وارد شو.', passwordLabel: 'رمز عبور', signIn: 'ورود',
    googleUnavailable: 'ورود با Google پس از فعال‌سازی ارائه‌دهنده در تنظیمات پروژه نمایش داده می‌شود.',
    blockedTitle: 'دسترسی این حساب محدود است', blockedDescription: 'وضعیت این حساب اجازهٔ استفاده از فضای بازی را نمی‌دهد. اگر فکر می‌کنی اشتباه شده، با مدیر PartyPlay در تماس باش.', signOut: 'خروج از حساب',
    invalidPassword: 'رمز عبور را وارد کن.', recoveryNotice: 'حساب در بازهٔ بازیابی فعال شد.',
  } : {
    methodChooser: 'Sign-in method', magic: 'Email link', password: 'Password', google: 'Continue with Google',
    passwordHint: 'Sign in with the email and password you previously set in Account Security.', passwordLabel: 'Password', signIn: 'Sign in',
    googleUnavailable: 'Google sign-in will appear after the provider is enabled for this project.',
    blockedTitle: 'This account has limited access', blockedDescription: 'This account cannot use the play space right now. Contact a PartyPlay administrator if you think this is a mistake.', signOut: 'Sign out',
    invalidPassword: 'Enter your password.', recoveryNotice: 'Your account was restored during the recovery window.',
  }

  const authErrorMessage = useCallback((message: string) => {
    const normalized = message.toLowerCase()
    if (normalized.includes('rate limit')) return t.auth.errors.rateLimit
    if (normalized.includes('invalid') || normalized.includes('token') || normalized.includes('password')) return t.auth.errors.invalidToken
    if (normalized.includes('email')) return t.auth.errors.email
    return t.auth.errors.unknown
  }, [t])

  const evaluateSession = useCallback(async (hasSession: boolean) => {
    if (!hasSession || !supabase) {
      setIsAuthenticated(false)
      setAccessBlocked('')
      setIsReady(true)
      return
    }
    setIsAuthenticated(true)
    try {
      const recovered = await restoreAccountAfterSignIn()
      if (recovered.state === 'active' && recovered.purge_after) setNotice(copy.recoveryNotice)
      await requireProductAccess()
      setAccessBlocked('')
    } catch (cause) {
      setAccessBlocked(cause instanceof Error ? cause.message : copy.blockedDescription)
    } finally {
      setIsReady(true)
    }
  }, [copy.blockedDescription, copy.recoveryNotice])

  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (active) void evaluateSession(Boolean(data.session))
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) void evaluateSession(Boolean(session))
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [evaluateSession])

  const requestCode = async () => {
    const normalizedEmail = email.trim().toLowerCase()
    if (!emailPattern.test(normalizedEmail)) {
      setError(t.auth.invalidEmail)
      return
    }
    if (!supabase) return
    if (displayName.trim()) localStorage.setItem('partyplay-display-name', displayName.trim())
    setBusy(true)
    setError('')
    setNotice('')
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: true,
        data: displayName.trim() ? { display_name: displayName.trim() } : undefined,
        emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    })
    setBusy(false)
    if (authError) {
      setError(authErrorMessage(authError.message))
      return
    }
    setEmail(normalizedEmail)
    setStage('sent')
    setNotice(t.auth.linkSent)
  }

  const signInWithPassword = async () => {
    const normalizedEmail = email.trim().toLowerCase()
    if (!emailPattern.test(normalizedEmail)) {
      setError(t.auth.invalidEmail)
      return
    }
    if (!password) {
      setError(copy.invalidPassword)
      return
    }
    if (!supabase) return
    setBusy(true)
    setError('')
    setNotice('')
    const { error: authError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
    setBusy(false)
    if (authError) setError(authErrorMessage(authError.message))
  }

  const signInWithGoogle = async () => {
    if (!supabase || !googleEnabled) return
    setBusy(true)
    setError('')
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${window.location.pathname}` },
    })
    setBusy(false)
    if (authError) setError(authErrorMessage(authError.message))
  }

  const signOut = async () => {
    if (!supabase) return
    setBusy(true)
    const { error: signOutError } = await supabase.auth.signOut()
    setBusy(false)
    if (signOutError) setError(authErrorMessage(signOutError.message))
  }

  if (!isSupabaseConfigured || (isAuthenticated && !accessBlocked)) return <>{children}</>

  return (
    <main className="app-shell auth-shell" data-theme={theme}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-brand">
          <span className="brand-mark"><span>◈</span><i /><i /><i /><i /></span>
          <span className="brand-text">{t.app.brand}</span>
        </div>

        {!isReady ? (
          <div className="auth-loading" role="status">
            <LoaderCircle size={26} />
            <p>{t.auth.checking}</p>
          </div>
        ) : accessBlocked ? (
          <div className="auth-form auth-blocked" role="alert">
            <span className="eyebrow"><ShieldCheck size={15} /> {copy.blockedTitle}</span>
            <h1 id="auth-title">{copy.blockedTitle}</h1>
            <p>{accessBlocked || copy.blockedDescription}</p>
            <button className="secondary-button auth-submit" type="button" onClick={() => void signOut()} disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={18} /> : <ArrowLeft size={18} />}{copy.signOut}
            </button>
          </div>
        ) : (
          <>
            <span className="eyebrow"><ShieldCheck size={15} /> {t.auth.securePasswordless}</span>
            <h1 id="auth-title">{t.auth.title}</h1>
            <p className="auth-lead">{t.auth.description}</p>
            <div className="auth-game-preview" aria-label={t.auth.games}><span>{t.auth.games}</span><div>{gamePreview.map((game) => <b key={game}>{game}</b>)}</div></div>

            <div className="auth-methods" aria-label={copy.methodChooser}>
              <button className={stage === 'magic-link' || stage === 'sent' ? 'auth-method-active' : ''} type="button" onClick={() => { setStage('magic-link'); setError(''); setNotice('') }}><Mail size={16}/>{copy.magic}</button>
              <button className={stage === 'password' ? 'auth-method-active' : ''} type="button" onClick={() => { setStage('password'); setError(''); setNotice('') }}><KeyRound size={16}/>{copy.password}</button>
            </div>

            {stage === 'magic-link' ? (
              <div className="auth-form">
                <label htmlFor="auth-name">{t.auth.displayName} <small>{t.auth.optional}</small></label>
                <input id="auth-name" className="text-field" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={t.auth.displayNamePlaceholder} maxLength={40} autoComplete="name" />
                <label htmlFor="auth-email">{t.auth.email}</label>
                <div className="auth-input-wrap"><Mail size={18} /><input id="auth-email" className="text-field" value={email} onChange={(event) => setEmail(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void requestCode() }} placeholder="you@example.com" type="email" inputMode="email" dir="ltr" autoComplete="email" /></div>
                <button className="primary-button auth-submit" type="button" onClick={() => void requestCode()} disabled={busy}>{busy ? <LoaderCircle className="spin" size={18} /> : <Mail size={18} />}{t.auth.sendLink}</button>
              </div>
            ) : stage === 'password' ? (
              <div className="auth-form">
                <p className="auth-method-hint">{copy.passwordHint}</p>
                <label htmlFor="auth-password-email">{t.auth.email}</label>
                <div className="auth-input-wrap"><Mail size={18} /><input id="auth-password-email" className="text-field" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" inputMode="email" dir="ltr" autoComplete="email" /></div>
                <label htmlFor="auth-password">{copy.passwordLabel}</label>
                <div className="auth-input-wrap"><KeyRound size={18} /><input id="auth-password" className="text-field" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void signInWithPassword() }} type="password" dir="ltr" autoComplete="current-password" /></div>
                <button className="primary-button auth-submit" type="button" onClick={() => void signInWithPassword()} disabled={busy}>{busy ? <LoaderCircle className="spin" size={18} /> : <KeyRound size={18} />}{copy.signIn}</button>
              </div>
            ) : (
              <div className="auth-form">
                <button className="auth-back" type="button" onClick={() => { setStage('magic-link'); setError(''); setNotice('') }}><BackIcon size={16} /> {t.auth.changeEmail}</button>
                <p className="auth-email">{t.auth.linkSentTo} <b dir="ltr">{email}</b>.</p>
                <div className="auth-link-hint"><CheckCircle2 size={22} /><div><strong>{t.auth.openEmail}</strong><span>{t.auth.openEmailDescription}</span></div></div>
                <button className="auth-resend" type="button" onClick={() => void requestCode()} disabled={busy}><RefreshCw size={15} /> {t.auth.resend}</button>
              </div>
            )}

            {googleEnabled ? <button className="auth-google-button" type="button" onClick={() => void signInWithGoogle()} disabled={busy}><span>G</span>{copy.google}</button> : <p className="auth-provider-note">{copy.googleUnavailable}</p>}
            {notice && <p className="auth-notice"><CheckCircle2 size={17} />{notice}</p>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <p className="auth-footnote"><Sparkles size={14} /> {t.auth.footnote}</p>
          </>
        )}
      </section>
    </main>
  )
}
