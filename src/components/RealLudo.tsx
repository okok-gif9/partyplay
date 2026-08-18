import { Link2, ShieldCheck } from 'lucide-react'

export default function RealLudo({ onBack, onFriends }: { onBack: () => void; onFriends: () => void }) {
  const source = `${import.meta.env.BASE_URL}games/ludo/index.html`

  return <section className="real-game-page" aria-label="منچ واقعی">
    <header className="real-game-header">
      <div>
        <span className="eyebrow"><ShieldCheck size={15}/>بازی اصلی منتقل‌شده</span>
        <h1>منچ</h1>
        <p>برد گرافیکی، تاس سه‌بعدی، تا چهار بازیکن و حریف ربات برای شروع فوری.</p>
      </div>
      <div className="real-game-actions">
        <button className="secondary-button" onClick={onBack}>بازگشت به بازی‌ها</button>
        <button className="primary-button" onClick={onFriends}><Link2 size={17}/>اتاق دوستان</button>
      </div>
    </header>
    <div className="real-game-frame-shell real-ludo-frame-shell">
      <iframe title="منچ واقعی" className="real-game-frame real-ludo-frame" src={source} allow="fullscreen"/>
    </div>
  </section>
}
