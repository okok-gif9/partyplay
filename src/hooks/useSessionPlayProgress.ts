import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PartyGameId } from '../data/gameCatalog'

export type SessionGameId = PartyGameId
export type MedalId = 'first_move' | 'card_spark' | 'night_detective'

export type SessionMedal = {
  id: MedalId
  game: SessionGameId
  title: string
  description: string
  icon: string
  accent: 'cyan' | 'gold' | 'lime' | 'pink'
}

type StoredProgress = {
  started: Partial<Record<SessionGameId, boolean>>
  medals: MedalId[]
}

const STORAGE_KEY = 'partyplay-session-progress-v1'

export const sessionMedals: SessionMedal[] = [
  { id: 'first_move', game: 'tic-tac-toe', title: 'حرکت اول', description: 'اولین مهرهٔ دوز را گذاشتی.', icon: '✕', accent: 'cyan' },
  { id: 'card_spark', game: 'truth-dare', title: 'جادوی کارت', description: 'اولین کارت را انجام دادی.', icon: '✦', accent: 'gold' },
  { id: 'night_detective', game: 'mafia', title: 'کارآگاه شب', description: 'اولین رأی مافیایی‌ات را ثبت کردی.', icon: '◈', accent: 'pink' },
]

const medalForGame = (game: SessionGameId) => sessionMedals.find((medal) => medal.game === game)!

const loadProgress = (): StoredProgress => {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { started: {}, medals: [] }
    const parsed = JSON.parse(raw) as StoredProgress
    return { started: parsed.started || {}, medals: parsed.medals || [] }
  } catch {
    return { started: {}, medals: [] }
  }
}

export function useSessionPlayProgress() {
  const [progress, setProgress] = useState<StoredProgress>(loadProgress)
  const [newMedal, setNewMedal] = useState<SessionMedal | null>(null)

  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
    } catch {
      // The visual layer remains usable if browser storage is unavailable.
    }
  }, [progress])

  const markStarted = useCallback((game: SessionGameId) => {
    setProgress((current) => current.started[game] ? current : { ...current, started: { ...current.started, [game]: true } })
  }, [])

  const markAction = useCallback((game: SessionGameId) => {
    const medal = medalForGame(game)
    setProgress((current) => {
      const started = { ...current.started, [game]: true }
      if (current.medals.includes(medal.id)) return { ...current, started }
      setNewMedal(medal)
      return { started, medals: [...current.medals, medal.id] }
    })
  }, [])

  const earnedMedals = useMemo(() => sessionMedals.filter((medal) => progress.medals.includes(medal.id)), [progress.medals])
  const dismissMedal = useCallback(() => setNewMedal(null), [])

  return { started: progress.started, earnedMedals, newMedal, markStarted, markAction, dismissMedal }
}
