import { Crown, Link2, Play, Users } from 'lucide-react'
import type { GameDefinition } from '../data/gameCatalog'
import type { LoadedRoom } from '../lib/partyplay'
import { PlayerAvatar } from './SocialIdentity'

const capacityOptions: Record<string, number[]> = {
  spyfall: [3, 4, 5, 6, 7, 8], uno: [2, 3, 4], pictionary: [3, 4, 5, 6, 7, 8],
  connect_four: [2], backgammon: [2], ludo: [2, 3, 4], snakes: [2, 3, 4, 5, 6, 7, 8], codenames: [4, 5, 6, 7, 8, 9, 10], hokm: [4],
}

export function FullGameSetup({ game, pending, error, onCreate, onBack }: { game: GameDefinition; pending: boolean; error: string; onCreate: (capacity: number) => void; onBack: () => void }) {
  const options = capacityOptions[game.id] || [2]
  return <section className={`mafia-setup accent-${game.accent}`}>
    <button className="back-link" onClick={onBack}>بازگشت به بازی‌ها</button>
    <div className="mafia-setup-hero"><span className="mafia-sigil">{game.art}</span><div><span className="eyebrow">اتاق خصوصی آنلاین</span><h2>{game.title}</h2><p>{game.subtitle}؛ میزبان ظرفیت را انتخاب می‌کند و لینک اختصاصی برای دوستانش می‌فرستد.</p></div></div>
    <div className="mafia-capacity-grid">{options.map((capacity) => <button key={capacity} className="mafia-capacity-card" disabled={pending} onClick={() => onCreate(capacity)}><Users size={23}/><strong>{capacity} نفره</strong><small>{capacity === 2 ? 'رقابت دونفره' : 'دورهمی خصوصی'}</small></button>)}</div>
    {error && <p className="form-error">{error}</p>}
  </section>
}

export default function OnlineFullGameRoom({ game, room, currentUserId, pending, error, onStart, onBack }: { game: GameDefinition; room: LoadedRoom; currentUserId: string | null; pending: boolean; error: string; onStart: () => void; onBack: () => void }) {
  const isHost = room.room.host_id === currentUserId
  const seats = Array.from({ length: room.room.capacity }, (_, index) => room.members.find((member) => member.seatNo === index + 1) || null)
  const joined = room.members.filter((member) => member.role === 'host' || member.role === 'player').length
  const copyInvite = async () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${room.room.invite_code}`
    try { await navigator.clipboard.writeText(url) } catch { window.prompt('این لینک را برای دوستانت بفرست:', url) }
  }
  return <section className={`mafia-room accent-${game.accent}`}>
    <button className="back-link" onClick={onBack}>بازگشت به بازی‌ها</button>
    <div className="mafia-room-top"><div><span className="eyebrow">لابی {game.title} · {room.room.capacity} نفره</span><h2>{room.room.name}</h2><p>{joined} از {room.room.capacity} بازیکن وارد شده‌اند. همهٔ صندلی‌ها باید پر شوند.</p></div><button className="secondary-button" onClick={() => void copyInvite()}><Link2 size={17}/>کپی لینک دعوت</button></div>
    <div className="mafia-seats">{seats.map((member, index) => member ? <article className="mafia-seat filled" key={member.userId}><PlayerAvatar seed={member.avatarSeed} label={member.displayName}/><div><strong>{member.displayName}</strong><small>{member.userId === room.room.host_id ? 'میزبان' : 'بازیکن'}</small></div>{member.userId === room.room.host_id && <Crown size={16}/>}</article> : <article className="mafia-seat" key={index}><span className="mafia-empty-seat">{index + 1}</span><div><strong>صندلی خالی</strong><small>لینک را بفرست</small></div></article>)}</div>
    {error && <p className="form-error">{error}</p>}
    <div className="mafia-room-footer">{isHost ? <button className="primary-button" disabled={pending || joined !== room.room.capacity} onClick={onStart}><Play size={17}/>شروع بازی</button> : <p>میزبان پس از تکمیل اتاق، بازی را شروع می‌کند.</p>}<span className={joined === room.room.capacity ? 'mafia-ready-count is-ready' : 'mafia-ready-count'}>{joined}/{room.room.capacity}</span></div>
  </section>
}
