import { useCallback, useEffect, useState } from 'react'
import { Link2, RotateCcw, Sparkles, Users } from 'lucide-react'
import { useLanguage } from '../i18n'

type Mark = 'X' | 'O'
type Difficulty = 'easy' | 'medium' | 'hard'
type Outcome = Mark | 'draw'
type Score = { player: number; bot: number; draws: number }

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]
const emptyBoard = (): Array<Mark | null> => Array(9).fill(null)

function winner(board: Array<Mark | null>): Mark | null {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a]
  }
  return null
}

function minimax(board: Array<Mark | null>, turn: Mark, botMark: Mark, depth = 0): number {
  const won = winner(board)
  if (won) return won === botMark ? 10 - depth : depth - 10
  const open = board.flatMap((mark, index) => mark === null ? [index] : [])
  if (!open.length) return 0
  const scores = open.map((index) => {
    const next = [...board]
    next[index] = turn
    return minimax(next, turn === 'X' ? 'O' : 'X', botMark, depth + 1)
  })
  return turn === botMark ? Math.max(...scores) : Math.min(...scores)
}

function chooseBotMove(board: Array<Mark | null>, difficulty: Difficulty, botMark: Mark, playerMark: Mark): number | null {
  const open = board.flatMap((mark, index) => mark === null ? [index] : [])
  if (!open.length) return null
  if (difficulty === 'easy') return open[Math.floor(Math.random() * open.length)]

  const winningMove = (mark: Mark) => open.find((index) => {
    const next = [...board]
    next[index] = mark
    return winner(next) === mark
  })
  const win = winningMove(botMark)
  if (win !== undefined) return win
  const block = winningMove(playerMark)
  if (block !== undefined) return block
  if (difficulty === 'hard') {
    return open.reduce((bestIndex, index) => {
      const next = [...board]
      next[index] = botMark
      const score = minimax(next, playerMark, botMark, 1)
      return score > bestIndex.score ? { index, score } : bestIndex
    }, { index: open[0], score: -Infinity }).index
  }
  if (open.includes(4)) return 4
  const corners = open.filter((index) => [0, 2, 6, 8].includes(index))
  const candidates = corners.length ? corners : open
  return candidates[Math.floor(Math.random() * candidates.length)]
}

