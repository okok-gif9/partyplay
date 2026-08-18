export const shuffle = <T,>(items: readonly T[], random = Math.random): T[] => {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[result[index], result[swap]] = [result[swap], result[index]]
  }
  return result
}

// --- Connect four ----------------------------------------------------------
export type ConnectFourState = { board: Array<'red' | 'yellow' | null>; players: [string, string]; turn: number; winner: string | null; isDraw: boolean }
const connectLines = Array.from({ length: 6 }, (_, row) => Array.from({ length: 7 }, (_, column) => [row, column])).flat()
const connectWinner = (board: ConnectFourState['board']) => {
  const at = (row: number, column: number) => row >= 0 && row < 6 && column >= 0 && column < 7 ? board[row * 7 + column] : null
  for (const [row, column] of connectLines) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const color = at(row, column)
    if (color && [1, 2, 3].every((offset) => at(row + dr * offset, column + dc * offset) === color)) return color
  }
  return null
}
export const createConnectFour = (players: [string, string]): ConnectFourState => ({ board: Array(42).fill(null), players, turn: 0, winner: null, isDraw: false })
export const playConnectFour = (state: ConnectFourState, userId: string, column: number): ConnectFourState => {
  if (state.winner || state.isDraw || state.players[state.turn] !== userId || column < 0 || column > 6) return state
  const cell = [5, 4, 3, 2, 1, 0].map((row) => row * 7 + column).find((index) => !state.board[index])
  if (cell === undefined) return state
  const color = state.turn === 0 ? 'red' : 'yellow'
  const board = state.board.map((value, index) => index === cell ? color : value)
  const colorWinner = connectWinner(board)
  return { ...state, board, winner: colorWinner ? state.players[colorWinner === 'red' ? 0 : 1] : null, isDraw: !colorWinner && board.every(Boolean), turn: colorWinner ? state.turn : (state.turn + 1) % 2 }
}

