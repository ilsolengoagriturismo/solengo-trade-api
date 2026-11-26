// =====================================================================
// Edge Function "notifica-oraria" (gira sui server di Supabase).
//
// Due modi di chiamarla:
//  • { "tipo": "orario" }  — dall'orologio del database (pg_cron), ogni
//    ora. Serve l'intestazione x-cron-secret = segreto CRON_SECRET.
//    Manda il promemoria a chi è nella propria fascia di lavoro.
//  • { "tipo": "prova" }   — dal pulsante "Invia notifica di prova".
//    Serve il login dell'utente; manda la notifica solo a lui.
//
// Segreti (Edge Functions → Secrets), oppure nel Vault (migrazione 0004):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY li fornisce Supabase da solo.
//
// Le funzioni "regole" sono pure (niente rete) e hanno test automatici.
// =====================================================================

type Fascia = Record<string, { attivo: boolean; inizio: number; fine: number }>
type Impostazioni = {
  user_id: string
  fuso_orario: string
  fascia: Fascia
  notifiche_attive: boolean
  notifiche_pausa_il: string | null
}

const UN_ORA = 3600 * 1000
const GIORNI = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ---------------------------------------------------------------------
// REGOLE
// ---------------------------------------------------------------------

/**
 * L'ora da chiedere è quella appena conclusa: chiamata alle 14:00 → 13:00.
 * Restituisce inizio (istante esatto) e come appare nel fuso dell'utente.
 */
export function oraDaChiedere(adesso: Date, fuso: string) {
  const inizio = new Date(Math.floor(adesso.getTime() / UN_ORA) * UN_ORA - UN_ORA)
  const parti = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: fuso,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    })
      .formatToParts(inizio)
      .map((p) => [p.type, p.value]),
  )
  return {
    inizio,
    ora: Number(parti.hour), // ora locale di inizio, 0..23
    giornoSettimana: GIORNI.indexOf(parti.weekday), // 0 = domenica
    data: `${parti.year}-${parti.month}-${parti.day}`, // data locale
  }
}

/** Va mandato il promemoria a questo utente per quest'ora? */
export function deveNotificare(imp: Impostazioni, adesso: Date): boolean {
  if (!imp.notifiche_attive) return false
  const o = oraDaChiedere(adesso, imp.fuso_orario || 'Europe/Rome')
  if (imp.notifiche_pausa_il === o.data) return false // "pausa per oggi"
  const f = imp.fascia?.[String(o.giornoSettimana)]
  if (!f?.attivo) return false // giorno di riposo
  return o.ora >= f.inizio && o.ora < f.fine
}

export function testoNotifica(ora: number) {
  const due = (n: number) => String(n % 24).padStart(2, '0')
  return {
    titolo: `${due(ora)}:00 – ${due(ora + 1)}:00`,
    testo: 'Che cosa hai fatto in quest\'ora? Tocca per registrarla.',
  }
}

