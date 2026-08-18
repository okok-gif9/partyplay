import type { CSSProperties } from 'react'

type BoardPosition = { row: number; col: number; x: number; y: number }

type SnakesBoardProps = {
  position: number
  playerInitial: string
  snakes: Map<number, number>
  ladders: Map<number, number>
}

const cellPosition = (cell: number): BoardPosition => {
  const safeCell = Math.min(100, Math.max(1, cell))
  const rowFromBottom = Math.floor((safeCell - 1) / 10)
  const orderInRow = (safeCell - 1) % 10
  const col = rowFromBottom % 2 === 0 ? orderInRow : 9 - orderInRow
  const row = 9 - rowFromBottom
  return { row, col, x: (col + 0.5) * 10, y: (row + 0.5) * 10 }
}

const cellAtGridPosition = (row: number, col: number) => {
  const rowFromBottom = 9 - row
  return rowFromBottom % 2 === 0
    ? rowFromBottom * 10 + col + 1
    : rowFromBottom * 10 + (9 - col) + 1
}

const cellTone = (cell: number, row: number, col: number) => {
  if ([1, 41, 43, 45].includes(cell)) return 'coral'
  if ([4, 5, 15, 16, 25, 35, 36, 65, 97].includes(cell)) return 'sun'
  if ([11, 13, 15, 31, 33, 35, 57, 59, 79, 81, 83].includes(cell)) return 'mint'
  if ([22, 23, 48, 49, 53, 74, 75, 86, 95, 98].includes(cell)) return 'sky'
  return (row + col) % 7 === 0 ? 'warm' : 'paper'
}

const snakePalette = [
  { body: '#f5c14a', belly: '#fff0b5', accent: '#d89122', bend: -10 },
  { body: '#81c0aa', belly: '#d9f2e3', accent: '#5c9c89', bend: 11 },
  { body: '#a98dc4', belly: '#dfd2ec', accent: '#83699f', bend: -12 },
  { body: '#eaa04f', belly: '#ffe1a8', accent: '#d37642', bend: 10 },
  { body: '#89c8d8', belly: '#d9f4f5', accent: '#5aa7bb', bend: -9 },
]

function Ladder({ from, to }: { from: number; to: number }) {
  const start = cellPosition(from)
  const end = cellPosition(to)
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy) || 1
  const ox = (dy / length) * 1.35
  const oy = (-dx / length) * 1.35
  const steps = Math.max(3, Math.floor(length / 4))
  return <g className="board-ladder">
    <path d={`M ${start.x + ox} ${start.y + oy} L ${end.x + ox} ${end.y + oy}`} />
    <path d={`M ${start.x - ox} ${start.y - oy} L ${end.x - ox} ${end.y - oy}`} />
    {Array.from({ length: steps - 1 }, (_, index) => {
      const progress = (index + 1) / steps
      const x = start.x + dx * progress
      const y = start.y + dy * progress
      return <path key={index} d={`M ${x + ox} ${y + oy} L ${x - ox} ${y - oy}`} className="board-ladder-rung" />
    })}
  </g>
}

function Snake({ from, to, index }: { from: number; to: number; index: number }) {
  const head = cellPosition(from)
  const tail = cellPosition(to)
  const palette = snakePalette[index % snakePalette.length]
  const midX = (head.x + tail.x) / 2
  const midY = (head.y + tail.y) / 2
  const c1x = head.x + palette.bend
  const c1y = head.y + (tail.y - head.y) * 0.28
  const c2x = tail.x - palette.bend
  const c2y = tail.y - (tail.y - head.y) * 0.22
  const path = `M ${head.x} ${head.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tail.x} ${tail.y}`
  return <g className="board-snake">
    <path d={path} className="board-snake-shadow" />
    <path d={path} className="board-snake-body" style={{ stroke: palette.body }} />
    <path d={path} className="board-snake-belly" style={{ stroke: palette.belly }} />
    <path d={path} className="board-snake-stripe" style={{ stroke: palette.accent }} />
    <ellipse cx={head.x} cy={head.y} rx="3.1" ry="2.45" fill={palette.body} transform={`rotate(${(Math.atan2(c1y - head.y, c1x - head.x) * 180) / Math.PI} ${head.x} ${head.y})`} />
    <circle cx={head.x - .95} cy={head.y - .62} r=".45" fill="#27343b" />
    <circle cx={head.x + .95} cy={head.y - .62} r=".45" fill="#27343b" />
    <path d={`M ${head.x} ${head.y + 1.75} q .7 .8 1.35 0`} className="board-snake-mouth" />
    <path d={`M ${head.x + 1.25} ${head.y + 1.75} l 1.5 .4 m -1.5 -.4 l .85 -.65 m .65 1.05 l .55 .7`} className="board-snake-tongue" />
    <circle cx={midX} cy={midY} r=".35" fill={palette.accent} opacity=".72" />
  </g>
}

export default function SnakesBoard({ position, playerInitial, snakes, ladders }: SnakesBoardProps) {
  const token = cellPosition(position)
  const tokenStyle = { '--token-x': `${token.x}%`, '--token-y': `${token.y}%` } as CSSProperties

  return <div className="storybook-board-shell">
    <div className="storybook-board" aria-label={`تختهٔ مار و پله؛ مهرهٔ شما در خانهٔ ${position}`}>
      <div className="storybook-board-grid" aria-hidden="true">
        {Array.from({ length: 100 }, (_, index) => {
          const row = Math.floor(index / 10)
          const col = index % 10
          const cell = cellAtGridPosition(row, col)
          return <span className={`storybook-cell tone-${cellTone(cell, row, col)}`} key={cell}><b>{cell}</b></span>
        })}
      </div>
      <svg className="storybook-paths" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {Array.from(ladders.entries()).map(([from, to]) => <Ladder key={`${from}-${to}`} from={from} to={to} />)}
        {Array.from(snakes.entries()).map(([from, to], index) => <Snake key={`${from}-${to}`} from={from} to={to} index={index} />)}
      </svg>
      <span className="storybook-token" style={tokenStyle} aria-label={`مهرهٔ ${playerInitial} در خانهٔ ${position}`}><i>{playerInitial}</i><b /></span>
      <span className="storybook-board-corner corner-one" aria-hidden="true">✦</span>
      <span className="storybook-board-corner corner-two" aria-hidden="true">❋</span>
    </div>
  </div>
}
