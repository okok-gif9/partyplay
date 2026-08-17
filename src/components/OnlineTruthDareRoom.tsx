import { Copy, Crown, Play, ShieldCheck, Sparkles, UserPlus, Users, Wifi } from 'lucide-react'
import type { LoadedRoom } from '../lib/partyplay'
import { PlayerAvatar } from './SocialIdentity'

type SetupProps = { pending: boolean; onBack: () => void; onCreate: (capacity: number) => void }

export function TruthDareRoomSetup({ pending, onBack, onCreate }: SetupProps) {
  return <section className="sub-page truth-setup-page">
    <button className="back-link" onClick={onBack}>بازگشت به بازی‌ها</button>
    <div className="page-title"><span className="eyebrow"><Sparkles size={15}/> اتاق خصوصی</span><h1>یک جمع واقعی بساز</h1><p>لینک را برای دوست‌ها بفرست؛ وقتی حداقل دو نفر حاضر شدند، قرعه‌کشی شروع می‌شود.</p></div>
    <section className="panel truth-setup-panel">
      <div className="truth-setup-icon"><Sparkles size={32}/></div>
      <div><span className="eyebrow">ظرفیت بازی</span><h2>چند نفر بازی می‌کنید؟</h2><p>در هر چرخه، هر بازیکن دقیقاً یک‌بار نوبت می‌گیرد.</p></div>
      <div className="truth-capacity-picker" role="group" aria-label="انتخاب ظرفیت اتاق">
        {[2, 3, 4, 5, 6, 7, 8].map((capacity) => <button key={capacity} onClick={() => onCreate(capacity)} disabled={pending}>{capacity} نفر</button>)}
      </div>
      <small><ShieldCheck size={14}/> لینک فقط برای همین اتاق ساخته می‌شود؛ چت و نوبت‌ها هم‌زمان‌اند.</small>
    </section>
  </section>
}

type OnlineTruthDareRoomProps = {
  room: LoadedRoom
  currentUserId: string | null
  pending: boolean
  onBack: () => void
  onInvite: () => void
  onStart: () => void
}

export default function OnlineTruthDareRoom({ room, currentUserId, pending, onBack, onInvite, onStart }: OnlineTruthDareRoomProps) {
  const isHost = room.room.host_id === currentUserId
  const canStart = room.members.length >= 2 && isHost && room.room.status === 'lobby'
  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${room.room.invite_code}`
  const slots = Array.from({ length: room.room.capacity }, (_, index) => index)

  return <section className="room-page online-room-page truth-lobby-page">
    <button className="back-link" onClick={onBack}>بازگشت به خانه</button>
    <div className="room-hero accent-gold">
      <div className="room-game-symbol"><Sparkles size={29}/></div>
      <div><span className="eyebrow"><Wifi size={15}/> لابی هم‌زمان</span><h1>{room.room.name} <span className="room-code">{room.room.invite_code}</span></h1><p>جرئت یا حقیقت آنلاین · ۲ تا {room.room.capacity} بازیکن · لینک خصوصی</p></div>
      <div className="room-hero-actions"><button className="secondary-button" onClick={onInvite}><Copy size={17}/>کپی لینک</button></div>
    </div>
    <div className="room-layout truth-room-layout">
      <section className="panel lobby-panel truth-lobby-panel">
        <div className="panel-heading"><div><span className="eyebrow">بازیکن‌ها</span><h2>{room.members.length >= 2 ? 'جمع برای شروع آماده است' : 'منتظر اولین دوست هستیم'}</h2></div><span className="ready-counter"><span/> {room.members.length} از {room.room.capacity}</span></div>
        <div className="seat-grid online-seat-grid truth-seat-grid">
          {slots.map((seat) => {
            const member = room.members[seat]
            return <div className={`seat ${member ? 'seat-filled' : ''}`} key={seat}>{member ? <><div className="seat-avatar"><PlayerAvatar seed={member.avatarSeed} label={member.displayName} size="sm"/>{member.role === 'host' && <Crown size={14}/>}</div><strong>{member.displayName}{member.userId === currentUserId ? ' (تو)' : ''}</strong><small>{member.role === 'host' ? 'میزبان بازی' : 'آمادهٔ قرعه‌کشی'}</small></> : <><span className="empty-seat"><UserPlus size={20}/></span><strong>جای خالی</strong><small>لینک دعوت را بفرست</small></>}</div>
          })}
        </div>
        <div className="invite-url"><Copy size={16}/><span dir="ltr">{inviteUrl}</span></div>
      </section>
      <aside className="room-side"><section className="panel game-rules"><div className="panel-heading"><div><span className="eyebrow">قوانین این دور</span><h2>جرئت یا حقیقت</h2></div><ShieldCheck size={19}/></div><ul><li><Users size={16}/>هر نفر در یک چرخه فقط یک‌بار قرعه می‌شود.</li><li><Sparkles size={16}/>فقط بازیکن نوبت‌دار کارت را انتخاب می‌کند.</li><li><Copy size={16}/>هر بازیکن در هر دور یک پیام چت دارد.</li></ul><div className="start-note"><ShieldCheck size={17}/><span>{room.members.length >= 2 ? isHost ? 'بازیکن‌ها حاضرند؛ قرعه‌کشی را شروع کن.' : 'منتظر بمان؛ میزبان قرعه‌کشی را شروع می‌کند.' : 'برای شروع، دست‌کم یک دوست دیگر باید وارد شود.'}</span></div><button className="primary-button full-button large-button" onClick={onStart} disabled={!canStart || pending}><Play size={18} fill="currentColor"/>{pending ? 'در حال آماده‌سازی…' : 'شروع قرعه‌کشی'}</button></section></aside>
    </div>
  </section>
}
