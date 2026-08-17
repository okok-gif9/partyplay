import { type ReactNode, useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, LoaderCircle, Mail, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type AuthStage = 'email' | 'sent'

type AuthGateProps = {
  theme: 'light' | 'dark'
  children: ReactNode
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function authErrorMessage(message: string) {
  const normalized = message.toLowerCase()
  if (normalized.includes('rate limit')) return 'تعداد درخواست‌ها زیاد شده است؛ چند دقیقه بعد دوباره تلاش کن.'
  if (normalized.includes('invalid') || normalized.includes('token')) return 'کد واردشده معتبر نیست یا زمانش گذشته است.'
  if (normalized.includes('email')) return 'نشانی ایمیل را دوباره بررسی کن.'
  return 'ارتباط با حساب کاربری کامل نشد. دوباره تلاش کن.'
}

export default function AuthGate({ theme, children }: AuthGateProps) {
  const [isReady, setIsReady] = useState(!isSupabaseConfigured)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [stage, setStage] = useState<AuthStage>('email')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

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

  const requestCode = async () => {
    const normalizedEmail = email.trim().toLowerCase()
    if (!emailPattern.test(normalizedEmail)) {
      setError('یک نشانی ایمیل معتبر وارد کن.')
      return
    }
    if (!supabase) return

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
    setNotice('پیوند ورود یک‌بارمصرف به ایمیلت فرستاده شد.')
  }

  if (!isSupabaseConfigured || isAuthenticated) return <>{children}</>

  return (
    <main className="app-shell auth-shell" data-theme={theme} dir="rtl">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-brand">
          <span className="brand-mark"><span>◈</span><i /><i /><i /><i /></span>
          <span className="brand-text">پارتی<span>پلی</span></span>
        </div>

        {!isReady ? (
          <div className="auth-loading" role="status">
            <LoaderCircle size={26} />
            <p>در حال بررسی ورود امن تو…</p>
          </div>
        ) : (
          <>
            <span className="eyebrow"><ShieldCheck size={15} /> ورود امن و بدون رمز</span>
            <h1 id="auth-title">بازی از همین‌جا شروع می‌شه</h1>
            <p className="auth-lead">ایمیلت رو وارد کن؛ یک پیوند یک‌بارمصرف می‌فرستیم تا وارد جمع خودت بشی.</p>

            {stage === 'email' ? (
              <div className="auth-form">
                <label htmlFor="auth-name">نام نمایشی <small>اختیاری</small></label>
                <input
                  id="auth-name"
                  className="text-field"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="مثلاً کیان"
                  maxLength={40}
                  autoComplete="name"
                />
                <label htmlFor="auth-email">ایمیل</label>
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
                  فرستادن پیوند ورود
                </button>
              </div>
            ) : (
              <div className="auth-form">
                <button className="auth-back" type="button" onClick={() => { setStage('email'); setError(''); setNotice('') }}>
                  <ArrowRight size={16} /> تغییر ایمیل
                </button>
                <p className="auth-email">پیوند ورود را به <b dir="ltr">{email}</b> فرستادیم.</p>
                <div className="auth-link-hint">
                  <CheckCircle2 size={22} />
                  <div><strong>ایمیل را باز کن</strong><span>روی پیوند ورود بزن تا مستقیم وارد پارتی‌پلی شوی.</span></div>
                </div>
                <button className="auth-resend" type="button" onClick={() => void requestCode()} disabled={busy}>
                  <RefreshCw size={15} /> ارسال دوبارهٔ پیوند
                </button>
              </div>
            )}

            {notice && <p className="auth-notice"><CheckCircle2 size={17} />{notice}</p>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <p className="auth-footnote"><Sparkles size={14} /> هیچ رمزی ذخیره نمی‌کنیم؛ فقط یک پیوند کوتاه و امن برای ورود.</p>
          </>
        )}
      </section>
    </main>
  )
}
