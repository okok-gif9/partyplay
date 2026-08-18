import { Link2, ScanSearch } from 'lucide-react'

export default function RealSpyfall({ onBack, onFriends }: { onBack: () => void; onFriends: () => void }) {
  const source = `${import.meta.env.BASE_URL}games/spyfall/index.html`

  return <section className="real-game-page" aria-label="جاسوس واقعی">
    <header className="real-game-header">
      <div>
        <span className="eyebrow"><ScanSearch size={15}/>بازی اصلی منتقل‌شده</span>
        <h1>جاسوس</h1>
        <p>نقش مخفی، پاس‌دادن امن گوشی، رأی‌گیری، امتیازدهی راندی و بیش از ۱۰۰ واژهٔ فارسی.</p>
      </div>
      <div className="real-game-actions">
        <button className="secondary-button" onClick={onBack}>بازگشت به بازی‌ها</button>
        <button className="primary-button" onClick={onFriends}><Link2 size={17}/>اتاق دوستان</button>
      </div>
    </header>
    <div className="real-game-frame-shell real-spyfall-frame-shell">
      <iframe title="جاسوس واقعی" className="real-game-frame real-spyfall-frame" src={source}/>
    </div>
  </section>
}