// ---------------------------------------------------------------------
// SERVIZIO
// ---------------------------------------------------------------------

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function risposta(corpo: unknown, stato = 200) {
  return new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// deno-lint-ignore no-explicit-any
async function gestisci(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // Librerie caricate qui dentro, così i test possono importare le regole.
  const { createClient } = await import('npm:@supabase/supabase-js@2')
  const webpush = (await import('npm:web-push@3.6.7')).default

  const env = (k: string) => Deno.env.get(k) ?? ''
  // Client "amministratore": legge le impostazioni di tutti gli utenti.
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })

  // Segreti: prima quelli della funzione (Edge Functions → Secrets),
  // altrimenti quelli nel Vault (migrazione 0004).
  let vault: Record<string, string> = {}
  if (!env('VAPID_PRIVATE_KEY') || !env('CRON_SECRET')) {
    const { data } = await admin.rpc('segreti_notifiche')
    vault = (data ?? {}) as Record<string, string>
  }
  const segreto = (nomeEnv: string, nomeVault: string) => env(nomeEnv) || vault[nomeVault] || ''
  const vapidPubblica = segreto('VAPID_PUBLIC_KEY', 'vapid_public_key')
  const vapidPrivata = segreto('VAPID_PRIVATE_KEY', 'vapid_private_key')
  const segretoCron = segreto('CRON_SECRET', 'segreto_cron')

  if (!vapidPubblica || !vapidPrivata) {
    return risposta({ errore: 'Mancano le chiavi VAPID (Secrets della funzione o Vault)' }, 500)
  }
  webpush.setVapidDetails(
    segreto('VAPID_SUBJECT', 'vapid_subject') || 'mailto:notifiche@example.com',
    vapidPubblica,
    vapidPrivata,
  )

  const corpo = await req.json().catch(() => ({}))
  const adesso = new Date()

  // deno-lint-ignore no-explicit-any
  async function invia(iscrizione: any, messaggio: Record<string, string>) {
    try {
      await webpush.sendNotification(
        { endpoint: iscrizione.endpoint, keys: { p256dh: iscrizione.p256dh, auth: iscrizione.auth } },
        JSON.stringify(messaggio),
        { TTL: 3600, urgency: 'high' },
      )
      await admin
        .from('push_iscrizioni')
        .update({ ultimo_invio: new Date().toISOString(), ultimo_errore: null })
        .eq('id', iscrizione.id)
      return true
    } catch (e) {
      // deno-lint-ignore no-explicit-any
      const codice = (e as any)?.statusCode
      if (codice === 404 || codice === 410) {
        // iscrizione scaduta (app disinstallata o permesso tolto): la cancello
        await admin.from('push_iscrizioni').delete().eq('id', iscrizione.id)
      } else {
        await admin
          .from('push_iscrizioni')
          .update({ ultimo_errore: `${codice ?? ''} ${String(e)}`.slice(0, 300) })
          .eq('id', iscrizione.id)
      }
      return false
    }
  }

  // ---------- Notifica di prova ----------
  if (corpo.tipo === 'prova') {
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data, error } = await admin.auth.getUser(token)
    if (error || !data.user) return risposta({ errore: 'Login richiesto' }, 401)

    const { data: iscrizioni } = await admin
      .from('push_iscrizioni')
      .select('*')
      .eq('user_id', data.user.id)
    if (!iscrizioni?.length) {
      return risposta({ inviate: 0, errore: 'Nessun telefono iscritto alle notifiche' })
    }
    let inviate = 0
    for (const i of iscrizioni) {
      if (
        await invia(i, {
          titolo: 'Notifica di prova ✓',
          testo: 'Funziona! Tocca qui per aprire la registrazione.',
          url: '/registra',
          tag: 'prova',
        })
      ) inviate++
    }
    return risposta({ inviate, totale: iscrizioni.length })
  }

  // ---------- Promemoria orario (da pg_cron) ----------
  if (!segretoCron || req.headers.get('x-cron-secret') !== segretoCron) {
    return risposta({ errore: 'Non autorizzato' }, 401)
  }

  const { data: utenti, error } = await admin.from('impostazioni').select('*')
  if (error) return risposta({ errore: error.message }, 500)

  let inviate = 0
  let saltati = 0
  for (const imp of utenti as Impostazioni[]) {
    if (!deveNotificare(imp, adesso)) {
      saltati++
      continue
    }
    const o = oraDaChiedere(adesso, imp.fuso_orario || 'Europe/Rome')

    // se l'ora è già stata registrata (in anticipo) non disturbo
    const { count } = await admin
      .from('registrazioni')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', imp.user_id)
      .eq('ora_inizio', o.inizio.toISOString())
    if (count) {
      saltati++
      continue
    }

    const { data: iscrizioni } = await admin
      .from('push_iscrizioni')
      .select('*')
      .eq('user_id', imp.user_id)
    for (const i of iscrizioni ?? []) {
      // protezione da doppio invio se l'orologio scatta due volte (entro 5 minuti)
      if (i.ultimo_invio && adesso.getTime() - new Date(i.ultimo_invio).getTime() < 5 * 60 * 1000) {
        continue
      }
      const { titolo, testo } = testoNotifica(o.ora)
      if (await invia(i, { titolo, testo, url: '/registra', tag: `ora-${o.inizio.toISOString()}` })) {
        inviate++
      }
    }
  }
  return risposta({ inviate, saltati, ora: adesso.toISOString() })
}

// Avvio del servizio (solo su Supabase, non durante i test)
// deno-lint-ignore no-explicit-any
const D = (globalThis as any).Deno
if (D?.serve) D.serve(gestisci)
