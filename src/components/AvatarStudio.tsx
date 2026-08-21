import { useEffect, useRef, useState } from 'react'
import { Check, Crown, ImagePlus, LockKeyhole, Sparkles, Upload } from 'lucide-react'
import type { CurrentProfile } from '../hooks/usePartyPlayData'
import { avatarOptions, PlayerAvatar } from './SocialIdentity'
import { loadAdminAvatarLibrary, loadAvatarCatalog, type AvatarCatalogItem, type AvatarLibraryTier, type AvatarSource, type PremiumRingColor, updateAdminAvatarLibrary, uploadAdminCustomAvatar, uploadAdminLibraryAvatar } from '../lib/partyplay'

type ProfileUpdate = { avatarSeed?: string; avatarLibraryId?: string; avatarMode?: AvatarSource; premiumRingEnabled?: boolean; premiumRingColor?: PremiumRingColor }

type AvatarStudioProps = { profile: CurrentProfile; updateProfile: (updates: ProfileUpdate) => Promise<CurrentProfile>; notify: (message: string) => void }

const ringOptions: Array<{ id: PremiumRingColor; label: string }> = [
  { id: 'violet', label: 'بنفش' }, { id: 'cyan', label: 'فیروزه‌ای' }, { id: 'pink', label: 'صورتی' }, { id: 'gold', label: 'طلایی' }, { id: 'aurora', label: 'طیفی' },
]

const message = (error: unknown) => error instanceof Error ? error.message : 'این عمل کامل نشد؛ دوباره تلاش کن.'

