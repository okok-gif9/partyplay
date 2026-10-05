import { Check, Clock3, Crown, MessageCircle, Send, Sparkles, Trophy, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { LoadedRoom, PartyPlayRoomMessage, PartyPlaySession, TruthDareReaction, TruthDareScoreboardEntry, TruthDareState } from '../lib/partyplay'
import { PlayerAvatar } from './SocialIdentity'
import { useLanguage } from '../i18n'

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
  scoreboard: TruthDareScoreboardEntry[]
  currentUserId: string
  pending: boolean
  onChoose: (choice: 'truth' | 'dare') => void
  onNextTurn: () => void
  onPass: () => void
  onRate: (roundNo: number, score: number) => void
  onFinish: () => void
  onSendMessage: (body: string) => void
  onToggleReaction: (messageId: number, reaction: TruthDareReaction) => void
}

export default function OnlineTruthDare({ room, session, messages, scoreboard, currentUserId, pending, onChoose, onNextTurn, onPass, onRate, onFinish, onSendMessage, onToggleReaction }: OnlineTruthDareProps) {
  const { language } = useLanguage()
  const fa = language === 'fa'
  const [draft, setDraft] = useState('')
  const state = session.state as TruthDareState
  const activePlayer = room.members.find((member) => member.userId === session.turn_user_id)
  const isMyTurn = session.status === 'running' && session.turn_user_id === currentUserId
  const isHost = room.room.host_id === currentUserId
  const selected = state.selected
  const card = selected ? { text: fa ? selected.text_fa : selected.text_en, category: selected.category } : null
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
  const playerLabel = activePlayer?.displayName || (fa ? 'بازیکن' : 'Player')
  const selectedPlayer = selected ? room.members.find((member) => member.userId === selected.player_id) : activePlayer
  const passesUsed = state.passes_used?.[currentUserId] || 0
  const categoryLabel = (category?: string) => ({ fun: fa ? 'سرگرمی' : 'Fun', friends: fa ? 'دوستان' : 'Friends', extreme: fa ? 'چالشی' : 'Extreme', spicy: fa ? 'اسپایسی' : 'Spicy' }[category || 'fun'])
  const groupedReactionCount = useMemo(() => (message: PartyPlayRoomMessage, reaction: TruthDareReaction) => message.reactions.filter((item) => item.reaction === reaction).length, [])

  const submitMessage = () => {
    const body = draft.trim()
    if (!body || !canSend) return
    onSendMessage(body)
    setDraft('')
  }

  return <section className="online-truth-stage">
    <div className="truth-round-head">
      <div><span className="eyebrow"><Sparkles size={15}/>{fa ? `دور ${session.round_no}` : `Round ${session.round_no}`}</span><h2>{session.status === 'finished' ? (fa ? 'بازی تمام شد' : 'Game finished') : (fa ? `قرعه به نام ${playerLabel} افتاد` : `${playerLabel} was picked`)}</h2><p>{session.status === 'finished' ? (secondsLeft ? `چت تا ${formatClock(secondsLeft)} دیگر باز است.` : 'زمان گفت‌وگو تمام شد.') : state.phase === 'choosing' ? 'فقط بازیکن انتخاب‌شده می‌تواند جرئت یا حقیقت را انتخاب کند.' : `${selectedPlayer?.displayName || 'بازیکن'} کارت این دور را باز کرده است.`}</p></div>
      <div className="truth-round-status"><span className="pulse-dot"/><b>{session.status === 'running' ? state.phase === 'choosing' ? 'در انتظار انتخاب' : 'کارت نمایش داده شد' : 'پایان بازی'}</b>{session.status === 'finished' && <span><Clock3 size={14}/>{formatClock(secondsLeft)}</span>}</div>
    </div>

    <div className="truth-player-strip" aria-label={fa ? 'بازیکنان اتاق' : 'Room players'}>
      {room.members.map((member, index) => <article className={`truth-player-token ${member.userId === session.turn_user_id && session.status === 'running' ? 'turn-picked' : ''}`} key={member.userId} style={{ '--token-delay': `${index * 70}ms` } as React.CSSProperties}><PlayerAvatar seed={member.avatarSeed} label={member.displayName} size="sm" status={member.userId === session.turn_user_id ? 'online' : undefined}/><div><b>{member.displayName}{member.userId === currentUserId ? (fa ? ' (تو)' : ' (you)') : ''}</b><small>{member.userId === session.turn_user_id && session.status === 'running' ? 'نوبت اوست' : member.role === 'host' ? 'میزبان' : 'بازیکن'}</small></div>{member.role === 'host' && <Crown size={14}/>}</article>)}
    </div>

    <div className="truth-online-layout">
      <main className="panel truth-game-board">
        {session.status === 'running' && state.phase === 'choosing' && <div className="truth-choice-stage">
          <div className="truth-lottery" aria-hidden="true">{room.members.map((member, index) => <span key={member.userId} className={member.userId === session.turn_user_id ? 'lottery-winner' : ''} style={{ '--lottery-delay': `${index * 80}ms` } as React.CSSProperties}><PlayerAvatar seed={member.avatarSeed} label={member.displayName} size="sm"/></span>)}</div>
          <span className="preview-symbol"><Sparkles size={48}/></span><span className="pill">نوبت {playerLabel}</span><h3>{isMyTurn ? 'جرئت یا حقیقت؟' : `منتظر انتخابِ ${playerLabel} بمانید`}</h3><p>{isMyTurn ? 'انتخابت برای همهٔ اعضای اتاق نمایش داده می‌شود.' : 'چت این دور باز است؛ تو هم فقط یک پیام می‌توانی بفرستی.'}</p>
          <div className="truth-choice-actions"><button className="secondary-button" disabled={!isMyTurn || pending} onClick={() => onChoose('truth')}>{fa ? 'حقیقت' : 'Truth'}</button><button className="primary-button" disabled={!isMyTurn || pending} onClick={() => onChoose('dare')}>{fa ? 'جرئت' : 'Dare'}</button></div>
        </div>}

        {session.status === 'running' && state.phase === 'revealed' && card && <div className="truth-revealed-stage">
          <div className="truth-card-meta"><span className="pill">{fa ? selected?.choice === 'truth' ? 'حقیقت' : 'جرئت' : selected?.choice === 'truth' ? 'Truth' : 'Dare'}</span><span className="difficulty-chip">{categoryLabel(card.category)}</span></div>
          <div className="truth-card-motion" key={`${selected?.choice}-${selected?.prompt_id}-${session.round_no}`}><h3>«{card.text || (fa ? 'پرسش در دسترس نیست' : 'Prompt unavailable')}»</h3><p>{fa ? `این کارت برای ${selectedPlayer?.displayName || 'بازیکن نوبت‌دار'} است؛ اگر خواستی می‌توانی یک‌بار در هر بازی رد کنی.` : `This prompt is for ${selectedPlayer?.displayName || 'the selected player'}; you may pass once per game.`}</p></div>
          {isMyTurn ? <div className="truth-turn-actions"><button className="primary-button" disabled={pending} onClick={onNextTurn}><Check size={17}/>{fa ? 'انجام شد؛ نفر بعد' : 'Done; next player'}</button>{passesUsed < 1 && <button className="secondary-button" disabled={pending} onClick={onPass}>{fa ? 'رد کردن (۱ بار)' : 'Pass (once)'}</button>}</div> : <><span className="waiting-next-turn">{fa ? `منتظر بمان تا ${playerLabel} نوبت را تمام کند.` : `Waiting for ${playerLabel} to finish.`}</span><div className="truth-rating-row"><span>{fa ? 'به نتیجه امتیاز بده' : 'Rate the result'}</span>{[1,2,3,4,5].map((score) => <button key={score} className="truth-rating-button" disabled={pending} onClick={() => onRate(session.round_no,score)} aria-label={`${score} / 5`}>{score}★</button>)}</div></>}
        </div>}

        {session.status === 'finished' && <div className="truth-finished-stage"><span className="preview-symbol"><Trophy size={46}/></span><h3>{fa ? 'دورهمی تموم شد' : 'The session is over'}</h3><p>{secondsLeft ? `برای حرف آخر، چت تا ${formatClock(secondsLeft)} دیگر باز می‌ماند.` : 'چت بسته شد؛ برای یک دور تازه، اتاق جدید بسازید.'}</p></div>}

        {isHost && session.status === 'running' && <button className="text-button truth-finish-button" disabled={pending} onClick={onFinish}>{fa ? 'پایان بازی برای همه' : 'End game for everyone'}</button>}
        <section className="truth-scoreboard"><div className="panel-heading"><div><span className="eyebrow"><Trophy size={14}/>{fa ? 'امتیازها' : 'Scoreboard'}</span><h3>{fa ? 'رتبهٔ این دورهمی' : 'Session standings'}</h3></div></div>{scoreboard.map((entry) => <div className="truth-score-row" key={entry.player_id}><b>{entry.display_name}</b><span>★ {Number(entry.average_rating).toFixed(1)} · {entry.rating_count} {fa ? 'رأی' : 'ratings'}</span><small>{fa ? `${entry.completed_turns} انجام‌شده · ${entry.passes_used} رد` : `${entry.completed_turns} done · ${entry.passes_used} passed`}</small></div>)}</section>
      </main>

      <aside className="panel truth-chat-panel">
        <div className="truth-chat-heading"><div><span className="eyebrow"><MessageCircle size={15}/>{fa ? 'چت دور' : 'ROUND CHAT'}</span><h3>{fa ? 'هم‌صحبتی کوتاه' : 'Quick chat'}</h3></div>{session.status === 'running' ? <span className={`chat-quota ${hasUsedMessage ? 'quota-spent' : ''}`}>{hasUsedMessage ? (fa ? 'پیامت ارسال شد' : 'Message sent') : (fa ? '۱ پیام داری' : '1 message') }</span> : <span className={`chat-quota ${chatOpen ? '' : 'quota-spent'}`}>{chatOpen ? (fa ? `${formatClock(secondsLeft)} باز` : `${formatClock(secondsLeft)} left`) : (fa ? 'بسته شد' : 'Closed') }</span>}</div>
        <div className="truth-message-list" aria-live="polite">{messages.length ? messages.map((message) => <article className={`truth-message ${message.sender.userId === currentUserId ? 'my-message' : ''}`} key={message.id}><div className="truth-message-author"><PlayerAvatar seed={message.sender.avatarSeed} label={message.sender.displayName} size="sm"/><b>{message.sender.displayName}</b><small>{message.roundNo ? `دور ${message.roundNo}` : ''}</small></div><p>{message.body}</p><div className="message-reactions">{reactions.map((reaction) => { const active = message.reactions.find((item) => item.userId === currentUserId)?.reaction === reaction; const count = groupedReactionCount(message, reaction); return <button key={reaction} className={active ? 'reaction-active' : ''} onClick={() => onToggleReaction(message.id, reaction)} disabled={pending || !chatOpen} aria-label={`واکنش ${reaction}`}><span>{reaction}</span>{count > 0 && <small>{count}</small>}</button> })}</div></article>) : <div className="truth-chat-empty"><Users size={26}/><p>اولین پیام این دور را بفرست.</p></div>}</div>
        <div className="truth-chat-compose"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitMessage() } }} placeholder={chatOpen ? hasUsedMessage && session.status === 'running' ? 'سهمیهٔ پیام این دور را استفاده کردی' : 'یک پیام کوتاه برای این دور…' : 'چت بسته شده است'} maxLength={600} disabled={!canSend}/><button className="primary-button" onClick={submitMessage} disabled={!draft.trim() || !canSend}><Send size={17}/></button></div>
      </aside>
    </div>
  </section>
}
