import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { LoaderCircle, MessageCircle, Send, X } from 'lucide-react'
import { useLanguage } from '../i18n'
import { loadFriendMessages, markFriendMessagesRead, openFriendThread, sendFriendMessage, type FriendPrivateMessage } from '../lib/partyplay'
import type { SocialProfile } from '../hooks/usePartyPlayData'
import { supabase } from '../lib/supabase'
import { PlayerAvatar } from './SocialIdentity'

export default function FriendChatDialog({ friend, currentUserId, onClose }: { friend: SocialProfile; currentUserId: string | null; onClose: () => void }) {
  const { language } = useLanguage()
  const fa = language === 'fa'
  const [threadId, setThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<FriendPrivateMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async (id: string) => {
    const rows = await loadFriendMessages(id)
    setMessages(rows)
    await markFriendMessagesRead(id)
    setError('')
  }, [])

  useEffect(() => {
    let active = true
    let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null
    const client = supabase
    const start = async () => {
      try {
        const thread = await openFriendThread(friend.id)
        if (!active) return
        setThreadId(thread.id)
        await refresh(thread.id)
        if (!active) return
        setLoading(false)
        if (!client) return
        channel = client.channel(`partyplay-friend-chat-${thread.id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'pp_friend_messages', filter: `thread_id=eq.${thread.id}` }, () => { void refresh(thread.id).catch((cause) => setError(cause instanceof Error ? cause.message : 'Chat refresh failed.')) })
          .subscribe((status) => {
            if (!active) return
            const isConnected = status === 'SUBSCRIBED'
            setConnected(isConnected)
            if (isConnected) void refresh(thread.id).catch((cause) => setError(cause instanceof Error ? cause.message : 'Chat refresh failed.'))
          })
      } catch (cause) {
        if (active) { setLoading(false); setError(cause instanceof Error ? cause.message : (fa ? 'گفت‌وگوی خصوصی بارگذاری نشد.' : 'Could not open private chat.')) }
      }
    }
    void start()
    return () => { active = false; if (channel && client) void client.removeChannel(channel) }
  }, [fa, friend.id, refresh])

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [messages])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const send = async (event: FormEvent) => {
    event.preventDefault()
    const body = draft.trim()
    if (!body || !threadId || sending) return
    setSending(true); setError('')
    try { await sendFriendMessage(threadId, body); setDraft(''); await refresh(threadId) }
    catch (cause) { setError(cause instanceof Error ? cause.message : (fa ? 'پیام ارسال نشد.' : 'Message was not sent.')) }
    finally { setSending(false) }
  }

  return <div className="friend-chat-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="friend-chat-dialog" role="dialog" aria-modal="true" aria-label={fa ? `گفت‌وگوی خصوصی با ${friend.displayName}` : `Private chat with ${friend.displayName}`}>
      <header className="friend-chat-header"><PlayerAvatar seed={friend.avatarSeed} assetPath={friend.avatarAssetPath} label={friend.displayName} status={friend.presence} size="sm"/><div><strong>{friend.displayName}</strong><span>{fa ? 'پیام خصوصی فقط برای شما دو نفر' : 'Private messages between you two'}</span></div><span className={`lobby-connection ${connected ? 'is-connected' : ''}`}><i/>{connected ? (fa ? 'زنده' : 'Live') : (fa ? 'در حال اتصال' : 'Connecting')}</span><button className="icon-action" onClick={onClose} aria-label={fa ? 'بستن' : 'Close'}><X size={18}/></button></header>
      <div className="friend-chat-log" ref={logRef} aria-live="polite">{loading ? <p className="chat-loading"><LoaderCircle size={18}/>{fa ? 'در حال بارگذاری…' : 'Loading messages…'}</p> : messages.length ? messages.map((message) => <article className={`friend-chat-bubble ${message.senderId === currentUserId ? 'is-mine' : ''}`} key={message.id}><strong>{message.senderId === currentUserId ? (fa ? 'تو' : 'You') : friend.displayName}</strong><p>{message.body}</p><time>{new Date(message.createdAt).toLocaleTimeString(fa ? 'fa-IR' : 'en', { hour: '2-digit', minute: '2-digit' })}</time></article>) : <div className="friend-chat-empty"><MessageCircle size={25}/><span>{fa ? 'گفت‌وگو را با یک سلام شروع کن.' : 'Start the conversation with a hello.'}</span></div>}</div>
      <form className="friend-chat-compose" onSubmit={(event) => void send(event)}><input value={draft} onChange={(event) => setDraft(event.target.value.slice(0, 800))} maxLength={800} placeholder={fa ? 'پیام خصوصی…' : 'Write a private message…'} aria-label={fa ? 'پیام خصوصی' : 'Private message'} disabled={sending || loading || !threadId}/><button className="primary-button" type="submit" disabled={sending || loading || !threadId || !draft.trim()} aria-label={fa ? 'ارسال پیام' : 'Send message'}><Send size={16}/></button></form>
      {error && <p className="form-error friend-chat-error">{error}</p>}
    </section>
  </div>
}
