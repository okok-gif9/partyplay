import { KeyRound, Link2 } from 'lucide-react'

export default function RealCodenames({ onBack, onFriends }: { onBack: () => void; onFriends: () => void }) {
  const source = `${import.meta.env.BASE_URL}games/codenames/index.html`

  return <section className="real-game-page" aria-label="رمز واقعی">
    <header className="real-game-header">
      <div>
        <span className="eyebrow"><KeyRound size={15}/>بازی اصلی منتقل‌شده</span>
        <h1>رمز</h1>
        <p>برد استاندارد ۲۵ کارتی، کلید محرمانه، قاتل مخفی و کد دعوت مشترک برای تیم‌ها.</p>
      </div>
      <div className="real-game-actions">
        <button className="secondary-button" onClick={onBack}>بازگشت به بازی‌ها</button>
        <button className="primary-button" onClick={onFriends}><Link2 size={17}/>اتاق دوستان</button>
      </div>
    </header>
    <div className="real-game-frame-shell real-codenames-frame-shell">
      <iframe title="رمز واقعی" className="real-game-frame real-codenames-frame" src={source}/>
    </div>
  </section>
}
