import { DotLottieReact } from '@lottiefiles/dotlottie-react'

const powerButtonMotion = `${import.meta.env.BASE_URL}assets/motion/power-button.lottie`

export function LaunchGlyph() {
  return (
    <span className="launch-glyph" aria-hidden="true">
      <DotLottieReact src={powerButtonMotion} autoplay loop={false} />
    </span>
  )
}
