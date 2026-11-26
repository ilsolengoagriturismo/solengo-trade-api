// Collegamento a Supabase. URL e chiave pubblica arrivano dalle variabili
// d'ambiente (file .env.local in locale, impostazioni del progetto su Vercel).
// La chiave "anon" è pubblica per natura: i dati sono protetti dalla
// Row Level Security del database, non dal segreto della chiave.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const chiave = import.meta.env.VITE_SUPABASE_ANON_KEY

export const configurato = Boolean(url && chiave)

export const supabase = configurato
  ? createClient(url, chiave, {
      auth: {
        persistSession: true, // resta collegato anche chiudendo l'app
        autoRefreshToken: true,
        detectSessionInUrl: true, // gestisce il ritorno dal magic link
        flowType: 'implicit',
      },
    })
  : null
