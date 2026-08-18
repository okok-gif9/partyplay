import type { LucideIcon } from 'lucide-react'
import { BrainCircuit, BrushCleaning, CircleDotDashed, Club, Columns3, Dices, Grid2X2, MoonStar, ShieldQuestion, Sparkles, Swords } from 'lucide-react'

export type PartyGameId =
  | 'mafia' | 'tic-tac-toe' | 'truth-dare' | 'snakes'
  | 'spyfall' | 'uno' | 'pictionary' | 'connect-four' | 'backgammon' | 'ludo' | 'codenames' | 'hokm'

export type GameDefinition = {
  id: PartyGameId
  title: string
  subtitle: string
  players: string
  duration: string
  tone: string
  accent: 'pink' | 'cyan' | 'gold' | 'lime' | 'violet' | 'orange' | 'blue' | 'red'
  icon: LucideIcon
  art: string
  online: boolean
  source?: string
}

export const gameCatalog: GameDefinition[] = [
  { id: 'mafia', title: 'مافیا', subtitle: 'نقش بگیر، شک کن، رأی بده', players: '۵، ۷ یا ۹ نفر', duration: '۱۵ تا ۳۰ دقیقه', tone: 'نقش مخفی', icon: MoonStar, accent: 'pink', art: '☾', online: true, source: 'Jezternz/PlayMafia (MIT)' },
  { id: 'spyfall', title: 'جاسوس', subtitle: 'مکان را کشف کن، بدون لو دادن خودت', players: '۳ تا ۸ نفر', duration: '۸ تا ۱۲ دقیقه', tone: 'نقش مخفی', icon: ShieldQuestion, accent: 'violet', art: '◉', online: false, source: 'adrianocola/spyfall (MIT)' },
  { id: 'uno', title: 'اونو', subtitle: 'رنگ و عدد درست را سریع بازی کن', players: '۲ تا ۴ نفر', duration: '۶ تا ۱۵ دقیقه', tone: 'کارت و رقابت', icon: Club, accent: 'red', art: '♣', online: false, source: 'guilhermebkel/uno-game (MIT)' },
  { id: 'pictionary', title: 'بکش و حدس بزن', subtitle: 'بکش، بخند و کلمه را حدس بزن', players: '۳ تا ۸ نفر', duration: '۱۰ تا ۲۰ دقیقه', tone: 'خلاق و گروهی', icon: BrushCleaning, accent: 'orange', art: '✎', online: false, source: 'Arp-G/pictionary (MIT)' },
  { id: 'connect-four', title: 'چهاردرردیف', subtitle: 'چهار مهره کنار هم بچین', players: '۲ نفر', duration: '۳ تا ۷ دقیقه', tone: 'استراتژی سریع', icon: Columns3, accent: 'cyan', art: '●', online: false, source: 'caleb531/connect-four (MIT)' },
  { id: 'backgammon', title: 'تخته‌نرد', subtitle: 'تاس بریز و مهره‌ها را خانه کن', players: '۲ نفر', duration: '۱۵ تا ۳۰ دقیقه', tone: 'کلاسیک و تاکتیکی', icon: Dices, accent: 'gold', art: '◈', online: false, source: 'quasoft/backgammonjs (MIT)' },
  { id: 'ludo', title: 'منچ', subtitle: 'مهره‌ها را دور زمین به خانه برسان', players: '۲ تا ۴ نفر', duration: '۱۰ تا ۲۵ دقیقه', tone: 'شانس و رقابت', icon: CircleDotDashed, accent: 'lime', art: '◌', online: false, source: 'CyberCitizen01/LUDO (MIT)' },
  { id: 'snakes', title: 'مارپله', subtitle: 'از پله‌ها بالا برو و از مارها فرار کن', players: '۲ تا ۸ نفر', duration: '۸ تا ۱۵ دقیقه', tone: 'تاس و هیجان', icon: Dices, accent: 'lime', art: '⌁', online: false, source: 'AdheeshaRavindu/Snake-and-Ladder (MIT)' },
  { id: 'codenames', title: 'رمز', subtitle: 'با یک سرنخ، تیم خودت را هدایت کن', players: '۴ تا ۸ نفر', duration: '۱۰ تا ۲۰ دقیقه', tone: 'تیمی و کلمه‌ای', icon: BrainCircuit, accent: 'blue', art: '⌘', online: false, source: 'koosvary/codenames (MIT)' },
  { id: 'hokm', title: 'حکم', subtitle: 'حکم را انتخاب کن و دست‌ها را ببر', players: '۴ نفر', duration: '۱۵ تا ۳۰ دقیقه', tone: 'پاسور ایرانی', icon: Swords, accent: 'orange', art: '♠', online: false, source: 'matin-as/Online-hokm-game (CC0-1.0)' },
  { id: 'truth-dare', title: 'جرئت یا حقیقت', subtitle: 'کارت بکش و جمع را بخندان', players: '۲ تا ۸ نفر', duration: 'آزاد', tone: 'پارتی و گفتگو', icon: Sparkles, accent: 'gold', art: '✺', online: true },
  { id: 'tic-tac-toe', title: 'دوز کلاسیک', subtitle: 'سه مهره کنار هم بچین', players: '۲ نفر', duration: '۱ تا ۳ دقیقه', tone: 'تمرین سریع', icon: Grid2X2, accent: 'cyan', art: '✕', online: true },
]

export const gameById = (id: PartyGameId) => gameCatalog.find((game) => game.id === id) || gameCatalog[0]
export const newGameIds: PartyGameId[] = ['spyfall', 'uno', 'pictionary', 'connect-four', 'backgammon', 'ludo', 'codenames', 'hokm']
