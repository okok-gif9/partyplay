import { type ReactNode, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle, Mail, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { useLanguage } from '../i18n'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type AuthStage = 'email' | 'sent'

type AuthGateProps = {
  theme: 'light' | 'dark'
  children: ReactNode
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function AuthGate({ theme, children }: AuthGateProps) {
  const { language, t } = useLanguage()
  const [isReady, setIsReady] = useState(!isSupabaseConfigured)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [stage, setStage] = useState<AuthStage>('email')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const BackIcon = language === 'fa' ? ArrowRight : ArrowLeft
  const gamePreview = language === 'fa'
    ? ['مافیا', 'جاسوس', 'اونو', 'تخته‌نرد', 'منچ', 'رمز', 'دوز', 'حکم', 'فری‌سل']
    : ['Mafia', 'Spyfall', 'UNO', 'Backgammon', 'Ludo', 'Codenames', 'Tic-Tac-Toe', 'Hokm', 'FreeCell']

  useEffect(() => {
    if (!supabase) return

    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setIsAuthenticated(Boolean(data.session))
      setIsReady(true)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      setIsAuthenticated(Boolean(session))
      setIsReady(true)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const authErrorMessage = (message: string) => {
    const normalized = message.toLowerCase()
    if (normalized.includes('rate limit')) return t.auth.errors.rateLimit
    if (normalized.includes('invalid') || normalized.includes('token')) return t.auth.errors.invalidToken
    if (normalized.includes('email')) return t.auth.errors.email
    return t.auth.errors.unknown
  }

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

  if (!isSupabaseConfigured || isAuthenticated) return <>{children}</>

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
        ) : (
          <>
            <span className="eyebrow"><ShieldCheck size={15} /> {t.auth.securePasswordless}</span>
            <h1 id="auth-title">{t.auth.title}</h1>
            <p className="auth-lead">{t.auth.description}</p>
            <div className="auth-game-preview" aria-label={t.auth.games}><span>{t.auth.games}</span><div>{gamePreview.map((game) => <b key={game}>{game}</b>)}</div></div>

            {stage === 'email' ? (
              <div className="auth-form">
                <label htmlFor="auth-name">{t.auth.displayName} <small>{t.auth.optional}</small></label>
                <input
                  id="auth-name"
                  className="text-field"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder={t.auth.displayNamePlaceholder}
                  maxLength={40}
                  autoComplete="name"
                />
                <label htmlFor="auth-email">{t.auth.email}</label>
                <div className="auth-input-wrap">
                  <Mail size={18} />
                  <input
                    id="auth-email"
                    className="text-field"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void requestCode()
                    }}
                    placeholder="you@example.com"
                    type="email"
                    inputMode="email"
                    dir="ltr"
                    autoComplete="email"
                  />
                </div>
                <button className="primary-button auth-submit" type="button" onClick={() => void requestCode()} disabled={busy}>
                  {busy ? <LoaderCircle className="spin" size={18} /> : <Mail size={18} />}
                  {t.auth.sendLink}
                </button>
              </div>
            ) : (
              <div className="auth-form">
                <button className="auth-back" type="button" onClick={() => { setStage('email'); setError(''); setNotice('') }}>
                  <BackIcon size={16} /> {t.auth.changeEmail}
                </button>
                <p className="auth-email">{t.auth.linkSentTo} <b dir="ltr">{email}</b>.</p>
                <div className="auth-link-hint">
                  <CheckCircle2 size={22} />
                  <div><strong>{t.auth.openEmail}</strong><span>{t.auth.openEmailDescription}</span></div>
                </div>
                <button className="auth-resend" type="button" onClick={() => void requestCode()} disabled={busy}>
                  <RefreshCw size={15} /> {t.auth.resend}
                </button>
              </div>
            )}

            {notice && <p className="auth-notice"><CheckCircle2 size={17} />{notice}</p>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <p className="auth-footnote"><Sparkles size={14} /> {t.auth.footnote}</p>
          </>
        )}
      </section>
    </main>
  )
}
