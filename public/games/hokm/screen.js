(() => {
  const setViewportVariables = () => {
    const root = document.documentElement
    const width = window.innerWidth
    const height = window.innerHeight
    root.style.setProperty('--vw', `${width}px`)
    root.style.setProperty('--vh', `${height}px`)
    root.style.setProperty('--vmin', `${Math.min(width, height)}px`)
  }

  setViewportVariables()
  window.addEventListener('resize', setViewportVariables, { passive: true })
})()
