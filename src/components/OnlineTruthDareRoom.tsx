import { useState } from 'react'
import { Copy, Crown, Play, ShieldCheck, Sparkles, UserPlus, Users, Wifi } from 'lucide-react'
import type { LoadedRoom } from '../lib/partyplay'
import type { TruthDareCategory, TruthDareRoomSettings } from '../lib/partyplay'
import { PlayerAvatar } from './SocialIdentity'
import RoomLobbyPanel from './RoomLobbyPanel'
import { useLanguage } from '../i18n'

type SetupProps = { pending: boolean; onBack: () => void; onCreate: (capacity: number, settings: TruthDareRoomSettings) => void }

export function TruthDareRoomSetup({ pending, onBack, onCreate }: SetupProps) {
  const { language } = useLanguage()
  const fa = language === 'fa'
  const [capacity, setCapacity] = useState(6)
  const [categories, setCategories] = useState<TruthDareCategory[]>(['fun', 'friends', 'extreme'])
  const [strictFilter, setStrictFilter] = useState(true)
  const [customText, setCustomText] = useState('')
  const categoryNames: Record<TruthDareCategory, string> = fa ? { fun: 'سرگرمی', friends: 'دوستان', extreme: 'چالشی', spicy: 'اسپایسی' } : { fun: 'Fun', friends: 'Friends', extreme: 'Extreme', spicy: 'Spicy' }
  const toggleCategory = (category: TruthDareCategory) => setCategories((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category])
  const submit = () => onCreate(capacity, { categories, strictFilter, customPrompts: customText.split('\n').map((line) => line.trim()).filter(Boolean) })
  return <section className="sub-page truth-setup-page">
    <button className="back-link" onClick={onBack}>{fa ? 'بازگشت به بازی‌ها' : 'Back to Games'}</button>
    <div className="page-title"><span className="eyebrow"><Sparkles size={15}/> {fa ? 'تنظیمات میزبان' : 'Host settings'}</span><h1>{fa ? 'یک جمع واقعی بساز' : 'Set up your group'}</h1><p>{fa ? 'دسته‌ها و فیلتر محتوا را برای این اتاق انتخاب کن.' : 'Choose the prompt categories and content filter for this room.'}</p></div>
    <section className="panel truth-setup-panel">
      <div className="truth-setup-icon"><Sparkles size={32}/></div>
      <div><span className="eyebrow">{fa ? 'ظرفیت بازی' : 'Players'}</span><h2>{fa ? 'چند نفر بازی می‌کنید؟' : 'How many people?'}</h2><p>{fa ? 'هر چرخه، هر بازیکن دقیقاً یک‌بار نوبت می‌گیرد.' : 'Each player gets one turn in each shuffled cycle.'}</p></div>
      <div className="truth-capacity-picker" role="group" aria-label="انتخاب ظرفیت اتاق">
        {Array.from({ length: 11 }, (_, index) => index + 2).map((size) => <button className={capacity === size ? 'is-selected' : ''} key={size} onClick={() => setCapacity(size)} disabled={pending}>{size} {fa ? 'نفر' : 'players'}</button>)}
      </div>
      <fieldset className="truth-category-picker"><legend>{fa ? 'دسته‌های محتوا' : 'Prompt categories'}</legend>{(['fun','friends','extreme','spicy'] as TruthDareCategory[]).map((category) => <label key={category}><input type="checkbox" checked={categories.includes(category)} onChange={() => toggleCategory(category)} disabled={pending}/>{categoryNames[category]}{category === 'spicy' && <small>{fa ? 'خاموش به‌صورت پیش‌فرض' : 'Off by default'}</small>}</label>)}</fieldset>
      <label className="truth-filter-toggle"><input type="checkbox" checked={strictFilter} onChange={(event) => setStrictFilter(event.target.checked)} disabled={pending}/><span><b>{fa ? 'فیلتر سخت‌گیرانهٔ محتوا' : 'Strict content filter'}</b><small>{fa ? 'اطلاعات خصوصی، فشار به دیگران و چالش‌های ناامن حذف می‌شوند.' : 'Filters private information, pressure on others, and unsafe challenges.'}</small></span></label>
      <label className="truth-custom-prompts"><span className="eyebrow">{fa ? 'پرسش‌های سفارشی میزبان' : 'Host custom prompts'}</span><small>{fa ? 'هر خط با T: برای حقیقت یا D: برای جرئت؛ حداکثر ۲۰ مورد.' : 'One per line: T: for truth or D: for dare; up to 20.'}</small><textarea className="text-field" rows={3} maxLength={5800} value={customText} onChange={(event) => setCustomText(event.target.value)} placeholder={fa ? 'T: کدام بازی گروهی را بیشتر دوست داری؟\nD: یک شعار بامزه برای گروه بساز.' : 'T: Which group game do you like most?\nD: Invent a silly group slogan.'} disabled={pending}/></label>
      <button className="primary-button full-button" onClick={submit} disabled={pending || categories.length === 0}><Sparkles size={17}/>{pending ? (fa ? 'در حال ساخت…' : 'Creating…') : (fa ? 'ساخت اتاق' : 'Create room')}</button>
      <small><ShieldCheck size={14}/>{fa ? 'پرسش تصادفی و فیلترها در سرور اجرا می‌شوند؛ Spicy خاموش است تا میزبان انتخابش کند.' : 'Prompt selection and filtering run on the server; Spicy stays off unless the host enables it.'}</small>
    </section>
  </section>
}

