// =====================================================================
// Struttura dell'app: login → (scarica dati) → schermate con menu in basso.
// Le schermate sono indirizzi veri: /registra, /giornata, /impostazioni.
// =====================================================================
import { useEffect, useState } from 'react'
import { supabase, configurato } from './lib/supabase.js'
import * as archivio from './lib/archivio.js'
import { usaArchivio } from './lib/usaArchivio.js'
import { aggiungiGiorni, inizioGiorno } from './lib/ore.js'
import { vaiA } from './lib/navigazione.js'
import Login from './schermate/Login.jsx'
import Registra from './schermate/Registra.jsx'
import Giornata from './schermate/Giornata.jsx'
import Impostazioni from './schermate/Impostazioni.jsx'

const PAGINE = {
  '/registra': { titolo: 'Registra', icona: '⏱️', Componente: Registra },
  '/giornata': { titolo: 'Giornata', icona: '📅', Componente: Giornata },
  '/impostazioni': { titolo: 'Impostazioni', icona: '⚙️', Componente: Impostazioni },
}

function percorsoAttuale() {
  return PAGINE[window.location.pathname] ? window.location.pathname : '/registra'
}

/** Scarica dal database i dati recenti (se c'è rete). */
async function aggiorna() {
  try {
    await archivio.sincronizza()
    await archivio.scaricaConfigurazione()
    const oggi = inizioGiorno(new Date())
    await archivio.scaricaRegistrazioni(aggiungiGiorni(oggi, -3), aggiungiGiorni(oggi, 1))
  } catch {
    // offline: usiamo i dati salvati sul telefono
  }
}

export default function App() {
  const [sessione, setSessione] = useState(undefined) // undefined = sto controllando
  const [percorso, setPercorso] = useState(percorsoAttuale())
  const [online, setOnline] = useState(navigator.onLine)
  const stato = usaArchivio()

  // --- login / logout ---
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSessione(data.session))
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSessione(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const idUtente = sessione?.user?.id
  useEffect(() => {
    if (!idUtente) {
      archivio.ferma()
      return
    }
    archivio.avvia(idUtente)
    aggiorna()
  }, [idUtente])

  // --- rete e ritorno in primo piano: sincronizza ---
  useEffect(() => {
    const suOnline = () => {
      setOnline(true)
      aggiorna()
    }
    const suOffline = () => setOnline(false)
    const suVisibile = () => document.visibilityState === 'visible' && aggiorna()
    const suIndietro = () => setPercorso(percorsoAttuale())
    window.addEventListener('online', suOnline)
    window.addEventListener('offline', suOffline)
    document.addEventListener('visibilitychange', suVisibile)
    window.addEventListener('popstate', suIndietro)
    return () => {
      window.removeEventListener('online', suOnline)
      window.removeEventListener('offline', suOffline)
      document.removeEventListener('visibilitychange', suVisibile)
      window.removeEventListener('popstate', suIndietro)
    }
  }, [])

  if (!configurato) return <ConfigurazioneMancante />
  if (sessione === undefined) return <div className="caricamento">Caricamento…</div>
  if (!sessione) return <Login />
  if (!stato.categorie.length) {
    return (
      <div className="caricamento">
        {online ? 'Preparo le tue categorie…' : 'Serve la rete per il primo avvio.'}
      </div>
    )
  }

  const { Componente } = PAGINE[percorso]
  return (
    <div className="app">
      <BarraStato online={online} stato={stato} />
      <main className="contenuto">
        <Componente utente={sessione.user} />
      </main>
      <nav className="menu">
        {Object.entries(PAGINE).map(([p, { titolo, icona }]) => (
          <button
            key={p}
            className={p === percorso ? 'attivo' : ''}
            onClick={() => vaiA(p)}
          >
            <span aria-hidden>{icona}</span>
            {titolo}
          </button>
        ))}
      </nav>
    </div>
  )
}

/** Avvisi in alto: offline, ore in attesa di invio, errori. */
function BarraStato({ online, stato }) {
  if (stato.errore) {
    return (
      <div className="avviso errore" onClick={archivio.cancellaErrore}>
        {stato.errore} (tocca per chiudere)
      </div>
    )
  }
  if (!online) {
    return (
      <div className="avviso">
        Sei offline: salvo sul telefono
        {stato.coda.length ? ` (${stato.coda.length} da inviare)` : ''}
      </div>
    )
  }
  if (stato.coda.length) {
    return <div className="avviso">Invio {stato.coda.length} ore al server…</div>
  }
  return null
}

function ConfigurazioneMancante() {
  return (
    <div className="pagina-centrale">
      <h1>Manca la configurazione</h1>
      <p>
        L'app non sa a quale database Supabase collegarsi. Imposta le variabili{' '}
        <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> (vedi il README,
        passo 3) e pubblica di nuovo.
      </p>
    </div>
  )
}
