import { useCallback, useEffect, useState } from 'react'
import { Check, MessageCircle, RotateCcw, Send, UserRoundX } from 'lucide-react'
import { useLanguage } from '../i18n'
import { kickLobbyMember, loadLobbyMessages, sendLobbyMessage, setLobbyReady, type LobbyChatMessage, type LoadedRoom } from '../lib/partyplay'
import { supabase } from '../lib/supabase'

export default function RoomLobbyPanel({ room, currentUserId, onRefresh }: { room: LoadedRoom; currentUserId: string | null; onRefresh: () => Promise<unknown> }) {
  const { language } = useLanguage()
  const fa = language === 'fa'
  const roomId = room.room.id
  const isHost = room.room.host_id === currentUserId
  const me = room.members.find((member) => member.userId === currentUserId)
  const [messages, setMessages] = useState<LobbyChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(false)

  const refreshMessages = useCallback(async () => {
    try { setMessages(await loadLobbyMessages(roomId)); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : (fa ? 'گفت‌وگو بارگذاری نشد.' : 'Could not load lobby chat.')) }
  }, [fa, roomId])

  useEffect(() => {
    let active = true
    void refreshMessages()
    if (!supabase) return () => { active = false }
    const client = supabase
    const channel = client.channel(`partyplay-lobby-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pp_lobby_messages', filter: `room_id=eq.${roomId}` }, () => { void refreshMessages() })
      .subscribe((status) => {
        if (!active) return
        const isConnected = status === 'SUBSCRIBED'
        setConnected(isConnected)
        if (isConnected) void refreshMessages()
      })
    return () => { active = false; void client.removeChannel(channel) }
  }, [refreshMessages, roomId])

  const toggleReady = async () => {
    if (!me) return
    setBusy(true); setError('')
    try { await setLobbyReady(roomId, !me.ready); await onRefresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : (fa ? 'آماده‌بودن ذخیره نشد.' : 'Could not update ready state.')) }
    finally { setBusy(false) }
  }
  const send = async (event: React.FormEvent) => {
    event.preventDefault()
    const body = draft.trim()
    if (!body || busy) return
    setBusy(true); setError('')
    try { await sendLobbyMessage(roomId, body); setDraft(''); await refreshMessages() }
    catch (cause) { setError(cause instanceof Error ? cause.message : (fa ? 'پیام ارسال نشد.' : 'Message was not sent.')) }
    finally { setBusy(false) }
  }
  const kick = async (userId: string) => {
    setBusy(true); setError('')
    try { await kickLobbyMember(roomId, userId); await onRefresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : (fa ? 'بازیکن حذف نشد.' : 'Could not remove player.')) }
    finally { setBusy(false) }
  }

  return <section className="panel room-lobby-social">
    <div className="panel-heading"><div><span className="eyebrow"><MessageCircle size={14}/> {fa ? 'لابی زنده' : 'Live lobby'}</span><h2>{fa ? 'گفت‌وگو و آمادگی' : 'Chat & readiness'}</h2></div><span className={`lobby-connection ${connected ? 'is-connected' : ''}`}><i/>{connected ? (fa ? 'متصل' : 'Live') : (fa ? 'در حال اتصال دوباره' : 'Reconnecting')}</span></div>
    <div className="lobby-ready-list">{room.members.filter((member) => member.role === 'host' || member.role === 'player').map((member) => <div className="lobby-ready-member" key={member.userId}><span className={`lobby-ready-dot ${member.ready ? 'is-ready' : ''}`}/><span>{member.displayName}{member.userId === currentUserId ? (fa ? ' (تو)' : ' (you)') : ''}</span><small>{member.ready ? (fa ? 'آماده' : 'Ready') : (fa ? 'در انتظار' : 'Waiting')}</small>{isHost && member.userId !== room.room.host_id && <button type="button" title={fa ? 'حذف بازیکن' : 'Kick player'} aria-label={fa ? `حذف ${member.displayName}` : `Kick ${member.displayName}`} disabled={busy} onClick={() => void kick(member.userId)}><UserRoundX size={15}/></button>}</div>)}</div>
    {me && <button type="button" className={`secondary-button lobby-ready-toggle ${me.ready ? 'is-ready' : ''}`} disabled={busy} onClick={() => void toggleReady()}>{me.ready ? <Check size={16}/> : <RotateCcw size={16}/>} {me.ready ? (fa ? 'آماده‌ام' : 'Ready') : (fa ? 'آماده‌ام' : 'Mark ready')}</button>}
    <div className="lobby-chat-log" aria-live="polite">{messages.length ? messages.map((message) => <article className="lobby-chat-message" key={message.id}><strong>{message.senderId === currentUserId ? (fa ? 'تو' : 'You') : message.senderName}</strong><p>{message.body}</p></article>) : <p className="lobby-chat-empty">{fa ? 'هنوز پیامی نیست؛ به دوست‌ها سلام کن.' : 'No messages yet. Say hello while you wait.'}</p>}</div>
    <form className="lobby-chat-compose" onSubmit={(event) => void send(event)}><input value={draft} onChange={(event) => setDraft(event.target.value.slice(0, 500))} maxLength={500} placeholder={fa ? 'پیام لابی…' : 'Message the lobby…'} aria-label={fa ? 'پیام لابی' : 'Lobby message'} disabled={busy}/><button type="submit" disabled={busy || !draft.trim()} aria-label={fa ? 'ارسال پیام' : 'Send message'}><Send size={16}/></button></form>
    {!connected && <button type="button" className="lobby-retry-button" onClick={() => void refreshMessages()}><RotateCcw size={14}/>{fa ? 'تلاش دوباره برای اتصال' : 'Retry connection'}</button>}
    {error && <p className="form-error">{error}</p>}
  </section>
}
