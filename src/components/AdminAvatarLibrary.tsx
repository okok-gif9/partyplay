import { useEffect, useRef, useState } from 'react'
import { ImagePlus, RefreshCw, ShieldCheck, Upload } from 'lucide-react'
import { PlayerAvatar } from './SocialIdentity'
import { loadAdminAvatarLibrary, type AvatarCatalogItem, type AvatarLibraryTier, updateAdminAvatarLibrary, uploadAdminLibraryAvatar } from '../lib/partyplay'

type AdminAvatarLibraryProps = { notify: (message: string) => void }

const describeError = (error: unknown) => error instanceof Error ? error.message : 'به‌روزرسانی کتابخانه کامل نشد.'

export default function AdminAvatarLibrary({ notify }: AdminAvatarLibraryProps) {
  const [items, setItems] = useState<AvatarCatalogItem[]>([])
  const [label, setLabel] = useState('')
  const [tier, setTier] = useState<AvatarLibraryTier>('standard')
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const reload = async () => {
    try { setBusy(true); setItems(await loadAdminAvatarLibrary()) }
    catch (error) { notify(describeError(error)) }
    finally { setBusy(false) }
  }

  useEffect(() => { void reload() }, [])

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (label.trim().length < 2) { notify('برای آواتار یک نام کوتاه وارد کن.'); return }
    try {
      setBusy(true)
      await uploadAdminLibraryAvatar({ file, label: label.trim(), tier })
      setLabel('')
      await reload()
      notify('آواتار به کتابخانهٔ پلتفرم اضافه شد.')
    } catch (error) { notify(describeError(error)) }
    finally { setBusy(false) }
  }

  const updateItem = async (item: AvatarCatalogItem, changes: { tier?: AvatarLibraryTier; isActive?: boolean }) => {
    try {
      setBusy(true)
      await updateAdminAvatarLibrary({ avatarId: item.id, ...changes })
      await reload()
      notify('وضعیت آواتار به‌روز شد.')
    } catch (error) { notify(describeError(error)) }
    finally { setBusy(false) }
  }

  const activeCount = items.filter((item) => item.isActive).length
  const premiumCount = items.filter((item) => item.tier === 'premium' && item.isActive).length

  return <section className="admin-avatar-command">
    <header className="admin-avatar-command-head">
      <div><span className="eyebrow"><ImagePlus size={15}/> کتابخانهٔ پلتفرم</span><h2>آواتارهای قابل انتخاب</h2><p>دارایی‌های استاندارد و ویژه را از همین‌جا منتشر یا آرشیو کن.</p></div>
      <button className="secondary-button" type="button" disabled={busy} onClick={() => void reload()}><RefreshCw size={16}/>همگام‌سازی</button>
    </header>

    <div className="admin-avatar-summary"><article><small>دارایی‌های فعال</small><strong>{activeCount}</strong></article><article><small>ویژه</small><strong>{premiumCount}</strong></article><article><small>وضعیت انتشار</small><span><i/>زنده</span></article></div>

    <div className="admin-avatar-create">
      <div className="admin-avatar-create-copy"><ShieldCheck size={19}/><div><strong>افزودن آواتار جدید</strong><small>PNG، JPG، WebP یا GIF ثابت تا ۲ مگابایت</small></div></div>
      <input className="text-field" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="نام آواتار" maxLength={48}/>
      <div className="tier-option-row"><button type="button" className={tier === 'standard' ? 'tier-selected' : ''} onClick={() => setTier('standard')}>استاندارد</button><button type="button" className={tier === 'premium' ? 'tier-selected' : ''} onClick={() => setTier('premium')}>ویژه</button></div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(event) => void upload(event)}/>
      <button className="primary-button" type="button" disabled={busy || label.trim().length < 2} onClick={() => input.current?.click()}><Upload size={16}/>انتخاب فایل</button>
    </div>

    <div className="admin-avatar-catalog">
      {items.length ? items.map((item) => <article key={item.id} className={!item.isActive ? 'avatar-library-inactive' : ''}>
        <PlayerAvatar assetPath={item.assetPath} label={item.label} size="lg"/>
        <div className="admin-avatar-catalog-copy"><strong>{item.label}</strong><small>{item.tier === 'premium' ? 'کاربران ویژه و مدیر' : 'همهٔ کاربران'} · {item.isActive ? 'منتشرشده' : 'آرشیو'}</small></div>
        <div className="admin-avatar-catalog-actions"><button type="button" disabled={busy} onClick={() => void updateItem(item, { tier: item.tier === 'premium' ? 'standard' : 'premium' })}>{item.tier === 'premium' ? 'استاندارد کن' : 'ویژه کن'}</button><button type="button" className={item.isActive ? 'danger-action' : ''} disabled={busy} onClick={() => void updateItem(item, { isActive: !item.isActive })}>{item.isActive ? 'آرشیو کن' : 'انتشار'}</button></div>
      </article>) : <div className="admin-avatar-empty"><ImagePlus size={27}/><strong>کتابخانه هنوز آواتار مدیریتی ندارد.</strong><span>اولین دارایی را اضافه کن تا در انتخاب آواتار کاربران نشان داده شود.</span></div>}
    </div>
  </section>
}
