import { Copy, Crown, Grid2X2, Play, ShieldCheck, UserPlus, Users, Wifi } from 'lucide-react'
import type { LoadedRoom } from '../lib/partyplay'

type OnlineTicTacToeRoomProps = {
  room: LoadedRoom
  currentUserId: string | null
  pending: boolean
  onBack: () => void
  onInvite: () => void
  onStart: () => void
}

const toneForSeat = (seat: number) => seat === 0 ? 'pink' : 'cyan'

export default function OnlineTicTacToeRoom({ room, currentUserId, pending, onBack, onInvite, onStart }: OnlineTicTacToeRoomProps) {
  const isHost = room.room.host_id === currentUserId
  const canStart = room.members.length === 2 && isHost && room.room.status === 'lobby'
  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${room.room.invite_code}`

  return <section className="room-page online-room-page">
    <button className="back-link" onClick={onBack}>بازگشت به خانه</button>
    <div className="room-hero accent-cyan">
      <div className="room-game-symbol"><Grid2X2 size={29} /></div>
      <div><span className="eyebrow"><Wifi size={15} /> لابی هم‌زمان</span><h1>{room.room.name} <span className="room-code">{room.room.invite_code}</span></h1><p>دوز آنلاین · دقیقاً ۲ بازیکن · لینک خصوصی</p></div>
      <div className="room-hero-actions"><button className="secondary-button" onClick={onInvite}><Copy size={17} />کپی لینک</button></div>
    </div>
    <div className="room-layout">
      <section className="panel lobby-panel">
        <div className="panel-heading"><div><span className="eyebrow">بازیکن‌ها</span><h2>{room.members.length === 2 ? 'جمع کامل شد' : 'منتظر حریف هستیم'}</h2></div><span className="ready-counter"><span /> {room.members.length} از ۲</span></div>
        <div className="seat-grid online-seat-grid">
          {[0, 1].map((seat) => {
            const member = room.members[seat]
            return <div className={`seat ${member ? 'seat-filled' : ''}`} key={seat}>{member ? <><div className="seat-avatar"><span className={`avatar avatar-${toneForSeat(seat)}`}>{member.displayName.charAt(0) || 'پ'}</span>{member.role === 'host' && <Crown size={14} />}</div><strong>{member.displayName}{member.userId === currentUserId ? ' (تو)' : ''}</strong><small>{member.role === 'host' ? 'میزبان · مهرهٔ X' : 'بازیکن دوم · مهرهٔ O'}</small></> : <><span className="empty-seat"><UserPlus size={20} /></span><strong>منتظر بازیکن دوم</strong><small>لینک دعوت را بفرست</small></>}</div>
          })}
        </div>
        <div className="invite-url"><Copy size={16} /><span dir="ltr">{inviteUrl}</span></div>
      </section>
      <aside className="room-side"><section className="panel game-rules"><div className="panel-heading"><div><span className="eyebrow">قوانین این دور</span><h2>دوز آنلاین</h2></div><ShieldCheck size={19} /></div><ul><li><Users size={16} />فقط ۲ بازیکن؛ میزبان مهرهٔ X دارد.</li><li><Grid2X2 size={16} />هر حرکت در سرور اعتبارسنجی می‌شود.</li><li><Wifi size={16} />برد و نوبت هم‌زمان برای هر دو نفر به‌روز می‌شود.</li></ul><div className="start-note"><ShieldCheck size={17} /><span>{room.members.length === 2 ? isHost ? 'هر دو بازیکن حاضرند؛ می‌توانی شروع کنی.' : 'میزبان بازی را شروع می‌کند.' : 'برای شروع، یک بازیکن دیگر باید وارد شود.'}</span></div><button className="primary-button full-button large-button" onClick={onStart} disabled={!canStart || pending}><Play size={18} fill="currentColor" />{pending ? 'در حال آماده‌سازی…' : 'شروع بازی'}</button></section></aside>
    </div>
  </section>
}