export default function AvatarStudio({ profile, updateProfile, notify }: AvatarStudioProps) {
  const isAdmin = profile.siteRole === 'site_admin'
  const canUsePremium = profile.isVerified || isAdmin
  const [catalog, setCatalog] = useState<AvatarCatalogItem[]>([])
  const [managed, setManaged] = useState<AvatarCatalogItem[]>([])
  const [busy, setBusy] = useState(false)
  const [label, setLabel] = useState('')
  const [tier, setTier] = useState<AvatarLibraryTier>('standard')
  const [showAdmin, setShowAdmin] = useState(false)
  const customInput = useRef<HTMLInputElement>(null)
  const libraryInput = useRef<HTMLInputElement>(null)

  const reload = async () => {
    try {
      const [nextCatalog, nextManaged] = await Promise.all([loadAvatarCatalog(), isAdmin ? loadAdminAvatarLibrary() : Promise.resolve([])])
      setCatalog(nextCatalog); setManaged(nextManaged)
    } catch (error) { notify(message(error)) }
  }

  useEffect(() => { void reload() }, [isAdmin])

  const chooseSeed = async (seed: string) => {
    try { setBusy(true); await updateProfile({ avatarSeed: seed, avatarMode: 'seed' }); notify('آواتار ذخیره شد.') } catch (error) { notify(message(error)) } finally { setBusy(false) }
  }
  const chooseLibrary = async (item: AvatarCatalogItem) => {
    if (!item.canUse) return
    try { setBusy(true); await updateProfile({ avatarLibraryId: item.id, avatarMode: 'library' }); notify('آواتار ذخیره شد.') } catch (error) { notify(message(error)) } finally { setBusy(false) }
  }
  const uploadCustom = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
    try { setBusy(true); await uploadAdminCustomAvatar(file); await updateProfile({ avatarMode: 'custom' }); notify('آواتار شخصی مدیر ذخیره شد.') } catch (error) { notify(message(error)) } finally { setBusy(false) }
  }
  const uploadLibrary = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
    if (label.trim().length < 2) { notify('برای آواتار یک نام کوتاه وارد کن.'); return }
    try { setBusy(true); await uploadAdminLibraryAvatar({ file, label: label.trim(), tier }); setLabel(''); await reload(); notify('آواتار به کتابخانه اضافه شد.') } catch (error) { notify(message(error)) } finally { setBusy(false) }
  }
  const updateLibrary = async (item: AvatarCatalogItem, changes: { tier?: AvatarLibraryTier; isActive?: boolean }) => {
    try { setBusy(true); await updateAdminAvatarLibrary({ avatarId: item.id, ...changes }); await reload(); notify('وضعیت آواتار به‌روز شد.') } catch (error) { notify(message(error)) } finally { setBusy(false) }
  }
  const saveRing = async (changes: { enabled?: boolean; color?: PremiumRingColor }) => {
    if (!canUsePremium) return
    try { setBusy(true); await updateProfile({ premiumRingEnabled: changes.enabled ?? profile.premiumRingEnabled, premiumRingColor: changes.color ?? profile.premiumRingColor }); notify('قاب نئون ذخیره شد.') } catch (error) { notify(message(error)) } finally { setBusy(false) }
  }

  const activeSeed = profile.avatarSource === 'seed' ? profile.avatarSeed : ''
  const activeLibrary = profile.avatarSource === 'library' ? profile.avatarAssetPath : ''

  return <>
    <section className="panel setting-block-live avatar-studio">
      <div className="section-panel-heading"><div><span className="eyebrow"><ImagePlus size={15}/> هویت تصویری</span><h2>آواتارها</h2><p>یکی از آواتارهای آماده یا در صورت دسترسی، یک آواتار ویژه را انتخاب کن.</p></div></div>
      <div className="avatar-picker avatar-picker-seeds">{avatarOptions.map((option) => { const locked = Boolean(option.premiumOnly) && !canUsePremium; return <button key={option.id} type="button" className={`${activeSeed === option.id ? 'avatar-choice-selected ' : ''}${option.premiumOnly ? 'avatar-premium-choice ' : ''}${locked ? 'avatar-locked-choice' : ''}`} disabled={locked || busy} onClick={() => void chooseSeed(option.id)} aria-label={`${locked ? 'قفل: ' : ''}آواتار ${option.label}`}><PlayerAvatar seed={option.id} label={option.label} size="lg"/>{activeSeed === option.id && <Check size={16}/>}</button> })}</div>
      {catalog.length > 0 && <div className="avatar-library-section"><div className="avatar-library-heading"><span>کتابخانهٔ تازه</span><small>مدیریت‌شده توسط مدیر سایت</small></div><div className="avatar-picker avatar-picker-library">{catalog.map((item) => { const selected = activeLibrary === item.assetPath; const locked = !item.canUse; return <button key={item.id} type="button" className={`${selected ? 'avatar-choice-selected ' : ''}${item.tier === 'premium' ? 'avatar-premium-choice ' : ''}${locked ? 'avatar-locked-choice' : ''}`} disabled={locked || busy} onClick={() => void chooseLibrary(item)} aria-label={`${locked ? 'قفل: ' : ''}آواتار ${item.label}`}><PlayerAvatar assetPath={item.assetPath} label={item.label} size="lg"/>{selected && <Check size={16}/>}</button> })}</div></div>}
      {isAdmin && <div className="admin-avatar-shortcut"><input ref={customInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(event) => void uploadCustom(event)}/><button type="button" className="secondary-button" disabled={busy} onClick={() => customInput.current?.click()}><Upload size={16}/>بارگذاری آواتار شخصی مدیر</button><small>PNG، JPG، WebP یا GIF ثابت تا ۲ مگابایت</small></div>}
    </section>

    <section className={`panel setting-block-live premium-ring-panel ${canUsePremium ? '' : 'premium-ring-locked'}`}>
      <div className="section-panel-heading"><div><span className="eyebrow"><Sparkles size={15}/> امکانات ویژه</span><h2>قاب نئون دوحلقه‌ای</h2><p>{canUsePremium ? 'در حالت پیش‌فرض خاموش است؛ هر زمان خواستی رنگ آن را انتخاب و فعال کن.' : 'این جلوه برای کاربران ویژه و مدیر سایت در دسترس است.'}</p></div></div>
      <div className="ring-preview-row"><PlayerAvatar seed={profile.avatarSeed} assetPath={profile.avatarAssetPath} label={profile.displayName} size="xl" premiumRingEnabled={canUsePremium && profile.premiumRingEnabled} premiumRingColor={profile.premiumRingColor}/><div><button type="button" disabled={!canUsePremium || busy} className={`premium-ring-switch ${profile.premiumRingEnabled ? 'ring-on' : ''}`} onClick={() => void saveRing({ enabled: !profile.premiumRingEnabled })}><i/><span>{profile.premiumRingEnabled ? 'قاب روشن است' : 'قاب خاموش است'}</span></button>{!canUsePremium && <small className="locked-feature-note"><LockKeyhole size={13}/>با فعال‌شدن وضعیت ویژه باز می‌شود.</small>}</div></div>
      <div className="ring-color-picker">{ringOptions.map((option) => <button key={option.id} type="button" disabled={!canUsePremium || busy} className={`ring-color-option ring-color-${option.id} ${profile.premiumRingColor === option.id ? 'ring-color-selected' : ''}`} onClick={() => void saveRing({ color: option.id })}><i/><span>{option.label}</span>{profile.premiumRingColor === option.id && <Check size={14}/>}</button>)}</div>
    </section>

    {isAdmin && <section className="panel setting-block-live admin-avatar-library">
      <div className="section-panel-heading"><div><span className="eyebrow"><Crown size={15}/> فقط مدیر سایت</span><h2>مدیریت کتابخانهٔ آواتارها</h2><p>هر مورد را استاندارد یا ویژه قرار بده و در صورت نیاز بدون حذف فایل غیرفعال کن.</p></div><button type="button" className="text-button" onClick={() => setShowAdmin((value) => !value)}>{showAdmin ? 'بستن' : 'باز کردن'}</button></div>
      {showAdmin && <div className="admin-avatar-library-body"><div className="admin-avatar-upload"><input className="text-field" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="نام آواتار" maxLength={48}/><div className="tier-option-row"><button type="button" className={tier === 'standard' ? 'tier-selected' : ''} onClick={() => setTier('standard')}>استاندارد</button><button type="button" className={tier === 'premium' ? 'tier-selected' : ''} onClick={() => setTier('premium')}>ویژه</button></div><input ref={libraryInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(event) => void uploadLibrary(event)}/><button type="button" className="primary-button" disabled={busy || label.trim().length < 2} onClick={() => libraryInput.current?.click()}><Upload size={16}/>افزودن به کتابخانه</button></div><div className="admin-avatar-list">{managed.length ? managed.map((item) => <article key={item.id} className={item.isActive ? '' : 'avatar-library-inactive'}><PlayerAvatar assetPath={item.assetPath} label={item.label} size="md"/><div><strong>{item.label}</strong><small>{item.tier === 'premium' ? 'ویژه' : 'استاندارد'} · {item.isActive ? 'فعال' : 'غیرفعال'}</small></div><div className="admin-avatar-row-actions"><button type="button" disabled={busy} onClick={() => void updateLibrary(item, { tier: item.tier === 'premium' ? 'standard' : 'premium' })}>{item.tier === 'premium' ? 'استاندارد کن' : 'ویژه کن'}</button><button type="button" disabled={busy} className={item.isActive ? 'danger-action' : ''} onClick={() => void updateLibrary(item, { isActive: !item.isActive })}>{item.isActive ? 'غیرفعال' : 'فعال'}</button></div></article>) : <p className="safety-muted">هنوز آواتاری به کتابخانه اضافه نشده است.</p>}</div></div>}
    </section>}
  </>
}
