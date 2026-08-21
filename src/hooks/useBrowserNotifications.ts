import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadNotificationPreferences, removePushSubscription, savePushSubscription, updateNotificationPreferences, type NotificationCategory, type NotificationPreferences } from '../lib/partyplay'

const publicVapidKey = import.meta.env.VITE_PARTYPLAY_WEB_PUSH_PUBLIC_KEY as string | undefined

const urlBase64ToUint8Array = (value: string) => {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const normalized = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const decoded = atob(normalized)
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0))
}

const browserCapable = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export function useBrowserNotifications() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [permission, setPermission] = useState<NotificationPermission>(() => typeof Notification === 'undefined' ? 'default' : Notification.permission)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isSupported = typeof window !== 'undefined' && browserCapable()
  const isConfigured = Boolean(publicVapidKey)

  const serviceWorker = useCallback(async () => {
    if (!isSupported) throw new Error('BROWSER_NOT_SUPPORTED')
    return navigator.serviceWorker.register(`${import.meta.env.BASE_URL}partyplay-sw.js`, { scope: import.meta.env.BASE_URL })
  }, [isSupported])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const next = await loadNotificationPreferences()
      setPreferences(next)
      setPermission(Notification.permission)
      if (isSupported) {
        const registration = await serviceWorker()
        const subscription = await registration.pushManager.getSubscription()
        setSubscribed(Boolean(subscription))
      }
      setError('')
      return next
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'NOTIFICATION_LOAD_FAILED'
      setError(message)
      return null
    } finally { setLoading(false) }
  }, [isSupported, serviceWorker])

  useEffect(() => { void refresh() }, [refresh])

  const enableBrowserNotifications = useCallback(async () => {
    if (!isSupported) throw new Error('BROWSER_NOT_SUPPORTED')
    if (!isConfigured) throw new Error('WEB_PUSH_NOT_CONFIGURED')
    setLoading(true)
    try {
      const nextPermission = await Notification.requestPermission()
      setPermission(nextPermission)
      if (nextPermission !== 'granted') throw new Error('BROWSER_PERMISSION_DENIED')
      const registration = await serviceWorker()
      const current = await registration.pushManager.getSubscription()
      const subscription = current || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicVapidKey!) })
      await savePushSubscription(subscription)
      const next = await updateNotificationPreferences({ browserEnabled: true })
      setPreferences(next); setSubscribed(true); setError('')
      return next
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'BROWSER_NOTIFICATION_FAILED'
      setError(message)
      throw cause
    } finally { setLoading(false) }
  }, [isConfigured, isSupported, serviceWorker])

  const disableBrowserNotifications = useCallback(async () => {
    setLoading(true)
    try {
      if (isSupported) {
        const registration = await serviceWorker()
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          await removePushSubscription(subscription.endpoint)
          await subscription.unsubscribe()
        }
      }
      const next = await updateNotificationPreferences({ browserEnabled: false })
      setPreferences(next); setSubscribed(false); setError('')
      return next
    } finally { setLoading(false) }
  }, [isSupported, serviceWorker])

  const setCategory = useCallback(async (category: NotificationCategory, enabled: boolean) => {
    const current = preferences || await loadNotificationPreferences()
    const next = await updateNotificationPreferences({ categories: { ...current.categories, [category]: enabled } })
    setPreferences(next); setError('')
    return next
  }, [preferences])

  return useMemo(() => ({
    preferences,
    permission,
    subscribed,
    loading,
    error,
    isSupported,
    isConfigured,
    refresh,
    enableBrowserNotifications,
    disableBrowserNotifications,
    setCategory,
  }), [preferences, permission, subscribed, loading, error, isSupported, isConfigured, refresh, enableBrowserNotifications, disableBrowserNotifications, setCategory])
}
