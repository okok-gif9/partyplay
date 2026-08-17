import { Check, Clock3, Crown, MessageCircle, Send, Sparkles, Trophy, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { dareCards, truthCards } from '../data/truthDareCards'
import type { LoadedRoom, PartyPlayRoomMessage, PartyPlaySession, TruthDareReaction, TruthDareState } from '../lib/partyplay'
import { PlayerAvatar } from './SocialIdentity'

const reactions: TruthDareReaction[] = ['😂', '🔥', '👏', '😮']

const formatClock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

function remainingSeconds(closesAt: string | null) {
  if (!closesAt) return 0
  return Math.max(0, Math.ceil((new Date(closesAt).getTime() - Date.now()) / 1000))
}

type OnlineTruthDareProps = {
  room: LoadedRoom
  session: PartyPlaySession
  messages: PartyPlayRoomMessage[]
  currentUserId: string
  pending: boolean
  onChoose: (choice: 'truth' | 'dare') => void
  onNextTurn: () => void
  onFinish: () => void
  onSendMessage: (body: string) => void
  onToggleReaction: (messageId: number, reaction: TruthDareReaction) => void
}

export default function OnlineTruthDare({ room, session, messages, currentUserId, pending, onChoose, onNextTurn, onFinish, onSendMessage, onToggleReaction }: OnlineTruthDareProps) {
  const [draft, setDraft] = useState('')
  const state = session.state as TruthDareState
  const activePlayer = room.members.find((member) => member.userId === session.turn_user_id)
  const isMyTurn = session.status === 'running' && session.turn_user_id === currentUserId
  const isHost = room.room.host_id === currentUserId
  const selected = state.selected
  const card = selected ? (selected.choice === 'truth' ? truthCards : dareCards)[selected.card_index] : null
  const hasUsedMessage = messages.some((message) => message.sender.userId === currentUserId && message.roundNo === session.round_no)
  const [secondsLeft, setSecondsLeft] = useState(() => remainingSeconds(state.chat_closes_at))

  useEffect(() => {
    const update = () => setSecondsLeft(remainingSeconds(state.chat_closes_at))
    update()
    if (session.status !== 'finished' || !state.chat_closes_at) return
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [session.status, state.chat_closes_at])

  const chatOpen = session.status === 'running' || (session.status === 'finished' && secondsLeft > 0)
  const canSend = chatOpen && !pending && (session.status !== 'running' || !hasUsedMessage)
  const playerLabel = activePlayer?.displayName || 'بازیکن'
  const selectedPlayer = selected ? room.members.find((member) => member.userId === selected.player_id) : activePlayer
  const groupedReactionCount = useMemo(() => (message: PartyPlayRoomMessage, reaction: TruthDareReaction) => message.reactions.filter((item) => item.reaction === reaction).length, [])

  const submitMessage = () => {
    const body = draft.trim()
    if (!body || !canSend) return
    onSendMessage(body)
    setDraft('')
  }

  return <section className="online-truth-stage">
    <div className="truth-round-head">
      <div><span className="eyebrow"><Sparkles size={15}/> دور {session.round_no}</span><h2>{session.status === 'finished' ? 'بازی تمام شد' : `قرعه به نام ${playerLabel} افتاد`}</h2><p>{session.status === 'finished' ? (secondsLeft ? `چت تا ${formatClock(secondsLeft)} دیگر باز است.` : 'زمان گفت‌وگو تمام شد.') : state.phase === 'choosing' ? 'فقط بازیکن انتخاب‌شده می‌تواند جرئت یا حقیقت را انتخاب کند.' : `${selectedPlayer?.displayName || 'بازیکن'} کارت این دور را باز کرده است.`}</p></div>
      <div className="truth-round-status"><span className="pulse-dot"/><b>{session.status === 'running' ? state.phase === 'choosing' ? 'در انتظار انتخاب' : 'کارت نمایش داده شد' : 'پایان بازی'}</b>{session.status === 'finished' && <span><Clock3 size={14}/>{formatClock(secondsLeft)}</span>}</div>
    </div>

    <div className="truth-player-strip" aria-label="بازیکنان اتاق">
      {room.members.map((member, index) => <article className={`truth-player-token ${member.userId === session.turn_user_id && session.status === 'running' ? 'turn-picked' : ''}`} key={member.userId} style={{ '--token-delay': `${index * 70}ms` } as React.CSSProperties}><PlayerAvatar seed={member.avatarSeed} label={member.displayName} size="sm" status={member.userId === session.turn_user_id ? 'online' : undefined}/><div><b>{member.displayName}{member.userId === currentUserId ? ' (تو)' : ''}</b><small>{member.userId === session.turn_user_id && session.status === 'running' ? 'نوبت اوست' : member.role === 'host' ? 'میزبان' : 'بازیکن'}</small></div>{member.role === 'host' && <Crown size={14}/>}</article>)}
    </div>

    <div className="truth-online-layout">
      <main className="panel truth-game-board">
        {session.status === 'running' && state.phase === 'choosing' && <div className="truth-choice-stage">
          <div className="truth-lottery" aria-hidden="true">{room.members.map((member, index) => <span key={member.userId} className={member.userId === session.turn_user_id ? 'lottery-winner' : ''} style={{ '--lottery-delay': `${index * 80}ms` } as React.CSSProperties}><PlayerAvatar seed={member.avatarSeed} label={member.displayName} size="sm"/></span>)}</div>
          <span className="preview-symbol"><Sparkles size={48}/></span><span className="pill">نوبت {playerLabel}</span><h3>{isMyTurn ? 'جرئت یا حقیقت؟' : `منتظر انتخابِ ${playerLabel} بمانید`}</h3><p>{isMyTurn ? 'انتخابت برای همهٔ اعضای اتاق نمایش داده می‌شود.' : 'چت این دور باز است؛ تو هم فقط یک پیام می‌توانی بفرستی.'}</p>
          <div className="truth-choice-actions"><button className="secondary-button" disabled={!isMyTurn || pending} onClick={() => onChoose('truth')}>حقیقت</button><button className="primary-button" disabled={!isMyTurn || pending} onClick={() => onChoose('dare')}>جرئت</button></div>
        </div>}

        {session.status === 'running' && state.phase === 'revealed' && card && <div className="truth-revealed-stage">
          <div className="truth-card-meta"><span className="pill">کارت {selected?.choice === 'truth' ? 'حقیقت' : 'جرئت'}</span><span className={`difficulty-chip ${card.level === 'چالشی و جسورانه' ? 'difficulty-bold' : ''}`}>{card.level}</span></div>
          <div className="truth-card-motion" key={`${selected?.choice}-${selected?.card_index}-${session.round_no}`}><h3>«{card.text}»</h3><p>این کارت برای {selectedPlayer?.displayName || 'بازیکن نوبت‌دار'} است؛ وقتی آماده بود، نوبت را به نفر بعد بده.</p></div>
          {isMyTurn ? <button className="primary-button" disabled={pending} onClick={onNextTurn}><Check size={17}/>پایان نوبت و قرعهٔ بعدی</button> : <span className="waiting-next-turn">منتظر بمان تا {playerLabel} نوبت را تمام کند.</span>}
        </div>}

        {session.status === 'finished' && <div className="truth-finished-stage"><span className="preview-symbol"><Trophy size={46}/></span><h3>دورهمی تموم شد</h3><p>{secondsLeft ? `برای حرف آخر، چت تا ${formatClock(secondsLeft)} دیگر باز می‌ماند.` : 'چت بسته شد؛ برای یک دور تازه، اتاق جدید بسازید.'}</p></div>}

        {isHost && session.status === 'running' && <button className="text-button truth-finish-button" disabled={pending} onClick={onFinish}>پایان بازی برای همه</button>}
      </main>

      <aside className="panel truth-chat-panel">
        <div className="truth-chat-heading"><div><span className="eyebrow"><MessageCircle size={15}/> چت دور</span><h3>هم‌صحبتی کوتاه</h3></div>{session.status === 'running' ? <span className={`chat-quota ${hasUsedMessage ? 'quota-spent' : ''}`}>{hasUsedMessage ? 'پیامت ارسال شد' : '۱ پیام داری'}</span> : <span className={`chat-quota ${chatOpen ? '' : 'quota-spent'}`}>{chatOpen ? `${formatClock(secondsLeft)} باز` : 'بسته شد'}</span>}</div>
        <div className="truth-message-list" aria-live="polite">{messages.length ? messages.map((message) => <article className={`truth-message ${message.sender.userId === currentUserId ? 'my-message' : ''}`} key={message.id}><div className="truth-message-author"><PlayerAvatar seed={message.sender.avatarSeed} label={message.sender.displayName} size="sm"/><b>{message.sender.displayName}</b><small>{message.roundNo ? `دور ${message.roundNo}` : ''}</small></div><p>{message.body}</p><div className="message-reactions">{reactions.map((reaction) => { const active = message.reactions.find((item) => item.userId === currentUserId)?.reaction === reaction; const count = groupedReactionCount(message, reaction); return <button key={reaction} className={active ? 'reaction-active' : ''} onClick={() => onToggleReaction(message.id, reaction)} disabled={pending || !chatOpen} aria-label={`واکنش ${reaction}`}><span>{reaction}</span>{count > 0 && <small>{count}</small>}</button> })}</div></article>) : <div className="truth-chat-empty"><Users size={26}/><p>اولین پیام این دور را بفرست.</p></div>}</div>
        <div className="truth-chat-compose"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitMessage() } }} placeholder={chatOpen ? hasUsedMessage && session.status === 'running' ? 'سهمیهٔ پیام این دور را استفاده کردی' : 'یک پیام کوتاه برای این دور…' : 'چت بسته شده است'} maxLength={600} disabled={!canSend}/><button className="primary-button" onClick={submitMessage} disabled={!draft.trim() || !canSend}><Send size={17}/></button></div>
      </aside>
    </div>
  </section>
}
