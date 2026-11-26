// =====================================================================
// Edge Function "accesso-diretto": entra con il link personale.
//
// Riceve { chiave } (es. "ABCD-EFGH-…"), ne calcola l'impronta sha256,
// la cerca in public.accessi_diretti e, se esiste, crea una sessione per
// l'account dedicato collegato (lo crea al primo uso). Restituisce i
// token della sessione: l'app li usa con supabase.auth.setSession().
// Non manda nessuna email.
// =====================================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const risposta = (corpo: unknown, stato = 200) =>
  new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

/** Normalizza la chiave: niente trattini/spazi, maiuscole. */
export function normalizza(chiave: string) {
  return String(chiave ?? '').replace(/[^0-9a-z]/gi, '').toUpperCase()
}

async function sha256(testo: string) {
  const byte = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(testo))
  return [...new Uint8Array(byte)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function gestisci(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return risposta({ errore: 'Usa POST' }, 405)

  const { createClient } = await import('npm:@supabase/supabase-js@2')
  const env = (k: string) => Deno.env.get(k) ?? ''
  const opzioni = { auth: { persistSession: false, autoRefreshToken: false } }
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), opzioni)

  const corpo = await req.json().catch(() => ({}))
  const chiave = normalizza(corpo.chiave)
  if (chiave.length < 12) return risposta({ errore: 'Codice non valido' }, 400)

  const { data: accesso } = await admin
    .from('accessi_diretti')
    .select('email')
    .eq('chiave_hash', await sha256(chiave))
    .maybeSingle()
  if (!accesso) {
    // piccola attesa contro i tentativi a raffica
    await new Promise((r) => setTimeout(r, 800))
    return risposta({ errore: 'Codice non valido' }, 401)
  }

  // link "magico" generato sul server (nessuna email inviata)
  let link = await admin.auth.admin.generateLink({ type: 'magiclink', email: accesso.email })
  if (link.error) {
    // primo uso: creo l'account dedicato, già confermato
    const nuovo = await admin.auth.admin.createUser({ email: accesso.email, email_confirm: true })
    if (nuovo.error) return risposta({ errore: `Creazione account: ${nuovo.error.message}` }, 500)
    link = await admin.auth.admin.generateLink({ type: 'magiclink', email: accesso.email })
    if (link.error) return risposta({ errore: `Link: ${link.error.message}` }, 500)
  }

  // scambio il link con una sessione vera
  const pubblico = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY') || env('SUPABASE_SERVICE_ROLE_KEY'), opzioni)
  // il tipo atteso dipende dalla versione di Supabase: provo 'email', poi 'magiclink'
  const token_hash = link.data.properties.hashed_token
  let esito = await pubblico.auth.verifyOtp({ token_hash, type: 'email' })
  if (esito.error) {
    // il primo tentativo ha "consumato" il link: ne genero uno nuovo
    const nuovo = await admin.auth.admin.generateLink({ type: 'magiclink', email: accesso.email })
    if (nuovo.error) return risposta({ errore: `Link: ${nuovo.error.message}` }, 500)
    esito = await pubblico.auth.verifyOtp({ token_hash: nuovo.data.properties.hashed_token, type: 'magiclink' })
  }
  const { data, error } = esito
  if (error || !data.session) return risposta({ errore: `Sessione: ${error?.message ?? 'assente'}` }, 500)

  await admin.from('accessi_diretti').update({ ultimo_uso: new Date().toISOString() }).eq('email', accesso.email)

  return risposta({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  })
}

// deno-lint-ignore no-explicit-any
const D = (globalThis as any).Deno
if (D?.serve) D.serve(gestisci)
