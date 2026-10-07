import type { PartyGameId } from '../data/gameCatalog'

export type AppPage =
  | 'home' | 'games' | 'game-details' | 'rooms' | 'join' | 'create-room'
  | 'friends' | 'groups' | 'profile' | 'activity' | 'admin' | 'room' | 'game'
  | 'arcade-game' | 'truth-setup' | 'truth-room' | 'truth-game'
  | 'mafia-setup' | 'mafia-room' | 'mafia-game'
  | 'full-game-setup' | 'full-game-room' | 'full-game'

export type AppRoute = { page: AppPage; game: PartyGameId }
const games = new Set<string>(['mafia', 'tic-tac-toe', 'truth-dare', 'spyfall', 'uno', 'pictionary', 'connect-four', 'backgammon', 'ludo', 'codenames', 'hokm', 'freecell'])
const isGame = (value: string | undefined): value is PartyGameId => Boolean(value && games.has(value))

export function resolveAppRoute(location: Pick<Location, 'hash' | 'search'> = window.location): AppRoute {
  if (new URLSearchParams(location.search).get('view') === 'admin') return { page: 'admin', game: 'tic-tac-toe' }
  const segments = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const [section, value, mode] = segments
  const game = isGame(value) ? value : 'tic-tac-toe'

  if (!section) return { page: 'home', game }
  if (section === 'games') return value && isGame(value) ? { page: 'game-details', game: value } : { page: 'games', game }
  if (section === 'rooms') {
    if (value === 'create') {
      if (mode === 'mafia') return { page: 'mafia-setup', game: 'mafia' }
      if (mode === 'truth-dare') return { page: 'truth-setup', game: 'truth-dare' }
      if (isGame(mode)) return { page: 'full-game-setup', game: mode }
      return { page: 'create-room', game }
    }
    return { page: 'rooms', game }
  }
  if (section === 'join') return { page: 'join', game }
  if (section === 'friends') return { page: 'friends', game }
  if (section === 'groups') return { page: 'groups', game }
  if (section === 'profile') return { page: 'profile', game }
  if (section === 'activity') return { page: 'activity', game }
  if (section === 'admin') return { page: 'admin', game }
  if (section === 'room') {
    if (value === 'mafia') return { page: 'mafia-room', game: 'mafia' }
    if (value === 'truth-dare') return { page: 'truth-room', game: 'truth-dare' }
    if (value === 'tic-tac-toe') return { page: 'room', game: 'tic-tac-toe' }
    if (isGame(value)) return { page: 'full-game-room', game: value }
  }
  if (section === 'play') {
    if (value === 'mafia') return { page: 'mafia-game', game: 'mafia' }
    if (value === 'truth-dare') return { page: 'truth-game', game: 'truth-dare' }
    if (isGame(value)) return { page: mode === 'practice' ? 'arcade-game' : 'game', game: value }
  }
  return { page: 'home', game }
}

export function routeHref(page: AppPage, game: PartyGameId = 'tic-tac-toe'): string {
  const routes: Record<AppPage, string> = {
    home: '', games: 'games', 'game-details': `games/${game}`, rooms: 'rooms', join: 'join', 'create-room': 'rooms/create',
    friends: 'friends', groups: 'groups', profile: 'profile', activity: 'activity', admin: 'admin',
    room: 'room/tic-tac-toe', game: `play/${game}`, 'arcade-game': `play/${game}/practice`,
    'truth-setup': 'rooms/create/truth-dare', 'truth-room': 'room/truth-dare', 'truth-game': 'play/truth-dare',
    'mafia-setup': 'rooms/create/mafia', 'mafia-room': 'room/mafia', 'mafia-game': 'play/mafia',
    'full-game-setup': `rooms/create/${game}`, 'full-game-room': `room/${game}`, 'full-game': `play/${game}`,
  }
  return `#/${routes[page]}`
}