// --- UNO -------------------------------------------------------------------
export type UnoColor = 'red' | 'yellow' | 'green' | 'blue' | 'wild'
export type UnoValue = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4'
export type UnoCard = { id: string; color: UnoColor; value: UnoValue }
export type UnoState = { hands: Record<string, UnoCard[]>; drawPile: UnoCard[]; discardPile: UnoCard[]; players: string[]; turn: number; direction: 1 | -1; pendingDraw: number; chosenColor: UnoColor | null; winner: string | null; hasDrawn: boolean }
const unoColors: Exclude<UnoColor, 'wild'>[] = ['red', 'yellow', 'green', 'blue']
const unoValues: Exclude<UnoValue, 'wild' | 'wild4'>[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2']
export const createUnoDeck = (): UnoCard[] => {
  const cards: UnoCard[] = []
  for (const color of unoColors) for (const value of unoValues) for (let copy = 0; copy < (value === '0' ? 1 : 2); copy += 1) cards.push({ id: `${color}-${value}-${copy}`, color, value })
  for (const value of ['wild', 'wild4'] as const) for (let copy = 0; copy < 4; copy += 1) cards.push({ id: `${value}-${copy}`, color: 'wild', value })
  return cards
}
const unoNext = (state: UnoState, step = 1) => (state.turn + state.direction * step + state.players.length * 10) % state.players.length
export const createUno = (players: string[], random = Math.random): UnoState => {
  let deck = shuffle(createUnoDeck(), random)
  const hands: Record<string, UnoCard[]> = {}
  for (const player of players) { hands[player] = deck.slice(0, 7); deck = deck.slice(7) }
  let top = deck[0]
  deck = deck.slice(1)
  while (top.color === 'wild') { deck = [...deck, top]; top = deck[0]; deck = deck.slice(1) }
  return { hands, drawPile: deck, discardPile: [top], players, turn: 0, direction: 1, pendingDraw: 0, chosenColor: null, winner: null, hasDrawn: false }
}
export const canPlayUno = (state: UnoState, card: UnoCard) => {
  const top = state.discardPile.at(-1)!
  const activeColor = state.chosenColor || top.color
  if (state.pendingDraw > 0 && card.value !== 'draw2' && card.value !== 'wild4') return false
  return card.color === 'wild' || card.color === activeColor || card.value === top.value
}
export const drawUno = (state: UnoState, userId: string): UnoState => {
  if (state.winner || state.players[state.turn] !== userId || state.hasDrawn) return state
  const hand = state.hands[userId] || []
  const drawPile = [...state.drawPile]
  const discardPile = [...state.discardPile]
  if (!drawPile.length && discardPile.length > 1) drawPile.push(...shuffle(discardPile.splice(0, discardPile.length - 1)))
  if (!drawPile.length) return state
  return { ...state, hands: { ...state.hands, [userId]: [...hand, drawPile.shift()!] }, drawPile, discardPile, hasDrawn: true }
}
export const playUno = (state: UnoState, userId: string, cardId: string, selectedColor?: Exclude<UnoColor, 'wild'>): UnoState => {
  if (state.winner || state.players[state.turn] !== userId) return state
  const card = (state.hands[userId] || []).find((candidate) => candidate.id === cardId)
  if (!card || !canPlayUno(state, card) || (card.color === 'wild' && !selectedColor)) return state
  const hands = { ...state.hands, [userId]: state.hands[userId].filter((candidate) => candidate.id !== card.id) }
  const next = { ...state, hands, discardPile: [...state.discardPile, card], chosenColor: card.color === 'wild' ? selectedColor || null : null, hasDrawn: false }
  if (!hands[userId].length) return { ...next, winner: userId }
  let direction = next.direction
  let pendingDraw = 0
  let step = 1
  if (card.value === 'reverse') { direction = direction === 1 ? -1 : 1; if (state.players.length === 2) step = 2 }
  if (card.value === 'skip') step = 2
  if (card.value === 'draw2') { pendingDraw = state.pendingDraw + 2; step = 1 }
  if (card.value === 'wild4') { pendingDraw = state.pendingDraw + 4; step = 1 }
  return { ...next, direction, pendingDraw, turn: (state.turn + direction * step + state.players.length * 10) % state.players.length }
}
export const passUnoDraw = (state: UnoState, userId: string): UnoState => {
  if (state.players[state.turn] !== userId || (!state.hasDrawn && state.pendingDraw === 0)) return state
  const drawCount = state.pendingDraw
  let next = state
  for (let index = 0; index < drawCount; index += 1) next = drawUno({ ...next, hasDrawn: false }, userId)
  return { ...next, pendingDraw: 0, hasDrawn: false, turn: unoNext(next) }
}

// --- Ludo ------------------------------------------------------------------
export type LudoToken = { owner: number; token: number; progress: number }
export type LudoState = { players: string[]; tokens: LudoToken[]; turn: number; lastRoll: number | null; winner: string | null }
const ludoSafeCells = new Set([0, 8, 13, 21, 26, 34, 39, 47])
export const createLudo = (players: string[]): LudoState => ({ players, tokens: players.flatMap((_, owner) => Array.from({ length: 4 }, (_, token) => ({ owner, token, progress: -1 }))), turn: 0, lastRoll: null, winner: null })
export const ludoMoves = (state: LudoState, roll: number) => state.tokens.filter((token) => token.owner === state.turn && ((token.progress === -1 && roll === 6) || (token.progress >= 0 && token.progress + roll <= 56)))
export const playLudo = (state: LudoState, userId: string, roll: number, tokenNo: number): LudoState => {
  if (state.winner || state.players[state.turn] !== userId || roll < 1 || roll > 6) return state
  const token = state.tokens.find((item) => item.owner === state.turn && item.token === tokenNo)
  if (!token || !ludoMoves(state, roll).some((move) => move === token)) return state
  const nextProgress = token.progress === -1 ? 0 : token.progress + roll
  let tokens = state.tokens.map((item) => item === token ? { ...item, progress: nextProgress } : item)
  if (nextProgress < 52 && !ludoSafeCells.has(nextProgress)) tokens = tokens.map((item) => item.owner !== token.owner && item.progress === nextProgress ? { ...item, progress: -1 } : item)
  const winner = tokens.filter((item) => item.owner === token.owner).every((item) => item.progress === 56) ? userId : null
  return { ...state, tokens, lastRoll: roll, winner, turn: winner || roll === 6 ? state.turn : (state.turn + 1) % state.players.length }
}

// --- Codenames -------------------------------------------------------------
export type CodeTeam = 'red' | 'blue'
export type CodeCard = { word: string; team: CodeTeam | 'neutral' | 'assassin'; revealed: boolean }
export type CodenamesState = { cards: CodeCard[]; players: string[]; activeTeam: CodeTeam; spymasters: Record<CodeTeam, string>; guessesLeft: number; winner: CodeTeam | null; clue: string | null }
export const createCodenames = (players: string[], words: string[], random = Math.random): CodenamesState => {
  const teams = shuffle([...players], random)
  const red = teams[0], blue = teams[1]
  const assignments = shuffle<CodeCard['team']>(['red','red','red','red','red','red','red','red','red','blue','blue','blue','blue','blue','blue','blue','blue','neutral','neutral','neutral','neutral','neutral','neutral','neutral','assassin'], random)
  return { cards: shuffle(words, random).slice(0, 25).map((word, index) => ({ word, team: assignments[index], revealed: false })), players, activeTeam: 'red', spymasters: { red, blue }, guessesLeft: 0, winner: null, clue: null }
}
export const giveCodenamesClue = (state: CodenamesState, userId: string, clue: string, count: number): CodenamesState => state.winner || state.spymasters[state.activeTeam] !== userId || !clue.trim() || count < 1 ? state : { ...state, clue: clue.trim(), guessesLeft: count + 1 }
export const guessCodenames = (state: CodenamesState, userId: string, cardIndex: number): CodenamesState => {
  if (state.winner || state.spymasters[state.activeTeam] === userId || !state.players.includes(userId) || state.guessesLeft < 1) return state
  const card = state.cards[cardIndex]
  if (!card || card.revealed) return state
  const cards = state.cards.map((candidate, index) => index === cardIndex ? { ...candidate, revealed: true } : candidate)
  if (card.team === 'assassin') return { ...state, cards, winner: state.activeTeam === 'red' ? 'blue' : 'red', guessesLeft: 0 }
  const allTeamFound = cards.filter((candidate) => candidate.team === state.activeTeam).every((candidate) => candidate.revealed)
  if (allTeamFound) return { ...state, cards, winner: state.activeTeam, guessesLeft: 0 }
  if (card.team !== state.activeTeam) return { ...state, cards, activeTeam: state.activeTeam === 'red' ? 'blue' : 'red', guessesLeft: 0, clue: null }
  return { ...state, cards, guessesLeft: state.guessesLeft - 1 }
}
export const endCodenamesTurn = (state: CodenamesState, userId: string): CodenamesState => state.winner || !state.players.includes(userId) ? state : { ...state, activeTeam: state.activeTeam === 'red' ? 'blue' : 'red', guessesLeft: 0, clue: null }

// --- Spyfall ---------------------------------------------------------------
export type SpyfallState = { players: string[]; location: string; spyId: string; currentQuestioner: number; currentRespondent: number; questions: Array<{ from: string; to: string; body: string }>; votes: Record<string, string>; accusedId: string | null; phase: 'questions' | 'accusation' | 'finished'; winner: 'spy' | 'agents' | null }
export const createSpyfall = (players: string[], locations: string[], random = Math.random): SpyfallState => ({ players, location: locations[Math.floor(random() * locations.length)] || 'کافه', spyId: players[Math.floor(random() * players.length)], currentQuestioner: 0, currentRespondent: players.length > 1 ? 1 : 0, questions: [], votes: {}, accusedId: null, phase: 'questions', winner: null })
export const askSpyfallQuestion = (state: SpyfallState, userId: string, respondentId: string, body: string): SpyfallState => {
  if (state.phase !== 'questions' || state.players[state.currentQuestioner] !== userId || !state.players.includes(respondentId) || respondentId === userId || !body.trim()) return state
  const respondent = state.players.indexOf(respondentId)
  return { ...state, questions: [...state.questions, { from: userId, to: respondentId, body: body.trim().slice(0, 180) }].slice(-20), currentQuestioner: respondent, currentRespondent: (respondent + 1) % state.players.length }
}
export const accuseSpyfall = (state: SpyfallState, userId: string, accusedId: string): SpyfallState => state.phase !== 'questions' || !state.players.includes(userId) || !state.players.includes(accusedId) ? state : { ...state, phase: 'accusation', accusedId, votes: {} }
export const voteSpyfall = (state: SpyfallState, userId: string, accusedId: string): SpyfallState => state.phase !== 'accusation' || !state.players.includes(userId) || !state.players.includes(accusedId) ? state : { ...state, votes: { ...state.votes, [userId]: accusedId } }
export const resolveSpyfall = (state: SpyfallState, spyLocationGuess?: string): SpyfallState => {
  if (state.phase !== 'accusation') return state
  if (spyLocationGuess?.trim().toLocaleLowerCase('fa-IR') === state.location.toLocaleLowerCase('fa-IR')) return { ...state, phase: 'finished', winner: 'spy' }
  const tally = Object.values(state.votes).reduce<Record<string, number>>((all, value) => ({ ...all, [value]: (all[value] || 0) + 1 }), {})
  const accusedId = Object.entries(tally).sort((left, right) => right[1] - left[1])[0]?.[0] || state.accusedId
  return { ...state, phase: 'finished', accusedId: accusedId || null, winner: accusedId === state.spyId ? 'agents' : 'spy' }
}

// --- Hokm ------------------------------------------------------------------
export type HokmSuit = 'spades' | 'hearts' | 'diamonds' | 'clubs'
export type HokmCard = { suit: HokmSuit; rank: number }
const hokmSuits: HokmSuit[] = ['spades', 'hearts', 'diamonds', 'clubs']
export const createHokmDeck = (): HokmCard[] => hokmSuits.flatMap((suit) => Array.from({ length: 13 }, (_, offset) => ({ suit, rank: offset + 2 })))
export const legalHokmCards = (hand: HokmCard[], leadSuit: HokmSuit | null) => leadSuit && hand.some((card) => card.suit === leadSuit) ? hand.filter((card) => card.suit === leadSuit) : hand
export const hokmTrickWinner = (cards: Array<{ userId: string; card: HokmCard }>, trump: HokmSuit): string | null => {
  if (!cards.length) return null
  const lead = cards[0].card.suit
  return [...cards].sort((left, right) => {
    const score = (card: HokmCard) => card.suit === trump ? 100 + card.rank : card.suit === lead ? 50 + card.rank : card.rank
    return score(right.card) - score(left.card)
  })[0].userId
}

// --- Backgammon ------------------------------------------------------------
// Points are indexed from the white player's entry (0) to bearing-off end (23).
// Positive values are white checkers; negative values are black checkers.
export type BackgammonState = { points: number[]; bar: [number, number]; borneOff: [number, number]; players: [string, string]; turn: 0 | 1; dice: number[]; winner: string | null }
export const createBackgammon = (players: [string, string]): BackgammonState => {
  const points = Array(24).fill(0)
  points[0] = 2; points[11] = 5; points[16] = 3; points[18] = 5
  points[23] = -2; points[12] = -5; points[7] = -3; points[5] = -5
  return { points, bar: [0, 0], borneOff: [0, 0], players, turn: 0, dice: [], winner: null }
}
export const rollBackgammon = (state: BackgammonState, userId: string, random = Math.random): BackgammonState => {
  if (state.winner || state.players[state.turn] !== userId || state.dice.length) return state
  const first = Math.floor(random() * 6) + 1, second = Math.floor(random() * 6) + 1
  return { ...state, dice: first === second ? [first, first, first, first] : [first, second] }
}
const allBackgammonHome = (state: BackgammonState, player: 0 | 1) => player === 0
  ? state.bar[0] === 0 && state.points.slice(0, 18).every((point) => point <= 0)
  : state.bar[1] === 0 && state.points.slice(6).every((point) => point >= 0)
export type BackgammonMove = { from: number; die: number; to: number | null }
export const legalBackgammonMoves = (state: BackgammonState, player: 0 | 1): BackgammonMove[] => {
  if (!state.dice.length) return []
  const direction = player === 0 ? 1 : -1
  const sign = player === 0 ? 1 : -1
  const froms = state.bar[player] > 0 ? [-1] : state.points.map((point, index) => point * sign > 0 ? index : -2).filter((index) => index >= 0)
  const moves: BackgammonMove[] = []
  for (const from of froms) for (const die of state.dice) {
    const to = from === -1 ? (player === 0 ? die - 1 : 24 - die) : from + direction * die
    const beyond = to < 0 || to > 23
    if (beyond) { if (from !== -1 && allBackgammonHome(state, player)) moves.push({ from, die, to: null }); continue }
    if (state.points[to] * sign >= -1) moves.push({ from, die, to })
  }
  return moves
}
export const moveBackgammon = (state: BackgammonState, userId: string, from: number, die: number): BackgammonState => {
  if (state.winner || state.players[state.turn] !== userId) return state
  const move = legalBackgammonMoves(state, state.turn).find((candidate) => candidate.from === from && candidate.die === die)
  if (!move) return state
  const player = state.turn, sign = player === 0 ? 1 : -1
  const points = [...state.points], bar: [number, number] = [...state.bar] as [number, number], borneOff: [number, number] = [...state.borneOff] as [number, number]
  if (from === -1) bar[player] -= 1; else points[from] -= sign
  if (move.to === null) borneOff[player] += 1
  else if (points[move.to] * sign === -1) { points[move.to] = sign; bar[player === 0 ? 1 : 0] += 1 }
  else points[move.to] += sign
  const dice = [...state.dice]; dice.splice(dice.indexOf(die), 1)
  const winner = borneOff[player] === 15 ? userId : null
  const hasNextMove = dice.length && legalBackgammonMoves({ ...state, points, bar, borneOff, dice }, player).length > 0
  return { ...state, points, bar, borneOff, dice: hasNextMove ? dice : [], winner, turn: winner || hasNextMove ? player : player === 0 ? 1 : 0 }
}

// --- Hokm ------------------------------------------------------------------
export type HokmState = { players: [string, string, string, string]; captain: string; turn: number; trump: HokmSuit | null; hands: Record<string, HokmCard[]>; table: Array<{ userId: string; card: HokmCard }>; tricks: [number, number]; score: [number, number]; winner: 0 | 1 | null }
export const createHokm = (players: [string, string, string, string], random = Math.random): HokmState => {
  const deck = shuffle(createHokmDeck(), random), hands: Record<string, HokmCard[]> = {}
  players.forEach((player, index) => { hands[player] = deck.slice(index * 13, index * 13 + 13) })
  return { players, captain: players[0], turn: 0, trump: null, hands, table: [], tricks: [0, 0], score: [0, 0], winner: null }
}
export const chooseHokmTrump = (state: HokmState, userId: string, trump: HokmSuit): HokmState => state.trump || state.captain !== userId ? state : { ...state, trump }
export const playHokmCard = (state: HokmState, userId: string, card: HokmCard): HokmState => {
  if (!state.trump || state.winner !== null || state.players[state.turn] !== userId) return state
  const hand = state.hands[userId] || []
  if (!hand.some((candidate) => candidate.suit === card.suit && candidate.rank === card.rank)) return state
  const leadSuit = state.table[0]?.card.suit || null
  if (!legalHokmCards(hand, leadSuit).some((candidate) => candidate.suit === card.suit && candidate.rank === card.rank)) return state
  const hands = { ...state.hands, [userId]: hand.filter((candidate) => candidate.suit !== card.suit || candidate.rank !== card.rank) }
  const table = [...state.table, { userId, card }]
  if (table.length < 4) return { ...state, hands, table, turn: (state.turn + 1) % 4 }
  const trickWinner = hokmTrickWinner(table, state.trump)!
  const winnerIndex = state.players.indexOf(trickWinner), team = winnerIndex % 2 === 0 ? 0 : 1
  const tricks: [number, number] = [...state.tricks] as [number, number]; tricks[team] += 1
  if (tricks[team] >= 7) { const score: [number, number] = [...state.score] as [number, number]; score[team] += 1; return { ...state, hands, table: [], tricks, score, winner: team } }
  return { ...state, hands, table: [], tricks, turn: winnerIndex }
}

// --- Snakes and ladders ----------------------------------------------------
export type SnakesLaddersState = { players: string[]; positions: Record<string, number>; turn: number; lastRoll: number | null; winner: string | null }
const snakesAndLaddersJumps: Record<number, number> = { 4: 14, 9: 31, 20: 38, 28: 84, 40: 59, 51: 67, 71: 91, 17: 7, 54: 34, 62: 19, 87: 36, 93: 73 }
export const createSnakesLadders = (players: string[]): SnakesLaddersState => ({ players, positions: Object.fromEntries(players.map((player) => [player, 1])), turn: 0, lastRoll: null, winner: null })
export const playSnakesLadders = (state: SnakesLaddersState, userId: string, roll: number): SnakesLaddersState => {
  if (state.winner || state.players[state.turn] !== userId || roll < 1 || roll > 6) return state
  const current = state.positions[userId] || 1
  const landed = current + roll > 100 ? current : current + roll
  const position = snakesAndLaddersJumps[landed] || landed
  const winner = position === 100 ? userId : null
  return { ...state, positions: { ...state.positions, [userId]: position }, lastRoll: roll, winner, turn: winner || roll === 6 ? state.turn : (state.turn + 1) % state.players.length }
}
