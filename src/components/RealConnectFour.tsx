import { Link2, ShieldCheck } from 'lucide-react'

export default function RealConnectFour({ onBack, onFriends }: { onBack: () => void; onFriends: () => void }) {
  const source = `${import.meta.env.BASE_URL}games/connect-four/index.html`

  return <section className="real-game-page" aria-label="چهاردرردیف واقعی">
    <header className="real-game-header">
      <div>
        <span className="eyebrow"><ShieldCheck size={15}/>بازی اصلی منتقل‌شده</span>
        <h1>چهاردرردیف</h1>
        <p>مهره‌های افتان، برد حرفه‌ای و ربات واقعی Minimax برای رقابت فوری.</p>
      </div>
      <div className="real-game-actions">
        <button className="secondary-button" onClick={onBack}>بازگشت به بازی‌ها</button>
        <button className="primary-button" onClick={onFriends}><Link2 size={17}/>اتاق دوستان</button>
      </div>
    </header>
    <div className="real-game-frame-shell real-connect-four-frame-shell">
      <iframe title="چهاردرردیف واقعی" className="real-game-frame real-connect-four-frame" src={source} allow="fullscreen"/>
    </div>
  </section>
}