type OnlineTruthDareRoomProps = {
  room: LoadedRoom
  currentUserId: string | null
  pending: boolean
  onBack: () => void
  onInvite: () => void
  onInviteFriends: () => void
  onStart: () => void
  onRefresh: () => Promise<unknown>
}

export default function OnlineTruthDareRoom({ room, currentUserId, pending, onBack, onInvite, onInviteFriends, onStart, onRefresh }: OnlineTruthDareRoomProps) {
  const { language } = useLanguage()
  const fa = language === 'fa'
  const isHost = room.room.host_id === currentUserId
  const activeMembers = room.members.filter((member) => member.role === 'host' || member.role === 'player')
  const allReady = activeMembers.length >= 2 && activeMembers.length <= room.room.capacity && activeMembers.every((member) => member.ready)
  const canStart = activeMembers.length >= 2 && allReady && isHost && room.room.status === 'lobby'
  const slots = Array.from({ length: room.room.capacity }, (_, index) => index)

  return <section className="room-page online-room-page truth-lobby-page">
    <button className="back-link" onClick={onBack}>{fa ? 'بازگشت به خانه' : 'Back home'}</button>
    <div className="room-hero accent-gold">
      <div className="room-game-symbol"><Sparkles size={29}/></div>
      <div><span className="eyebrow"><Wifi size={15}/>{fa ? 'لابی هم‌زمان' : 'LIVE LOBBY'}</span><h1>{room.room.name} <span className="room-code">{room.room.invite_code}</span></h1><p>{fa ? `جرئت یا حقیقت آنلاین · ۲ تا ${room.room.capacity} بازیکن · کد جایگزین` : `Truth or Dare · 2–${room.room.capacity} players · backup code`}</p></div>
      <div className="room-hero-actions"><button className="primary-button" onClick={onInviteFriends}><UserPlus size={17}/>{fa ? 'دعوت دوستان' : 'Invite friends'}</button><button className="secondary-button" onClick={onInvite}><Copy size={17}/>{fa ? 'کد پشتیبان' : 'Backup code'}</button></div>
    </div>
    <div className="room-layout truth-room-layout">
      <section className="panel lobby-panel truth-lobby-panel">
        <div className="panel-heading"><div><span className="eyebrow">بازیکن‌ها</span><h2>{room.members.length >= 2 ? 'جمع برای شروع آماده است' : 'منتظر اولین دوست هستیم'}</h2></div><span className="ready-counter"><span/> {room.members.length} از {room.room.capacity}</span></div>
        <div className="seat-grid online-seat-grid truth-seat-grid">
          {slots.map((seat) => {
            const member = room.members[seat]
            return <div className={`seat ${member ? 'seat-filled' : ''}`} key={seat}>{member ? <><div className="seat-avatar"><PlayerAvatar seed={member.avatarSeed} label={member.displayName} size="sm"/>{member.role === 'host' && <Crown size={14}/>}</div><strong>{member.displayName}{member.userId === currentUserId ? ' (تو)' : ''}</strong><small>{member.role === 'host' ? (fa ? 'میزبان بازی' : 'Host') : (fa ? 'آمادهٔ قرعه‌کشی' : 'Ready') }</small></> : <><span className="empty-seat"><UserPlus size={20}/></span><strong>{fa ? 'جای خالی' : 'Open seat'}</strong><small>{fa ? 'از فهرست دوستان دعوت کن' : 'Invite from Friends'}</small></>}</div>
          })}
        </div>
        <div className="invite-url"><Copy size={16}/><span>{fa ? 'کد جایگزین اتاق' : 'Backup room code'}: <b dir="ltr">{room.room.invite_code}</b></span></div>
        <RoomLobbyPanel room={room} currentUserId={currentUserId} onRefresh={onRefresh}/>
      </section>
      <aside className="room-side"><section className="panel game-rules"><div className="panel-heading"><div><span className="eyebrow">{fa ? 'قوانین این دور' : 'ROUND RULES'}</span><h2>{fa ? 'جرئت یا حقیقت' : 'Truth or Dare'}</h2></div><ShieldCheck size={19}/></div><ul><li><Users size={16}/>{fa ? 'هر نفر در یک چرخه فقط یک‌بار قرعه می‌شود.' : 'Each player is picked once per cycle.'}</li><li><Sparkles size={16}/>{fa ? 'فقط بازیکن نوبت‌دار کارت را انتخاب می‌کند.' : 'Only the active player chooses a card.'}</li><li><Copy size={16}/>{fa ? 'هر بازیکن در هر دور یک پیام چت دارد.' : 'Each player gets one chat message per turn.'}</li></ul><div className="start-note"><ShieldCheck size={17}/><span>{activeMembers.length >= 2 ? allReady ? isHost ? 'بازیکن‌ها آماده‌اند؛ قرعه‌کشی را شروع کن.' : 'منتظر بمان؛ میزبان قرعه‌کشی را شروع می‌کند.' : 'همه باید آماده شوند.' : 'برای شروع، دست‌کم یک دوست دیگر باید وارد شود.'}</span></div><button className="primary-button full-button large-button" onClick={onStart} disabled={!canStart || pending}><Play size={18} fill="currentColor"/>{pending ? (fa ? 'در حال آماده‌سازی…' : 'Preparing…') : (fa ? 'شروع قرعه‌کشی' : 'Start game')}</button></section></aside>
    </div>
  </section>
}
