import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Mode démo : utilisé quand Supabase n'est pas configuré (prévisualisation locale). */
export const isDemoMode =
  !url || !anonKey || url.includes('changeme') || anonKey.includes('remplacer') || !url.startsWith('https://')

export const supabase =
  isDemoMode ? null : createClient(url as string, anonKey as string)
