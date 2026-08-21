import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { en, type Translation } from './en'
import { fa } from './fa'

export type AppLanguage = 'fa' | 'en'
export type LanguagePreference = AppLanguage | 'system'
export type TextKey = keyof Translation

const LANGUAGE_STORAGE_KEY = 'partyplay-language'
const dictionaries: Record<AppLanguage, Translation> = { en, fa }

type LanguageContextValue = {
  language: AppLanguage
  dir: 'rtl' | 'ltr'
  preference: LanguagePreference
  setPreference: (preference: LanguagePreference) => void
  t: Translation
  format: (template: string, values?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function getSystemLanguage(): AppLanguage {
  if (typeof navigator === 'undefined') return 'en'
  return navigator.language.toLowerCase().startsWith('fa') ? 'fa' : 'en'
}

function readPreference(): LanguagePreference {
  if (typeof window === 'undefined') return 'system'
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  return stored === 'fa' || stored === 'en' || stored === 'system' ? stored : 'system'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [preference, setStoredPreference] = useState<LanguagePreference>(readPreference)
  const [systemLanguage, setSystemLanguage] = useState<AppLanguage>(getSystemLanguage)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleLanguageFocus = () => setSystemLanguage(getSystemLanguage())
    const handleMediaChange = () => setSystemLanguage(getSystemLanguage())
    window.addEventListener('focus', handleLanguageFocus)
    media.addEventListener('change', handleMediaChange)
    return () => {
      window.removeEventListener('focus', handleLanguageFocus)
      media.removeEventListener('change', handleMediaChange)
    }
  }, [])

  const language = preference === 'system' ? systemLanguage : preference
  const dir = language === 'fa' ? 'rtl' : 'ltr'

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = dir
    document.title = language === 'fa' ? 'پارتی پلی | بازی گروهی آنلاین' : 'PartyPlay | Online Group Games'
  }, [dir, language])

  const setPreference = useCallback((nextPreference: LanguagePreference) => {
    setStoredPreference(nextPreference)
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextPreference)
  }, [])

  const format = useCallback((template: string, values: Record<string, string | number> = {}) => (
    template.replace(/\{(\w+)\}/g, (_match, key: string) => String(values[key] ?? `{${key}}`))
  ), [])

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    dir,
    preference,
    setPreference,
    t: dictionaries[language],
    format,
  }), [dir, format, language, preference, setPreference])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider')
  return context
}
