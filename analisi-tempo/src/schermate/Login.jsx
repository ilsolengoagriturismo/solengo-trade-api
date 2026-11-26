// =====================================================================
// Accesso. Due modi:
//  1. EMAIL E PASSWORD (consigliato): funziona sempre, anche dall'app
//     installata sulla Home dell'iPhone, senza aspettare mail.
//  2. LINK / CODICE VIA EMAIL: comodo da Safari. Se l'app è installata
//     sulla Home, il link della mail si apre in Safari (che per Apple è
//     un'app separata): per questo si può scrivere il CODICE della mail,
//     se il modello della mail lo contiene (README, passo 4).
// =====================================================================
import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { entraConChiave } from '../lib/accessoDiretto.js'

export default function Login() {
  const [modo, setModo] = useState('codice') // 'codice' | 'password' | 'link'
  const [email, setEmail] = useState(() => localStorage.getItem('analisi-tempo.email') ?? '')
  const [messaggio, setMessaggio] = useState(null) // { testo, ok }
  const [attesa, setAttesa] = useState(false)

  function ricordaEmail() {
    localStorage.setItem('analisi-tempo.email', email.trim())
  }

  return (
    <div className="pagina-centrale">
      <h1>Il mio tempo</h1>
      <p className="sottotitolo">Un'analisi del proprio tempo, un'ora alla volta.</p>

      <div className="schede" role="tablist">
        <button
          role="tab"
          className={modo === 'codice' ? 'scelta' : ''}
          onClick={() => {
            setModo('codice')
            setMessaggio(null)
          }}
        >
          Codice personale
        </button>
        <button
          role="tab"
          className={modo === 'password' ? 'scelta' : ''}
          onClick={() => {
            setModo('password')
            setMessaggio(null)
          }}
        >
          Password
        </button>
        <button
          role="tab"
          className={modo === 'link' ? 'scelta' : ''}
          onClick={() => {
            setModo('link')
            setMessaggio(null)
          }}
        >
          Link email
        </button>
      </div>

      {modo === 'codice' ? (
        <AccessoCodice attesa={attesa} setAttesa={setAttesa} setMessaggio={setMessaggio} />
      ) : modo === 'password' ? (
        <AccessoPassword
          email={email}
          setEmail={setEmail}
          ricordaEmail={ricordaEmail}
          attesa={attesa}
          setAttesa={setAttesa}
          setMessaggio={setMessaggio}
        />
      ) : (
        <AccessoLink
          email={email}
          setEmail={setEmail}
          ricordaEmail={ricordaEmail}
          attesa={attesa}
          setAttesa={setAttesa}
          setMessaggio={setMessaggio}
        />
      )}

      {messaggio && (
        <p className={messaggio.ok ? 'messaggio-ok' : 'messaggio-errore'}>{messaggio.testo}</p>
      )}
    </div>
  )
}

function CampoEmail({ email, setEmail }) {
  return (
    <label>
      Email
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
    </label>
  )
}

// ---------------------------------------------------------------------
// Codice personale (lo stesso del link personale): niente email.
function AccessoCodice({ attesa, setAttesa, setMessaggio }) {
  const [codice, setCodice] = useState('')
  async function invia(e) {
    e.preventDefault()
    setAttesa(true)
    setMessaggio(null)
    try {
      await entraConChiave(codice)
    } catch (err) {
      setMessaggio({ testo: err.message })
    }
    setAttesa(false)
  }
  return (
    <form onSubmit={invia} className="modulo">
      <label>
        Codice personale
        <input
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          placeholder="ABCD-EFGH-JKLM-NPQR"
          value={codice}
          onChange={(e) => setCodice(e.target.value.toUpperCase())}
        />
      </label>
      <button className="primario" disabled={attesa || codice.replace(/[^A-Z0-9]/g, '').length < 12}>
        {attesa ? 'Entro…' : 'Entra'}
      </button>
      <p className="piccolo">
        È il codice del tuo link personale. Basta scriverlo una volta per telefono: poi l'app si
        ricorda di te.
      </p>
    </form>
  )
}

