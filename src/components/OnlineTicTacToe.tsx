import { LoaderCircle, RotateCcw, Trophy, Wifi } from 'lucide-react'
import type { LoadedRoom, PartyPlaySession, TicTacToeMark } from '../lib/partyplay'

type OnlineTicTacToeProps = {
  room: LoadedRoom
  session: PartyPlaySession
  currentUserId: string
  pending: boolean
  onMove: (cell: number) => void
  onRematch: () => void
}

const displayMark = (value: TicTacToeMark | null) => value || ''

const playerLabel = (name: string) => name.trim().charAt(0) || 'پ'

const playerTone = (mark: TicTacToeMark) => mark === 'X' ? 'pink' : 'cyan'

export default function OnlineTicTacToe({ room, session, currentUserId, pending, onMove, onRematch }: OnlineTicTacToeProps) {
  const state = session.state
  const board = Array.isArray(state.board) ? state.board : Array(9).fill(null)
  const xUserId = state.marks?.X
  const oUserId = state.marks?.O
  const xPlayer = room.members.find((member) => member.userId === xUserId)
  const oPlayer = room.members.find((member) => member.userId === oUserId)
  const myMark: TicTacToeMark | null = currentUserId === xUserId ? 'X' : currentUserId === oUserId ? 'O' : null
  const isMyTurn = Boolean(myMark && session.status === 'running' && session.turn_user_id === currentUserId)
  const isDraw = session.status === 'finished' && !session.winner_id
  const winningMark: TicTacToeMark | null = session.winner_id === xUserId ? 'X' : session.winner_id === oUserId ? 'O' : null
  const isHost = room.room.host_id === currentUserId

  const message = session.status === 'running'
    ? isMyTurn
      ? `نوبت توئه؛ مهرهٔ ${myMark} را روی یک خانه بگذار.`
      : `نوبت ${session.turn_user_id === xUserId ? xPlayer?.displayName || 'بازیکن X' : oPlayer?.displayName || 'بازیکن O'} است.`
    : isDraw
      ? 'این دور مساوی شد؛ خانهٔ خالی باقی نماند.'
      : session.winner_id === currentUserId
        ? 'بردی! سه مهره در یک خط کامل شد.'
        : `این دور را ${session.winner_id === xUserId ? xPlayer?.displayName || 'بازیکن X' : oPlayer?.displayName || 'بازیکن O'} برد.`

  const renderPlayer = (mark: TicTacToeMark, player: typeof xPlayer) => {
    const isCurrent = currentUserId === player?.userId
    return <aside className={`player-card ${mark === 'X' ? 'current-player' : 'rival-player'}`}>
      <span className={`avatar avatar-${playerTone(mark)} large-avatar`}>{playerLabel(player?.displayName || 'بازیکن')}</span>
      <div>
        <span>{isCurrent ? 'تو' : mark === 'X' ? 'بازیکن اول' : 'حریف'}</span>
        <strong>{player?.displayName || 'در انتظار بازیکن'}</strong>
        <small><i /> {session.status === 'running' && session.turn_user_id === player?.userId ? 'نوبت اوست' : session.status === 'finished' && session.winner_id === player?.userId ? 'برندهٔ این دور' : 'آنلاین'}</small>
      </div>
      <b className="player-mark">{mark}</b>
    </aside>
  }

  return <div className="play-layout online-tic-layout">
    {renderPlayer('X', xPlayer)}
    <main className="board-panel">
      <div className="turn-message">
        <span className={`turn-badge ${myMark ? `mark-${myMark}` : ''}`}>{session.status === 'running' ? (session.turn_user_id === xUserId ? 'X' : 'O') : winningMark || '—'}</span>
        <p>{message}</p>
      </div>
      <div className="tic-board" aria-label="صفحهٔ آنلاین بازی دوز">
        {board.map((cell, index) => <button
          key={index}
          className={`tic-cell ${cell ? `mark-${cell}` : ''}`}
          onClick={() => onMove(index)}
          disabled={pending || Boolean(cell) || !isMyTurn || session.status !== 'running'}
          aria-label={`خانهٔ ${index + 1}`}
        >{displayMark(cell)}</button>)}
      </div>
      {session.status === 'finished' && isHost && <button className="primary-button rematch-button" onClick={onRematch} disabled={pending}>
        {pending ? <LoaderCircle className="spin" size={17} /> : <RotateCcw size={17} />}
        شروع دور تازه
      </button>}
      <div className="board-meta"><span><Wifi size={12} /> هم‌زمان و امن</span><i /><span>نسخهٔ بازی {session.version}</span>{winningMark && <><i /><span><Trophy size={12} /> برنده: {winningMark}</span></>}</div>
    </main>
    {renderPlayer('O', oPlayer)}
  </div>
}
