import { Link2, ShieldCheck } from 'lucide-react'

export default function RealTicTacToe({ onBack, onFriends }: { onBack: () => void; onFriends: () => void }) {
  const source = `${import.meta.env.BASE_URL}games/tic-tac-toe/index.html`

  return <section className="real-game-page" aria-label="دوز کلاسیک واقعی">
    <header className="real-game-header">
      <div>
        <span className="eyebrow"><ShieldCheck size={15}/>بازی اصلی منتقل‌شده</span>
        <h1>دوز کلاسیک</h1>
        <p>نسخهٔ کامل با انتخاب مهره، سه درجهٔ دشواری، ربات، امتیازدهی و دورهای متوالی.</p>
      </div>
      <div className="real-game-actions">
        <button className="secondary-button" onClick={onBack}>بازگشت به بازی‌ها</button>
        <button className="primary-button" onClick={onFriends}><Link2 size={17}/>اتاق دوستان</button>
      </div>
    </header>
    <div className="real-game-frame-shell">
      <iframe title="دوز کلاسیک واقعی" className="real-game-frame" src={source} allow="fullscreen"/>
    </div>
  </section>
}