// ---------------------------------------------------------------------
function AccessoPassword({ email, setEmail, ricordaEmail, attesa, setAttesa, setMessaggio }) {
  const [nuovo, setNuovo] = useState(false) // true = creo l'account
  const [password, setPassword] = useState('')

  async function invia(e) {
    e.preventDefault()
    setAttesa(true)
    setMessaggio(null)
    ricordaEmail()
    if (nuovo) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin + '/registra' },
      })
      setAttesa(false)
      if (error) return setMessaggio({ testo: traduci(error.message) })
      if (!data.session) {
        // il progetto chiede di confermare l'indirizzo
        setNuovo(false)
        return setMessaggio({
          ok: true,
          testo:
            'Account creato. Apri la mail di conferma e tocca il link (anche se poi si apre un altro sito va bene): poi torna qui ed entra con email e password.',
        })
      }
      return // sessione attiva: l'app si apre da sola
    }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setAttesa(false)
    if (error) setMessaggio({ testo: traduci(error.message) })
  }

  return (
    <form onSubmit={invia} className="modulo">
      <CampoEmail email={email} setEmail={setEmail} />
      <label>
        Password {nuovo && <small>(almeno 8 caratteri)</small>}
        <input
          type="password"
          autoComplete={nuovo ? 'new-password' : 'current-password'}
          required
          minLength={nuovo ? 8 : 1}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <button className="primario" disabled={attesa}>
        {attesa ? 'Attendi…' : nuovo ? 'Crea account' : 'Entra'}
      </button>
      <button type="button" className="link" onClick={() => setNuovo(!nuovo)}>
        {nuovo ? 'Ho già un account: entra' : 'Primo accesso? Crea il tuo account'}
      </button>
    </form>
  )
}

// ---------------------------------------------------------------------
function AccessoLink({ email, setEmail, ricordaEmail, attesa, setAttesa, setMessaggio }) {
  const [inviata, setInviata] = useState(false)
  const [codice, setCodice] = useState('')

  async function inviaLink(e) {
    e.preventDefault()
    setAttesa(true)
    setMessaggio(null)
    ricordaEmail()
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + '/registra' },
    })
    setAttesa(false)
    if (error) setMessaggio({ testo: traduci(error.message) })
    else setInviata(true)
  }

  async function verificaCodice(e) {
    e.preventDefault()
    setAttesa(true)
    setMessaggio(null)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: codice.trim(),
      type: 'email',
    })
    setAttesa(false)
    if (error) setMessaggio({ testo: traduci(error.message) })
  }

  if (!inviata) {
    return (
      <form onSubmit={inviaLink} className="modulo">
        <CampoEmail email={email} setEmail={setEmail} />
        <button className="primario" disabled={attesa}>
          {attesa ? 'Invio…' : 'Mandami il link di accesso'}
        </button>
      </form>
    )
  }
  return (
    <form onSubmit={verificaCodice} className="modulo">
      <p>
        Ti ho mandato una mail a <b>{email}</b>. Tocca il link, oppure scrivi qui il codice se la
        mail ne contiene uno.
      </p>
      <label>
        Codice
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={10}
          value={codice}
          onChange={(e) => setCodice(e.target.value.replace(/\D/g, ''))}
        />
      </label>
      <button className="primario" disabled={attesa || codice.length < 6}>
        {attesa ? 'Verifico…' : 'Entra'}
      </button>
      <button type="button" className="link" onClick={() => setInviata(false)}>
        Cambia email o rimanda la mail
      </button>
    </form>
  )
}

function traduci(m) {
  if (/invalid login credentials/i.test(m)) return 'Email o password sbagliate.'
  if (/already registered|already exists/i.test(m)) return 'Esiste già un account con questa email: entra con la tua password.'
  if (/email not confirmed/i.test(m)) return 'Devi prima confermare l\'email: apri la mail di conferma e tocca il link.'
  if (/password/i.test(m) && /least|short|weak/i.test(m)) return 'Password troppo corta o semplice: usa almeno 8 caratteri.'
  if (/signups? not allowed|disabled/i.test(m)) return 'La registrazione di nuovi account è disattivata su questo progetto Supabase.'
  if (/rate limit|seconds/i.test(m)) return 'Troppe richieste: aspetta un minuto e riprova.'
  if (/expired|invalid/i.test(m)) return 'Codice scaduto o sbagliato. Fatti mandare una nuova mail.'
  if (/fetch|network/i.test(m)) return 'Nessuna connessione. Riprova quando c\'è rete.'
  return m
}
