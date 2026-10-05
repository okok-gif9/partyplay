import { useEffect, useState } from 'react'
import { Check, UserRound } from 'lucide-react'
import type { CurrentProfile } from '../hooks/usePartyPlayData'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../i18n'

export default function ProfileBioEditor({ profile, onSaved }: { profile: CurrentProfile | null; onSaved: () => Promise<unknown> }) {
  const { language } = useLanguage()
  const fa = language === 'fa'
  const [bio, setBio] = useState(profile?.bio || '')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => setBio(profile?.bio || ''), [profile?.bio])
  if (!profile) return null

  const save = async () => {
    if (!supabase) return
    setBusy(true)
    setNotice('')
    setError('')
    const { error: saveError } = await supabase.rpc('partyplay_update_profile_bio', { p_bio: bio.trim() })
    if (saveError) {
      setError(fa ? 'ذخیرهٔ معرفی انجام نشد؛ اتصال پایگاه داده را بررسی کن.' : 'The bio could not be saved. Check the database connection.')
      setBusy(false)
      return
    }
    try {
      await onSaved()
      setNotice(fa ? 'معرفی پروفایل ذخیره شد.' : 'Profile bio saved.')
    } catch {
      setError(fa ? 'متن ذخیره شد، اما به‌روزرسانی پروفایل انجام نشد.' : 'The bio saved, but the profile could not refresh.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="sub-page profile-bio-shell">
    <section className="panel setting-block-live profile-bio-panel">
      <div className="section-panel-heading"><div><span className="eyebrow"><UserRound size={15}/>{fa ? 'معرفی پروفایل' : 'PROFILE BIO'}</span><h2>{fa ? 'چند کلمه دربارهٔ خودت' : 'A few words about you'}</h2></div></div>
      <textarea className="text-field account-bio-field" value={bio} onChange={(event) => setBio(event.target.value)} maxLength={280} rows={4} placeholder={fa ? 'بازی محبوب یا سبک بازی‌ات را بنویس…' : 'Share your favorite game or play style…'} />
      <div className="account-bio-actions"><small>{bio.length}/280</small><button className="primary-button" onClick={() => void save()} disabled={busy || bio.trim().length > 280}><Check size={16}/>{fa ? 'ذخیرهٔ معرفی' : 'Save bio'}</button></div>
      {notice && <p className="form-success" role="status">{notice}</p>}{error && <p className="form-error" role="alert">{error}</p>}
    </section>
  </section>
}
