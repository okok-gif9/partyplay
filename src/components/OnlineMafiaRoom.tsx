import { useState } from 'react'
import { ArrowLeft, Check, Crown, Link2, Play, Share2, ShieldAlert, Users } from 'lucide-react'
import type { LoadedRoom } from '../lib/partyplay'
import { PlayerAvatar } from './SocialIdentity'

export function MafiaRoomSetup({ onCreate, pending, error }: { onCreate: (capacity: number) => void; pending: boolean; error: string }) {
  return <section className="mafia-setup"><div className="mafia-setup-hero"><span className="mafia-sigil">M</span><div><span className="eyebrow">اتاق خصوصی مافیا</span><h2>شهر را جمع کن</h2><p>فقط با ظرفیت کامل ۵، ۷ یا ۹ نفر شروع می‌شود؛ نقش‌ها را خود سایت مخفیانه تقسیم می‌کند.</p></div></div><div className="mafia-capacity-grid">{[5, 7, 9].map((capacity) => <button key={capacity} className="mafia-capacity-card" disabled={pending} onClick={() => onCreate(capacity)}><Users size={23}/><strong>{capacity} نفره</strong><small>{capacity === 5 ? 'شروع سریع' : capacity === 7 ? 'تعادل کلاسیک' : 'شهر بزرگ'}</small></button>)}</div>{error && <p className="form-error">{error}</p>}<p className="mafia-setup-note"><ShieldAlert size={15}/> نقش‌ها تا پایان بازی محرمانه‌اند؛ حتی بعد از خروج بازیکن.</p></section>
}

export default function OnlineMafiaRoom({ room, currentUserId, pending, error, onStart, onBack }: { room: LoadedRoom; currentUserId: string | null; pending: boolean; error: string; onStart: () => void; onBack: () => void }) {
  const [inviteState, setInviteState] = useState<'idle' | 'copied' | 'shared'>('idle')
  const isHost = room.room.host_id === currentUserId
  const seats = Array.from({ length: room.room.capacity }, (_, index) => room.members.find((member) => member.seatNo === index + 1) || null)
  const joined = room.members.filter((member) => member.role === 'host' || member.role === 'player').length
  const remaining = Math.max(0, room.room.capacity - joined)
  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${room.room.invite_code}`
  const inviteText = `به اتاق «${room.room.name}» در پارتی پلی بیا. ${joined}/${room.room.capacity} صندلی پر شده.`
  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(inviteUrl); setInviteState('copied') }
    catch { window.prompt('این لینک را برای دوستانت بفرست:', inviteUrl); setInviteState('copied') }
  }
  const shareInvite = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'دعوت به مافیا در پارتی پلی', text: inviteText, url: inviteUrl }); setInviteState('shared'); return }
      catch (cause) { if ((cause as DOMException).name === 'AbortError') return }
    }
    await copyInvite()
  }

  return <section className="mafia-room"><button className="mafia-room-back" onClick={onBack}><ArrowLeft size={16}/>بازگشت به بازی‌ها</button><div className="mafia-room-top"><div><span className="eyebrow">لابی مافیا · {room.room.capacity} نفره</span><h2>{room.room.name}</h2><p>{joined} از {room.room.capacity} بازیکن وارد شده‌اند. {remaining ? `${remaining} صندلی دیگر برای شروع لازم است.` : 'تیم کامل است؛ وقت تقسیم نقش‌هاست.'}</p></div><div className="mafia-invite-actions"><button className="secondary-button" onClick={() => void copyInvite()}><Link2 size={17}/>{inviteState === 'copied' ? 'کپی شد' : 'کپی لینک'}</button><button className="primary-button mafia-share-button" onClick={() => void shareInvite()}><Share2 size={17}/>{inviteState === 'shared' ? 'ارسال شد' : 'دعوت دوستان'}</button></div></div><div className="mafia-invite-link" dir="ltr"><Link2 size={15}/><span>{inviteUrl}</span></div><div className="mafia-lobby-steps"><article className="is-done"><span><Check size={14}/></span><div><strong>اتاق آماده است</strong><small>لینک اختصاصی همین اتاق ساخته شد.</small></div></article><article className={remaining ? '' : 'is-done'}><span>{remaining || <Check size={14}/>}</span><div><strong>{remaining ? `${remaining} نفر دیگر را دعوت کن` : 'تیم کامل شد'}</strong><small>{remaining ? 'هر بازیکن با لینک، مستقیم وارد لابی می‌شود.' : 'فقط میزبان می‌تواند تقسیم نقش‌ها را شروع کند.'}</small></div></article><article><span>۳</span><div><strong>شروع روایت</strong><small>پس از تقسیم نقش‌ها، سایت روند شب و روز را مدیریت می‌کند.</small></div></article></div><div className="mafia-seats">{seats.map((member, index) => member ? <article className="mafia-seat filled" key={member.userId}><PlayerAvatar seed={member.avatarSeed} label={member.displayName}/><div><strong>{member.displayName}</strong><small>{member.userId === room.room.host_id ? 'میزبان' : 'بازیکن'}</small></div>{member.userId === room.room.host_id && <Crown size={16}/>}</article> : <article className="mafia-seat" key={index}><span className="mafia-empty-seat">{index + 1}</span><div><strong>صندلی خالی</strong><small>دعوت را برای یک دوست بفرست</small></div></article>)}</div>{error && <p className="form-error">{error}</p>}<div className="mafia-room-footer">{isHost ? <button className="primary-button" disabled={pending || joined !== room.room.capacity} onClick={onStart}><Play size={17}/>تقسیم نقش‌ها و شروع بازی</button> : <p>میزبان پس از تکمیل اتاق، کارت نقش‌ها را تقسیم می‌کند.</p>}<span className={joined === room.room.capacity ? 'mafia-ready-count is-ready' : 'mafia-ready-count'}>{joined}/{room.room.capacity}</span></div></section>
}
