import { Club, ArrowLeft } from 'lucide-react'
import { useLanguage } from '../i18n'

export default function RealFreecell({ onBack }: { onBack: () => void }) {
  const { language } = useLanguage()
  const isFa = language === 'fa'
  const source = `${import.meta.env.BASE_URL}games/freecell/index.html`

  return <section className="real-game-page" aria-label={isFa ? 'فری‌سل کلاسیک' : 'Classic FreeCell'}>
    <header className="real-game-header">
      <div>
        <span className="eyebrow"><Club size={15}/>{isFa ? 'بازی اصلی منتقل‌شده' : 'PORTED FULL GAME'}</span>
        <h1>{isFa ? 'فری‌سل کلاسیک' : 'Classic FreeCell'}</h1>
        <p>{isFa ? 'یک بازی کامل و تک‌نفرهٔ ورق با خانه‌های آزاد، ستون‌ها، راهنما و تنظیمات.' : 'A complete single-player card game with free cells, tableau columns, instructions, and options.'}</p>
      </div>
      <div className="real-game-actions">
        <button className="secondary-button" onClick={onBack}><ArrowLeft size={17}/>{isFa ? 'بازگشت به بازی‌ها' : 'Back to games'}</button>
      </div>
    </header>
    <div className="real-game-frame-shell real-freecell-frame-shell">
      <iframe title={isFa ? 'فری‌سل کلاسیک' : 'Classic FreeCell'} className="real-game-frame real-freecell-frame" src={source}/>
    </div>
  </section>
}
