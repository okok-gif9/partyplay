import { Club, ArrowLeft } from 'lucide-react'
import { useLanguage } from '../i18n'

export default function RealHokm({ onBack }: { onBack: () => void }) {
  const { language } = useLanguage()
  const isFa = language === 'fa'
  const source = `${import.meta.env.BASE_URL}games/hokm/index.html`

  return <section className="real-game-page" aria-label={isFa ? 'حکم با ربات' : 'Hokm with bots'}>
    <header className="real-game-header">
      <div>
        <span className="eyebrow"><Club size={15}/>{isFa ? 'بازی اصلی منتقل‌شده' : 'PORTED FULL GAME'}</span>
        <h1>{isFa ? 'حکم با ربات' : 'Hokm with bots'}</h1>
        <p>{isFa ? 'بازی کامل چهار نفره با پخش کارت، انتخاب حکم، دنبال‌کردن خال و سه ربات داخلی.' : 'A complete four-player game with dealing, trump selection, suit-following rules, and three built-in bots.'}</p>
      </div>
      <div className="real-game-actions">
        <button className="secondary-button" onClick={onBack}><ArrowLeft size={17}/>{isFa ? 'بازگشت به بازی‌ها' : 'Back to games'}</button>
      </div>
    </header>
    <div className="real-game-frame-shell real-hokm-frame-shell">
      <iframe title={isFa ? 'حکم با ربات' : 'Hokm with bots'} className="real-game-frame real-hokm-frame" src={source}/>
    </div>
  </section>
}
