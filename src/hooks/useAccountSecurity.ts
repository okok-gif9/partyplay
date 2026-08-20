import { useCallback, useEffect, useState } from 'react'
import {
  getAccountSecurityState,
  requestAccountDeletion,
  restoreAccountAfterSignIn,
  type AccountSecurityState,
} from '../lib/partyplay'
import { supabase } from '../lib/supabase'

const passwordError = (password: string, confirmation: string) => {
  if (password.length < 8) return 'رمز باید دست‌کم ۸ نویسه داشته باشد.'
  if (password !== confirmation) return 'تکرار رمز با رمز جدید یکسان نیست.'
  return ''
}

export function useAccountSecurity() {
  const [state, setState] = useState<AccountSecurityState | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      return null
    }
    setLoading(true)
    setError(null)
    try {
      const nextState = await getAccountSecurityState()
      setState(nextState)
      return nextState
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'وضعیت امنیت حساب بارگذاری نشد.'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    if (!supabase) return
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) void refresh()
      else setState(null)
    })
    return () => listener.subscription.unsubscribe()
  }, [refresh])

  const setPassword = useCallback(async (password: string, confirmation: string) => {
    const validationError = passwordError(password, confirmation)
    if (validationError) throw new Error(validationError)
    if (!supabase) throw new Error('اتصال Supabase در این نسخه تنظیم نشده است.')
    setBusy(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
    } finally {
      setBusy(false)
    }
  }, [])

  const restore = useCallback(async () => {
    setBusy(true)
    try {
      const nextState = await restoreAccountAfterSignIn()
      setState(nextState)
      return nextState
    } finally {
      setBusy(false)
    }
  }, [])

  const scheduleDeletion = useCallback(async (confirmation: string) => {
    setBusy(true)
    try {
      const nextState = await requestAccountDeletion(confirmation)
      setState(nextState)
      return nextState
    } finally {
      setBusy(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    setBusy(true)
    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError
    } finally {
      setBusy(false)
    }
  }, [])

  return { state, loading, busy, error, refresh, setPassword, restore, scheduleDeletion, signOut }
}
