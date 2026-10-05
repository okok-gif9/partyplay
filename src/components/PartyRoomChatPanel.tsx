import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { useLanguage } from '../i18n'
import { loadPartyChat, sendPartyChat, type PartyChatMessage } from '../lib/partyplay'
import { supabase } from '../lib/supabase'

export default function PartyRoomChatPanel({ roomId, currentUserId }: { roomId: string; currentUserId: string | null }) {
  const { language } = useLanguage()
  const fa = language === 'fa'
  const [messages, setMessages] = useState<PartyChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    try { setMessages(await loadPartyChat(roomId)); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : (fa ? 'گفت‌وگو بارگذاری نشد.' : 'Could not load party chat.')) }
  }, [fa, roomId])

  useEffect(() => {
    let active = true
    void refresh()
    const client = supabase
    if (!client) return () => { active = false }
    const channel = client.channel(`partyplay-game-chat-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pp_party_messages', filter: `room_id=eq.${roomId}` }, () => { void refresh() })
      .subscribe((status) => {
        if (!active) return
        const isConnected = status === 'SUBSCRIBED'
        setConnected(isConnected)
        if (isConnected) void refresh()
      })
    return () => { active = false; void client.removeChannel(channel) }
  }, [refresh, roomId])

  const send = async (event: FormEvent) => {
    event.preventDefault()
    const body = draft.trim()
    if (!body || sending) return
    setSending(true); setError('')
    try { await sendPartyChat(roomId, body); setDraft(''); await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : (fa ? 'پیام ارسال نشد.' : 'Message was not sent.')) }
    finally { setSending(false) }
  }

  return <section className="panel game-party-chat">
    <div className="panel-heading"><div><span className="eyebrow"><MessageCircle size={14}/>{fa ? 'گفت‌وگوی تیم' : 'PARTY CHAT'}</span><h2>{fa ? 'پیام‌های داخل بازی' : 'In-game chat'}</h2></div><span className={`lobby-connection ${connected ? 'is-connected' : ''}`}><i/>{connected ? (fa ? 'زنده' : 'Live') : (fa ? 'در حال اتصال' : 'Reconnecting')}</span></div>
    <div className="lobby-chat-log game-party-chat-log" aria-live="polite">{messages.length ? messages.map((message) => <article className={`lobby-chat-message ${message.senderId === currentUserId ? 'is-own-message' : ''}`} key={message.id}><strong>{message.senderId === currentUserId ? (fa ? 'تو' : 'You') : message.senderName}</strong><p>{message.body}</p></article>) : <p className="lobby-chat-empty">{fa ? 'هنوز پیامی نیست؛ بازی را هماهنگ کن.' : 'No messages yet. Coordinate your game here.'}</p>}</div>
    <form className="lobby-chat-compose" onSubmit={(event) => void send(event)}><input value={draft} onChange={(event) => setDraft(event.target.value.slice(0, 500))} maxLength={500} placeholder={fa ? 'پیام گروه…' : 'Message your party…'} aria-label={fa ? 'پیام گروه' : 'Party message'} disabled={sending}/><button type="submit" disabled={sending || !draft.trim()} aria-label={fa ? 'ارسال پیام' : 'Send message'}><Send size={16}/></button></form>
    {!connected && <button type="button" className="lobby-retry-button" onClick={() => void refresh()}>{fa ? 'تلاش دوباره' : 'Retry'}</button>}{error && <p className="form-error">{error}</p>}
  </section>
}
