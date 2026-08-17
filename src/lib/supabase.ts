import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const projectUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/**
 * The public client is created only when deployment configuration is available.
 * Service-role credentials are intentionally never read by the browser application.
 */
export const supabase: SupabaseClient | null = projectUrl && publishableKey
  ? createClient(projectUrl, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export const isSupabaseConfigured = Boolean(supabase)
