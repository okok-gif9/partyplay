import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, AtSign, CheckCircle2, Copy, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, Mail, RefreshCw, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import { useLanguage } from '../i18n'
import { requireProductAccess, restoreAccountAfterSignIn } from '../lib/partyplay'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type AuthStage = 'sign-in' | 'sign-up' | 'magic-link' | 'sent' | 'reset' | 'recovery'
type SentPurpose = 'signup' | 'magic-link' | 'reset'

type AuthGateProps = {
  theme: 'light' | 'dark'
  children: ReactNode
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const usernamePattern = /^[a-z0-9_]{3,24}$/
const googleEnabled = import.meta.env.VITE_PARTYPLAY_GOOGLE_AUTH_ENABLED === 'true'

const createSecurePassword = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*_-'
  const random = new Uint32Array(16)
  crypto.getRandomValues(random)
  return Array.from(random, (value) => alphabet[value % alphabet.length]).join('')
}

export default function AuthGate({ theme, children }: AuthGateProps) {
  const { language, t } = useLanguage()
  const fa = language === 'fa'
  const [isReady, setIsReady] = useState(!isSupabaseConfigured)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [accessBlocked, setAccessBlocked] = useState('')
  const [stage, setStage] = useState<AuthStage>('sign-in')
  const [sentPurpose, setSentPurpose] = useState<SentPurpose>('signup')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const BackIcon = fa ? ArrowRight : ArrowLeft
  const gamePreview = fa
    ? ['مافیا', 'جاسوس', 'اونو', 'تخته‌نرد', 'منچ', 'رمز', 'دوز', 'حکم', 'فری‌سل']
    : ['Mafia', 'Spyfall', 'UNO', 'Backgammon', 'Ludo', 'Codenames', 'Tic-Tac-Toe', 'Hokm', 'FreeCell']

  const copy = useMemo(() => fa ? {
    signIn: 'ورود', signUp: 'ساخت حساب', email: 'ایمیل', password: 'رمز عبور', confirmPassword: 'تکرار رمز', name: 'نام', username: 'آیدی',
    nameHint: 'دوستانت این نام را در بازی می‌بینند.', usernameHint: '۳ تا ۲۴ نویسه: حروف انگلیسی، عدد و _',
    loginLead: 'با ایمیل و رمز وارد فضای بازی خودت شو.', signupLead: 'حساب خودت را بساز و دوستانت را به بازی دعوت کن.',
    loginButton: 'ورود به PartyPlay', signupButton: 'ساخت حساب و ارسال تأیید', forgot: 'رمزت را فراموش کرده‌ای؟', useMagic: 'ورود با لینک ایمیلی',
    magicLead: 'یک لینک ورود امن به ایمیلت می‌فرستیم.', sendMagic: 'ارسال لینک ورود', backToLogin: 'بازگشت به ورود',
    generatePassword: 'ساخت رمز امن', copyPassword: 'کپی رمز', copied: 'رمز آماده کپی شد.',
    emailSentTitle: 'ایمیل را بررسی کن', emailSentSignup: 'برای فعال‌سازی حساب، پیوند تأیید را به ایمیلت فرستادیم.', emailSentMagic: 'پیوند امن ورود را به ایمیلت فرستادیم.', emailSentReset: 'پیوند ساخت رمز تازه را به ایمیلت فرستادیم.',
    resend: 'ارسال دوباره', changeEmail: 'تغییر ایمیل', openEmail: 'صندوق ایمیل را باز کن', openEmailDescription: 'اگر ایمیل را نمی‌بینی، پوشهٔ spam را هم بررسی کن.',
    resetLead: 'ایمیلت را وارد کن تا پیوند ساخت رمز تازه را بفرستیم.', resetButton: 'ارسال پیوند بازیابی', recoveryLead: 'برای این حساب یک رمز تازه بساز.', recoveryButton: 'ذخیرهٔ رمز تازه', recoveryDone: 'رمز تازه ذخیره شد؛ اکنون وارد حساب شده‌ای.',
    google: 'ادامه با Google', googleUnavailable: 'ورود Google پس از فعال‌سازی ارائه‌دهنده توسط مدیر پروژه نمایش داده می‌شود.',
    blockedTitle: 'دسترسی این حساب محدود است', blockedDescription: 'وضعیت این حساب اجازهٔ استفاده از فضای بازی را نمی‌دهد. اگر فکر می‌کنی اشتباه شده، با مدیر PartyPlay در تماس باش.', signOut: 'خروج از این حساب',
    invalidPassword: 'رمز عبور را وارد کن.', passwordMismatch: 'دو رمز یکسان نیستند.', passwordShort: 'رمز باید دست‌کم ۸ نویسه باشد.', invalidUsername: 'آیدی باید ۳ تا ۲۴ نویسه و فقط شامل حروف انگلیسی، عدد یا _ باشد.', invalidName: 'نام را وارد کن.', duplicateUsername: 'این آیدی قبلاً گرفته شده است. یک آیدی دیگر انتخاب کن.', recoveryNotice: 'حساب در بازهٔ بازیابی دوباره فعال شد.', secureAccount: 'حساب امن PartyPlay',
  } : {
    signIn: 'Sign in', signUp: 'Create account', email: 'Email', password: 'Password', confirmPassword: 'Confirm password', name: 'Name', username: 'ID',
    nameHint: 'Friends see this name in games.', usernameHint: '3–24 characters: letters, numbers, and _.',
    loginLead: 'Sign in with your email and password.', signupLead: 'Create your account and invite friends to play.',
    loginButton: 'Sign in to PartyPlay', signupButton: 'Create account and send verification', forgot: 'Forgot your password?', useMagic: 'Use an email link instead',
    magicLead: 'We will send a secure sign-in link to your email.', sendMagic: 'Send sign-in link', backToLogin: 'Back to sign in',
    generatePassword: 'Generate secure password', copyPassword: 'Copy password', copied: 'Your generated password is ready to paste.',
    emailSentTitle: 'Check your email', emailSentSignup: 'We sent an activation link to your email.', emailSentMagic: 'We sent a secure sign-in link to your email.', emailSentReset: 'We sent a link to set a new password.',
    resend: 'Resend', changeEmail: 'Change email', openEmail: 'Open your inbox', openEmailDescription: 'If it is not there, check your spam folder too.',
    resetLead: 'Enter your email and we will send a password-reset link.', resetButton: 'Send reset link', recoveryLead: 'Choose a new password for this account.', recoveryButton: 'Save new password', recoveryDone: 'Your new password is saved and you are signed in.',
    google: 'Continue with Google', googleUnavailable: 'Google sign-in will appear after the provider is enabled by a project administrator.',
    blockedTitle: 'This account has limited access', blockedDescription: 'This account cannot use the play space right now. Contact a PartyPlay administrator if you think this is a mistake.', signOut: 'Sign out',
    invalidPassword: 'Enter your password.', passwordMismatch: 'The two passwords do not match.', passwordShort: 'Password must be at least 8 characters.', invalidUsername: 'ID must be 3–24 characters using letters, numbers, or _.', invalidName: 'Enter your name.', duplicateUsername: 'This ID is already taken. Choose another one.', recoveryNotice: 'Your account was restored during the recovery window.', secureAccount: 'Secure PartyPlay account',
  }, [fa])

  const clearFeedback = () => { setError(''); setNotice('') }
  const resetForms = () => { setPassword(''); setPasswordConfirmation(''); setShowPassword(false); clearFeedback() }
  const setAuthStage = (next: AuthStage) => { setStage(next); resetForms() }

  const authErrorMessage = useCallback((message: string) => {
    const normalized = message.toLowerCase()
    if (normalized.includes('rate limit')) return t.auth.errors.rateLimit
    if (normalized.includes('username') || normalized.includes('unique') || normalized.includes('duplicate')) return copy.duplicateUsername
    if (normalized.includes('invalid') || normalized.includes('token') || normalized.includes('password')) return t.auth.errors.invalidToken
    if (normalized.includes('email')) return t.auth.errors.email
    return t.auth.errors.unknown
  }, [copy.duplicateUsername, t])

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
    void supabase.auth.getSession().then(({ data }) => { if (active) void evaluateSession(Boolean(data.session)) })
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setStage('recovery')
      if (active) void evaluateSession(Boolean(session))
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [evaluateSession])

  const validateEmail = () => {
    const normalizedEmail = email.trim().toLowerCase()
    if (!emailPattern.test(normalizedEmail)) { setError(t.auth.invalidEmail); return null }
    return normalizedEmail
  }

  const requestMagicLink = async () => {
    const normalizedEmail = validateEmail()
    if (!normalizedEmail || !supabase) return
    setBusy(true); clearFeedback()
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}${window.location.pathname}` },
    })
    setBusy(false)
    if (authError) { setError(authErrorMessage(authError.message)); return }
    setEmail(normalizedEmail); setSentPurpose('magic-link'); setStage('sent')
  }

  const signInWithPassword = async () => {
    const normalizedEmail = validateEmail()
    if (!normalizedEmail) return
    if (!password) { setError(copy.invalidPassword); return }
    if (!supabase) return
    setBusy(true); clearFeedback()
    const { error: authError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
    setBusy(false)
    if (authError) setError(authErrorMessage(authError.message))
  }

  const signUp = async () => {
    const normalizedEmail = validateEmail()
    const normalizedUsername = username.trim().toLowerCase()
    const normalizedName = displayName.trim()
    if (!normalizedEmail) return
    if (!normalizedName) { setError(copy.invalidName); return }
    if (!usernamePattern.test(normalizedUsername)) { setError(copy.invalidUsername); return }
    if (password.length < 8) { setError(copy.passwordShort); return }
    if (password !== passwordConfirmation) { setError(copy.passwordMismatch); return }
    if (!supabase) return
    setBusy(true); clearFeedback()
    const { error: authError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { display_name: normalizedName, username: normalizedUsername },
        emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    })
    setBusy(false)
    if (authError) { setError(authErrorMessage(authError.message)); return }
    localStorage.setItem('partyplay-display-name', normalizedName)
    setEmail(normalizedEmail); setSentPurpose('signup'); setStage('sent'); setPassword(''); setPasswordConfirmation('')
  }

  const resendSignUpVerification = async () => {
    const normalizedEmail = validateEmail()
    if (!normalizedEmail || !supabase) return
    setBusy(true); clearFeedback()
    const { error: authError } = await supabase.auth.resend({ type: 'signup', email: normalizedEmail, options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` } })
    setBusy(false)
    if (authError) { setError(authErrorMessage(authError.message)); return }
    setNotice(fa ? 'ایمیل فعال‌سازی دوباره ارسال شد.' : 'The activation email was sent again.')
  }

  const requestPasswordReset = async () => {
    const normalizedEmail = validateEmail()
    if (!normalizedEmail || !supabase) return
    setBusy(true); clearFeedback()
    const { error: authError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo: `${window.location.origin}${window.location.pathname}` })
    setBusy(false)
    if (authError) { setError(authErrorMessage(authError.message)); return }
    setEmail(normalizedEmail); setSentPurpose('reset'); setStage('sent')
  }

  const saveRecoveredPassword = async () => {
    if (password.length < 8) { setError(copy.passwordShort); return }
    if (password !== passwordConfirmation) { setError(copy.passwordMismatch); return }
    if (!supabase) return
    setBusy(true); clearFeedback()
    const { error: authError } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (authError) { setError(authErrorMessage(authError.message)); return }
    setPassword(''); setPasswordConfirmation(''); setStage('sign-in'); setNotice(copy.recoveryDone)
  }

  const signInWithGoogle = async () => {
    if (!supabase || !googleEnabled) return
    setBusy(true); clearFeedback()
    const { error: authError } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}${window.location.pathname}` } })
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

  const generatePassword = () => {
    const next = createSecurePassword()
    setPassword(next); setPasswordConfirmation(next); setShowPassword(true); setNotice(copy.copied); setError('')
  }

  const copyPassword = async () => {
    if (!password) { generatePassword(); return }
    try { await navigator.clipboard.writeText(password); setNotice(copy.copied); setError('') } catch { setError(fa ? 'کپی رمز در این مرورگر ممکن نشد.' : 'Password copy is not available in this browser.') }
  }

  const passwordFields = (mode: 'sign-in' | 'sign-up' | 'recovery') => <>
    <label htmlFor={`auth-password-${mode}`}>{copy.password}</label>
    <div className="auth-input-wrap auth-password-wrap"><KeyRound size={18}/><input id={`auth-password-${mode}`} className="text-field" value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} dir="ltr" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} /><button type="button" className="auth-inline-action" aria-label={showPassword ? (fa ? 'پنهان‌کردن رمز' : 'Hide password') : (fa ? 'نمایش رمز' : 'Show password')} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div>
    {mode !== 'sign-in' && <><label htmlFor={`auth-password-confirm-${mode}`}>{copy.confirmPassword}</label><div className="auth-input-wrap"><LockKeyhole size={18}/><input id={`auth-password-confirm-${mode}`} className="text-field" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') mode === 'recovery' ? void saveRecoveredPassword() : void signUp() }} type={showPassword ? 'text' : 'password'} dir="ltr" autoComplete="new-password" /></div></>}
  </>

  if (!isSupabaseConfigured || (isAuthenticated && !accessBlocked && stage !== 'recovery')) return <>{children}</>

  const sentMessage = sentPurpose === 'signup' ? copy.emailSentSignup : sentPurpose === 'reset' ? copy.emailSentReset : copy.emailSentMagic

  return (
    <main className="app-shell auth-shell" data-theme={theme}>
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <section className="auth-panel auth-panel-pro" aria-labelledby="auth-title">
        <div className="auth-brand"><span className="brand-mark"><span>◈</span><i /><i /><i /><i /></span><span className="brand-text">{t.app.brand}</span></div>
        {!isReady ? <div className="auth-loading" role="status"><LoaderCircle size={26}/><p>{t.auth.checking}</p></div>
          : accessBlocked ? <div className="auth-form auth-blocked" role="alert"><span className="eyebrow"><ShieldCheck size={15}/>{copy.blockedTitle}</span><h1 id="auth-title">{copy.blockedTitle}</h1><p>{accessBlocked || copy.blockedDescription}</p><button className="secondary-button auth-submit" type="button" onClick={() => void signOut()} disabled={busy}>{busy ? <LoaderCircle className="spin" size={18}/> : <ArrowLeft size={18}/>}{copy.signOut}</button></div>
            : <>
              <span className="eyebrow"><ShieldCheck size={15}/>{copy.secureAccount}</span>
              <h1 id="auth-title">{stage === 'sign-up' ? copy.signUp : stage === 'reset' ? copy.resetButton : stage === 'recovery' ? copy.recoveryButton : stage === 'sent' ? copy.emailSentTitle : copy.signIn}</h1>
              <p className="auth-lead">{stage === 'sign-up' ? copy.signupLead : stage === 'magic-link' ? copy.magicLead : stage === 'reset' ? copy.resetLead : stage === 'recovery' ? copy.recoveryLead : stage === 'sent' ? sentMessage : copy.loginLead}</p>
              {(stage === 'sign-in' || stage === 'sign-up') && <div className="auth-game-preview" aria-label={t.auth.games}><span>{t.auth.games}</span><div>{gamePreview.map((game) => <b key={game}>{game}</b>)}</div></div>}
              {(stage === 'sign-in' || stage === 'sign-up') && <div className="auth-methods auth-account-tabs" aria-label={fa ? 'حساب PartyPlay' : 'PartyPlay account'}><button className={stage === 'sign-in' ? 'auth-method-active' : ''} type="button" onClick={() => setAuthStage('sign-in')}><KeyRound size={16}/>{copy.signIn}</button><button className={stage === 'sign-up' ? 'auth-method-active' : ''} type="button" onClick={() => setAuthStage('sign-up')}><UserRound size={16}/>{copy.signUp}</button></div>}
              {stage === 'sign-in' && <div className="auth-form"><label htmlFor="auth-login-email">{copy.email}</label><div className="auth-input-wrap"><Mail size={18}/><input id="auth-login-email" className="text-field" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" inputMode="email" dir="ltr" autoComplete="email" /></div>{passwordFields('sign-in')}<button className="primary-button auth-submit" type="button" onClick={() => void signInWithPassword()} disabled={busy}>{busy ? <LoaderCircle className="spin" size={18}/> : <KeyRound size={18}/>}{copy.loginButton}</button><div className="auth-inline-links"><button type="button" onClick={() => setAuthStage('reset')}>{copy.forgot}</button><button type="button" onClick={() => setAuthStage('magic-link')}>{copy.useMagic}</button></div></div>}
              {stage === 'sign-up' && <div className="auth-form auth-signup-form"><label htmlFor="auth-name">{copy.name}</label><div className="auth-input-wrap"><UserRound size={18}/><input id="auth-name" className="text-field" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={fa ? 'مثلاً کیان' : 'e.g. Kian'} maxLength={40} autoComplete="name" /></div><small className="auth-field-hint">{copy.nameHint}</small><label htmlFor="auth-username">{copy.username}</label><div className="auth-input-wrap"><AtSign size={18}/><input id="auth-username" className="text-field" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="party_player" maxLength={24} dir="ltr" autoComplete="username" /></div><small className="auth-field-hint">{copy.usernameHint}</small><label htmlFor="auth-signup-email">{copy.email}</label><div className="auth-input-wrap"><Mail size={18}/><input id="auth-signup-email" className="text-field" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" inputMode="email" dir="ltr" autoComplete="email" /></div>{passwordFields('sign-up')}<div className="auth-password-tools"><button type="button" onClick={generatePassword}><Sparkles size={15}/>{copy.generatePassword}</button><button type="button" onClick={() => void copyPassword()}><Copy size={15}/>{copy.copyPassword}</button></div><button className="primary-button auth-submit" type="button" onClick={() => void signUp()} disabled={busy}>{busy ? <LoaderCircle className="spin" size={18}/> : <CheckCircle2 size={18}/>}{copy.signupButton}</button></div>}
              {stage === 'magic-link' && <div className="auth-form"><button className="auth-back" type="button" onClick={() => setAuthStage('sign-in')}><BackIcon size={16}/>{copy.backToLogin}</button><label htmlFor="auth-magic-email">{copy.email}</label><div className="auth-input-wrap"><Mail size={18}/><input id="auth-magic-email" className="text-field" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" inputMode="email" dir="ltr" autoComplete="email" /></div><button className="primary-button auth-submit" type="button" onClick={() => void requestMagicLink()} disabled={busy}>{busy ? <LoaderCircle className="spin" size={18}/> : <Mail size={18}/>}{copy.sendMagic}</button></div>}
              {stage === 'reset' && <div className="auth-form"><button className="auth-back" type="button" onClick={() => setAuthStage('sign-in')}><BackIcon size={16}/>{copy.backToLogin}</button><label htmlFor="auth-reset-email">{copy.email}</label><div className="auth-input-wrap"><Mail size={18}/><input id="auth-reset-email" className="text-field" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" inputMode="email" dir="ltr" autoComplete="email" /></div><button className="primary-button auth-submit" type="button" onClick={() => void requestPasswordReset()} disabled={busy}>{busy ? <LoaderCircle className="spin" size={18}/> : <RefreshCw size={18}/>}{copy.resetButton}</button></div>}
              {stage === 'recovery' && <div className="auth-form">{passwordFields('recovery')}<button className="primary-button auth-submit" type="button" onClick={() => void saveRecoveredPassword()} disabled={busy}>{busy ? <LoaderCircle className="spin" size={18}/> : <CheckCircle2 size={18}/>}{copy.recoveryButton}</button></div>}
              {stage === 'sent' && <div className="auth-form"><button className="auth-back" type="button" onClick={() => setAuthStage(sentPurpose === 'signup' ? 'sign-in' : sentPurpose === 'reset' ? 'reset' : 'magic-link')}><BackIcon size={16}/>{copy.changeEmail}</button><p className="auth-email">{copy.email} <b dir="ltr">{email}</b></p><div className="auth-link-hint"><CheckCircle2 size={22}/><div><strong>{copy.openEmail}</strong><span>{copy.openEmailDescription}</span></div></div><button className="auth-resend" type="button" onClick={() => { if (sentPurpose === 'signup') void resendSignUpVerification(); else if (sentPurpose === 'reset') void requestPasswordReset(); else void requestMagicLink() }} disabled={busy}><RefreshCw size={15}/>{copy.resend}</button></div>}
              {googleEnabled && stage !== 'sent' && stage !== 'recovery' ? <button className="auth-google-button" type="button" onClick={() => void signInWithGoogle()} disabled={busy}><span>G</span>{copy.google}</button> : !googleEnabled && (stage === 'sign-in' || stage === 'sign-up') ? <p className="auth-provider-note">{copy.googleUnavailable}</p> : null}
              {notice && <p className="auth-notice"><CheckCircle2 size={17}/>{notice}</p>}
              {error && <p className="auth-error" role="alert">{error}</p>}
              <p className="auth-footnote"><Sparkles size={14}/>{t.auth.footnote}</p>
            </>}
      </section>
    </main>
  )
}
