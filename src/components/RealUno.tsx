import { Link2, Sparkles } from 'lucide-react'

export default function RealUno({ onBack, onFriends }: { onBack: () => void; onFriends: () => void }) {
  const source = `${import.meta.env.BASE_URL}games/uno/index.html`

  return <section className="real-game-page" aria-label="اونو واقعی">
    <header className="real-game-header">
      <div>
        <span className="eyebrow"><Sparkles size={15}/>بازی اصلی منتقل‌شده</span>
        <h1>اونو</h1>
        <p>کارت‌های متحرک، جلوه‌های صوتی و ربات هوشمند برای یک مسابقهٔ فوری و واقعی.</p>
      </div>
      <div className="real-game-actions">
        <button className="secondary-button" onClick={onBack}>بازگشت به بازی‌ها</button>
        <button className="primary-button" onClick={onFriends}><Link2 size={17}/>اتاق دوستان</button>
      </div>
    </header>
    <div className="real-game-frame-shell real-uno-frame-shell">
      <iframe title="اونو واقعی" className="real-game-frame real-uno-frame" src={source} allow="autoplay"/>
    </div>
  </section>
}
