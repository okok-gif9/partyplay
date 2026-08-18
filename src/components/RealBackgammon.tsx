import { Dices, Link2 } from 'lucide-react'

export default function RealBackgammon({ onBack, onFriends }: { onBack: () => void; onFriends: () => void }) {
  const source = `${import.meta.env.BASE_URL}games/backgammon/index.html`

  return <section className="real-game-page" aria-label="تخته‌نرد واقعی">
    <header className="real-game-header">
      <div>
        <span className="eyebrow"><Dices size={15}/>بازی اصلی منتقل‌شده</span>
        <h1>تخته‌نرد</h1>
        <p>برد Canvas حرفه‌ای، قوانین واقعی، تاس، زدن مهره و ربات با انتخاب تم دلخواه.</p>
      </div>
      <div className="real-game-actions">
        <button className="secondary-button" onClick={onBack}>بازگشت به بازی‌ها</button>
        <button className="primary-button" onClick={onFriends}><Link2 size={17}/>اتاق دوستان</button>
      </div>
    </header>
    <div className="real-game-frame-shell real-backgammon-frame-shell">
      <iframe title="تخته‌نرد واقعی" className="real-game-frame real-backgammon-frame" src={source}/>
    </div>
  </section>
}
