import { useState } from 'react'
import { useLanguage } from '../i18n'
import type { MafiaRoomSettings } from '../lib/partyplay'
import { ArrowLeft, Check, Copy, Crown, Play, ShieldAlert, UserPlus } from 'lucide-react'
import type { LoadedRoom } from '../lib/partyplay'
import { PlayerAvatar } from './SocialIdentity'
import RoomLobbyPanel from './RoomLobbyPanel'

export function MafiaRoomSetup({ onCreate, pending, error }: { onCreate: (capacity: number, settings: MafiaRoomSettings) => void; pending: boolean; error: string }) {
  const { language } = useLanguage()
  const fa = language === 'fa'
  const [capacity, setCapacity] = useState(7)
  const [mafiaCount, setMafiaCount] = useState(3)
  const [doctorEnabled, setDoctorEnabled] = useState(true)
  const [detectiveEnabled, setDetectiveEnabled] = useState(true)
  const [daySeconds, setDaySeconds] = useState(180)
  const [votingSeconds, setVotingSeconds] = useState(60)
  const [revealOnDeath, setRevealOnDeath] = useState(false)
  const maxMafia = Math.max(1, capacity - Number(doctorEnabled) - Number(detectiveEnabled) - 1)
  const safeMafiaCount = Math.min(mafiaCount, maxMafia)
  const create = () => onCreate(capacity, {
    mafia_count: safeMafiaCount,
    doctor_enabled: doctorEnabled,
    detective_enabled: detectiveEnabled,
    day_seconds: daySeconds,
    voting_seconds: votingSeconds,
    reveal_on_death: revealOnDeath,
  })

  return <section className="mafia-setup">
    <div className="mafia-setup-hero"><span className="mafia-sigil">M</span><div>
      <span className="eyebrow">{fa ? 'اتاق خصوصی مافیا' : 'PRIVATE MAFIA ROOM'}</span>
      <h2>{fa ? 'شهر را جمع کن' : 'Gather the town'}</h2>
      <p>{fa ? 'از ۵ تا ۱۵ بازیکن؛ نقش‌های مخفی فقط روی سرور تخصیص داده می‌شوند.' : '5–15 players; secret roles are assigned on the server.'}</p>
    </div></div>
    <div className="mafia-settings-grid">
      <label className="mafia-setting-field"><span>{fa ? 'ظرفیت اتاق' : 'Room size'} <strong>{capacity} {fa ? 'نفر' : 'players'}</strong></span>
        <input type="range" min="5" max="15" step="1" value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} aria-label={fa ? 'ظرفیت مافیا' : 'Mafia player capacity'}/>
      </label>
      <label className="mafia-setting-field"><span>{fa ? 'تعداد کل تیم مافیا (با گادفادر)' : 'Mafia team size (including Godfather)'} <strong>{safeMafiaCount}</strong></span>
        <input type="range" min="1" max={maxMafia} step="1" value={safeMafiaCount} onChange={(event) => setMafiaCount(Number(event.target.value))} aria-label={fa ? 'تعداد مافیا' : 'Mafia team size'}/>
      </label>
      <label className="mafia-setting-field"><span>{fa ? 'زمان صحبت هر نفر' : 'Discussion time per player'} <strong>{Math.round(daySeconds / 60)} {fa ? 'دقیقه' : 'min'}</strong></span>
        <input type="range" min="60" max="300" step="30" value={daySeconds} onChange={(event) => setDaySeconds(Number(event.target.value))} aria-label={fa ? 'زمان صحبت' : 'Discussion timer'}/>
      </label>
      <label className="mafia-setting-field"><span>{fa ? 'زمان رأی‌گیری' : 'Voting time'} <strong>{votingSeconds} {fa ? 'ثانیه' : 'sec'}</strong></span>
        <input type="range" min="30" max="120" step="15" value={votingSeconds} onChange={(event) => setVotingSeconds(Number(event.target.value))} aria-label={fa ? 'زمان رأی‌گیری' : 'Voting timer'}/>
      </label>
    </div>
    <fieldset className="mafia-role-settings"><legend>{fa ? 'نقش‌های ویژه' : 'Special roles'}</legend>
      <label><input type="checkbox" checked={doctorEnabled} onChange={(event) => setDoctorEnabled(event.target.checked)}/><span>{fa ? 'دکتر' : 'Doctor'}</span></label>
      <label><input type="checkbox" checked={detectiveEnabled} onChange={(event) => setDetectiveEnabled(event.target.checked)}/><span>{fa ? 'کارآگاه' : 'Detective'}</span></label>
    </fieldset>
    <label className="mafia-role-settings mafia-reveal-toggle"><input type="checkbox" checked={revealOnDeath} onChange={(event) => setRevealOnDeath(event.target.checked)}/><span>{fa ? 'نمایش نقش بازیکن پس از حذف' : 'Reveal a player’s role upon elimination'}</span></label>
    <button className="primary-button mafia-create-button" disabled={pending} onClick={create}><Play size={17}/>{pending ? (fa ? 'در حال ساخت…' : 'Creating…') : (fa ? 'ساخت لابی و دعوت دوستان' : 'Create lobby and invite friends')}</button>
    {error && <p className="form-error">{error}</p>}
    <p className="mafia-setup-note"><ShieldAlert size={15}/>{fa ? 'مافیا، گادفادر، دکتر و کارآگاه را سرور مخفیانه تقسیم می‌کند؛ بازیکنان حذف‌شده فقط تماشاگرند.' : 'The server privately assigns roles; eliminated players are spectators only.'}</p>
  </section>
}
export default function OnlineMafiaRoom({ room, currentUserId, pending, error, onStart, onBack, onRefresh, onInviteFriends }: { room: LoadedRoom; currentUserId: string | null; pending: boolean; error: string; onStart: () => void; onBack: () => void; onRefresh: () => Promise<unknown>; onInviteFriends: () => void }) {
  const [inviteState, setInviteState] = useState<'idle' | 'copied'>('idle')
  const isHost = room.room.host_id === currentUserId
  const seats = Array.from({ length: room.room.capacity }, (_, index) => room.members.find((member) => member.seatNo === index + 1) || null)
  const joined = room.members.filter((member) => member.role === 'host' || member.role === 'player').length
  const remaining = Math.max(0, room.room.capacity - joined)
  const allReady = joined === room.room.capacity && room.members.filter((member) => member.role === 'host' || member.role === 'player').every((member) => member.ready)
  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(room.room.invite_code); setInviteState('copied') }
    catch { window.prompt('کد پشتیبان اتاق:', room.room.invite_code); setInviteState('copied') }
  }

  return <section className="mafia-room"><button className="mafia-room-back" onClick={onBack}><ArrowLeft size={16}/>بازگشت به بازی‌ها</button><div className="mafia-room-top"><div><span className="eyebrow">لابی مافیا · {room.room.capacity} نفره</span><h2>{room.room.name}</h2><p>{joined} از {room.room.capacity} بازیکن وارد شده‌اند. {remaining ? `${remaining} صندلی دیگر برای شروع لازم است.` : allReady ? 'همه آماده‌اند؛ وقت تقسیم نقش‌هاست.' : 'منتظر آماده‌شدن بازیکن‌ها هستیم.'}</p></div><div className="mafia-invite-actions"><button className="primary-button mafia-share-button" onClick={onInviteFriends}><UserPlus size={17}/>دعوت دوستان</button><button className="secondary-button" onClick={() => void copyInvite()}><Copy size={17}/>{inviteState === 'copied' ? 'کپی شد' : 'کد پشتیبان'}</button></div></div><div className="mafia-invite-link" dir="ltr"><Copy size={15}/><span>{room.room.invite_code}</span><small>کد جایگزین در صورت نیاز</small></div><div className="mafia-lobby-steps"><article className="is-done"><span><Check size={14}/></span><div><strong>اتاق آماده است</strong><small>برای بازیکن‌ها اعلان دعوت ارسال کن.</small></div></article><article className={remaining ? '' : 'is-done'}><span>{remaining || <Check size={14}/>}</span><div><strong>{remaining ? `${remaining} نفر دیگر را دعوت کن` : 'تیم کامل شد'}</strong><small>{remaining ? 'دوستان از اعلان‌های داخل سایت وارد لابی می‌شوند؛ کد کوتاه فقط راه جایگزین است.' : allReady ? 'همه آماده‌اند؛ میزبان می‌تواند نقش‌ها را تقسیم کند.' : 'همه باید آماده شوند.'}</small></div></article><article><span>۳</span><div><strong>شروع روایت</strong><small>پس از تقسیم نقش‌ها، سایت روند شب و روز را مدیریت می‌کند.</small></div></article></div><div className="mafia-seats">{seats.map((member, index) => member ? <article className="mafia-seat filled" key={member.userId}><PlayerAvatar seed={member.avatarSeed} label={member.displayName}/><div><strong>{member.displayName}</strong><small>{member.userId === room.room.host_id ? 'میزبان' : 'بازیکن'}</small></div>{member.userId === room.room.host_id && <Crown size={16}/>}</article> : <article className="mafia-seat" key={index}><span className="mafia-empty-seat">{index + 1}</span><div><strong>صندلی خالی</strong><small>دعوت را برای یک دوست بفرست</small></div></article>)}</div><RoomLobbyPanel room={room} currentUserId={currentUserId} onRefresh={onRefresh}/>{error && <p className="form-error">{error}</p>}<div className="mafia-room-footer">{isHost ? <button className="primary-button" disabled={pending || !allReady} onClick={onStart}><Play size={17}/>تقسیم نقش‌ها و شروع بازی</button> : <p>میزبان پس از تکمیل اتاق و آماده‌شدن همه، کارت نقش‌ها را تقسیم می‌کند.</p>}<span className={allReady ? 'mafia-ready-count is-ready' : 'mafia-ready-count'}>{joined}/{room.room.capacity} · {room.members.filter((member) => member.ready).length} آماده</span></div></section>
}