export default function RealTicTacToe({ onBack, onFriends }: { onBack: () => void; onFriends: () => void }) {
  const { t } = useLanguage()
  const copy = t.games.ticTacToe
  const [humanMark, setHumanMark] = useState<Mark>('X')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [board, setBoard] = useState<Array<Mark | null>>(emptyBoard)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [thinking, setThinking] = useState(false)
  const [score, setScore] = useState<Score>({ player: 0, bot: 0, draws: 0 })
  const botMark: Mark = humanMark === 'X' ? 'O' : 'X'
  const turn: Mark = board.filter(Boolean).length % 2 === 0 ? 'X' : 'O'

  const applyMove = useCallback((index: number, mark: Mark) => {
    if (board[index] || outcome) return
    const next = [...board]
    next[index] = mark
    setBoard(next)
    const won = winner(next)
    if (won) {
      setOutcome(won)
      setScore((current) => ({ ...current, [won === humanMark ? 'player' : 'bot']: current[won === humanMark ? 'player' : 'bot'] + 1 }))
      setThinking(false)
    } else if (next.every(Boolean)) {
      setOutcome('draw')
      setScore((current) => ({ ...current, draws: current.draws + 1 }))
      setThinking(false)
    } else {
      setThinking(mark === humanMark)
    }
  }, [board, humanMark, outcome])

  useEffect(() => {
    if (outcome || turn !== botMark) return
    setThinking(true)
    const timer = window.setTimeout(() => {
      const index = chooseBotMove(board, difficulty, botMark, humanMark)
      if (index !== null) applyMove(index, botMark)
    }, 420)
    return () => window.clearTimeout(timer)
  }, [applyMove, board, botMark, difficulty, humanMark, outcome, turn])

  const resetRound = (nextMark = humanMark) => {
    setHumanMark(nextMark)
    setBoard(emptyBoard())
    setOutcome(null)
    setThinking(false)
  }
  const status = outcome === 'draw' ? copy.drawResult
    : outcome === humanMark ? copy.playerWins
      : outcome ? copy.botWins
        : thinking ? copy.botThinking
          : turn === humanMark ? copy.playerTurn : copy.botTurn

  return <section className="real-game-page ttt-page">
    <header className="real-game-header">
      <div>
        <span className="eyebrow"><Sparkles size={15}/>{copy.eyebrow}</span>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
      </div>
      <div className="real-game-actions">
        <button className="secondary-button" onClick={onBack}>{t.app.games}</button>
        <button className="primary-button" onClick={onFriends}><Link2 size={17}/>{copy.friendsRoom}</button>
      </div>
    </header>

    <div className="ttt-layout">
      <section className="ttt-play-panel" aria-label={copy.title}>
        <div className="ttt-controls">
          <div className="ttt-choice-group" role="group" aria-label={copy.chooseMark}>
            <span>{copy.chooseMark}</span>
            {(['X', 'O'] as const).map((mark) => <button key={mark} className={humanMark === mark ? 'ttt-choice ttt-choice-active' : 'ttt-choice'} onClick={() => resetRound(mark)} aria-pressed={humanMark === mark} disabled={thinking && turn === botMark}>{mark}</button>)}
          </div>
          <div className="ttt-choice-group" role="group" aria-label={copy.chooseDifficulty}>
            <span>{copy.chooseDifficulty}</span>
            {(['easy', 'medium', 'hard'] as const).map((level) => <button key={level} className={difficulty === level ? 'ttt-choice ttt-choice-active' : 'ttt-choice'} onClick={() => setDifficulty(level)} aria-pressed={difficulty === level}>{copy[level]}</button>)}
          </div>
        </div>

        <p className={`ttt-status ${outcome ? 'ttt-status-result' : ''}`} role="status" aria-live="polite">{thinking && !outcome && <span className="ttt-thinking-dot"/>}{status}</p>
        <div className="ttt-board" role="grid" aria-label={copy.boardLabel}>
          {board.map((mark, index) => <button
            key={index}
            type="button"
            role="gridcell"
            className={`ttt-cell ${mark === 'X' ? 'ttt-mark-x' : mark === 'O' ? 'ttt-mark-o' : ''}`}
            aria-label={mark ? copy.squareFilled.replace('{number}', String(index + 1)).replace('{mark}', mark) : copy.squareEmpty.replace('{number}', String(index + 1))}
            onClick={() => { if (!thinking && turn === humanMark && !outcome) applyMove(index, humanMark) }}
            disabled={Boolean(mark) || thinking || turn !== humanMark || Boolean(outcome)}
          >{mark && <span aria-hidden="true">{mark}</span>}</button>)}
        </div>
        <div className="ttt-scoreboard" aria-label={copy.scoreLabel}>
          <div><span>{copy.playerScore}</span><strong>{score.player}</strong></div>
          <div><span>{copy.drawScore}</span><strong>{score.draws}</strong></div>
          <div><span>{copy.botScore}</span><strong>{score.bot}</strong></div>
        </div>
        <div className="ttt-game-actions">
          <button className="secondary-button" onClick={() => resetRound()}><RotateCcw size={16}/>{copy.nextRound}</button>
          <button className="text-button" onClick={() => { resetRound(); setScore({ player: 0, bot: 0, draws: 0 }) }}>{copy.resetScore}</button>
        </div>
      </section>

      <aside className="ttt-side-panel">
        <span className="ttt-side-icon"><Users size={19}/></span>
        <strong>{copy.playTogetherTitle}</strong>
        <p>{copy.playTogetherDescription}</p>
        <button className="secondary-button" onClick={onFriends}><Users size={16}/>{copy.friendsRoom}</button>
      </aside>
    </div>
  </section>
}
