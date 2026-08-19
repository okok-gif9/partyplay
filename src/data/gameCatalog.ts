import type { LucideIcon } from 'lucide-react'
import { BrainCircuit, BrushCleaning, CircleDotDashed, Club, Columns3, Crown, Dices, Grid2X2, MoonStar, ShieldQuestion, Sparkles } from 'lucide-react'

export type PartyGameId =
  | 'mafia' | 'tic-tac-toe' | 'truth-dare' | 'snakes'
  | 'spyfall' | 'uno' | 'pictionary' | 'connect-four' | 'backgammon' | 'ludo' | 'codenames' | 'hokm' | 'freecell'

export type GameAvailability = 'published' | 'upgrade' | 'research' | 'paused' | 'removed'

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
  availability: GameAvailability
  source?: string
}

export const gameCatalog: GameDefinition[] = [
  { id: 'mafia', title: 'مافیا', subtitle: 'نقش بگیر، شک کن، رأی بده', players: '۵، ۷ یا ۹ نفر', duration: '۱۵ تا ۳۰ دقیقه', tone: 'نقش مخفی', icon: MoonStar, accent: 'pink', art: '☾', online: true, availability: 'published', source: 'Jezternz/PlayMafia (MIT)' },
  { id: 'spyfall', title: 'جاسوس', subtitle: 'مکان را کشف کن، بدون لو دادن خودت', players: '۳ تا ۸ نفر', duration: '۸ تا ۱۲ دقیقه', tone: 'نقش مخفی', icon: ShieldQuestion, accent: 'violet', art: '◉', online: false, availability: 'published', source: 'adrianocola/spyfall (MIT)' },
  { id: 'uno', title: 'اونو', subtitle: 'رنگ و عدد درست را سریع بازی کن', players: '۲ تا ۴ نفر', duration: '۶ تا ۱۵ دقیقه', tone: 'کارت و رقابت', icon: Club, accent: 'red', art: '♣', online: false, availability: 'published', source: 'christelbuchanan/UNO-Game (MIT)' },
  { id: 'backgammon', title: 'تخته‌نرد', subtitle: 'تاس بریز و مهره‌ها را خانه کن', players: '۲ نفر', duration: '۱۵ تا ۳۰ دقیقه', tone: 'کلاسیک و تاکتیکی', icon: Dices, accent: 'gold', art: '◈', online: false, availability: 'published', source: 'ifnowcode/gammon (MIT)' },
  { id: 'ludo', title: 'منچ', subtitle: 'مهره‌ها را دور زمین به خانه برسان', players: '۲ تا ۴ نفر', duration: '۱۰ تا ۲۵ دقیقه', tone: 'شانس و رقابت', icon: CircleDotDashed, accent: 'lime', art: '◌', online: false, availability: 'published', source: 'Souma061/Ludo (MIT)' },
  { id: 'codenames', title: 'رمز', subtitle: 'با یک سرنخ، تیم خودت را هدایت کن', players: '۴ تا ۸ نفر', duration: '۱۰ تا ۲۰ دقیقه', tone: 'تیمی و کلمه‌ای', icon: BrainCircuit, accent: 'blue', art: '⌘', online: false, availability: 'published', source: 'IamYVJ/localcodenames (MIT)' },
  { id: 'tic-tac-toe', title: 'دوز کلاسیک', subtitle: 'سه مهره کنار هم بچین', players: '۲ نفر', duration: '۱ تا ۳ دقیقه', tone: 'تمرین سریع', icon: Grid2X2, accent: 'cyan', art: '✕', online: true, availability: 'published', source: 'ramazancetinkaya/tictactoe (MIT)' },
  { id: 'hokm', title: 'حکم با ربات', subtitle: 'کارت پخش کن، حکم را انتخاب کن و دست‌ها را ببر', players: '۱ بازیکن + ۳ ربات', duration: '۱۵ تا ۳۰ دقیقه', tone: 'ورق و تاکتیک', icon: Crown, accent: 'orange', art: '♠', online: false, availability: 'published', source: 'nxrix/joke (MIT)' },
  { id: 'freecell', title: 'فری‌سل کلاسیک', subtitle: 'کارت‌ها را با خانه‌های آزاد به بنیادها برسان', players: 'تک‌نفره', duration: '۵ تا ۲۰ دقیقه', tone: 'نوستالژی ویندوز', icon: Club, accent: 'violet', art: '♧', online: false, availability: 'published', source: 'gitbrent/FreecellJS (MIT)' },
  { id: 'snakes', title: 'مارپله', subtitle: 'نسخهٔ حرفه‌ای جایگزین می‌شود', players: '۲ تا ۸ نفر', duration: '۸ تا ۱۵ دقیقه', tone: 'در حال ارتقا', icon: Dices, accent: 'lime', art: '⌁', online: false, availability: 'upgrade' },
  { id: 'pictionary', title: 'بکش و حدس بزن', subtitle: 'در جست‌وجوی اجرای کامل و آنلاین', players: '۳ تا ۸ نفر', duration: '۱۰ تا ۲۰ دقیقه', tone: 'در حال پژوهش', icon: BrushCleaning, accent: 'orange', art: '✎', online: false, availability: 'research' },
  { id: 'truth-dare', title: 'جرئت یا حقیقت', subtitle: 'تا بازبینی کامل محتوا متوقف است', players: '۲ تا ۸ نفر', duration: 'آزاد', tone: 'محتوا در بازبینی', icon: Sparkles, accent: 'gold', art: '✺', online: true, availability: 'paused' },
  { id: 'connect-four', title: 'چهاردرردیف', subtitle: 'از آرکید پارتی پلی حذف شده است', players: '۲ نفر', duration: '۳ تا ۷ دقیقه', tone: 'حذف‌شده', icon: Columns3, accent: 'cyan', art: '●', online: false, availability: 'removed' },
]

export const publicGameCatalog = gameCatalog.filter((game) => game.availability === 'published')
export const gameById = (id: PartyGameId) => gameCatalog.find((game) => game.id === id) || gameCatalog[0]
export const newGameIds: PartyGameId[] = publicGameCatalog.filter((game) => game.id !== 'mafia' && game.id !== 'tic-tac-toe').map((game) => game.id)
