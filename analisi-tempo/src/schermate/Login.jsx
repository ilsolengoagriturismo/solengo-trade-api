// =====================================================================
// Accesso con link via email.
// ATTENZIONE iPhone: se l'app è installata sulla Home, il link della mail
// si apre in Safari, che per Apple è un'app separata. Per questo la mail
// contiene anche un CODICE da scrivere qui: è il modo affidabile per
// entrare nell'app installata. (Il README spiega come attivare il codice.)
// =====================================================================
import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function Login() {
  const [email, setEmail] = useState(() => localStorage.getItem('analisi-tempo.email') ?? '')
  const [inviata, setInviata] = useState(false)
  const [codice, setCodice] = useState('')
  const [messaggio, setMessaggio] = useState('')
  const [attesa, setAttesa] = useState(false)

  async function inviaLink(e) {
    e.preventDefault()
    setAttesa(true)
    setMessaggio('')
    localStorage.setItem('analisi-tempo.email', email.trim())
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + '/registra' },
    })
    setAttesa(false)
    if (error) setMessaggio(traduci(error.message))
    else setInviata(true)
  }

  async function verificaCodice(e) {
    e.preventDefault()
    setAttesa(true)
    setMessaggio('')
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: codice.trim(),
      type: 'email',
    })
    setAttesa(false)
    if (error) setMessaggio(traduci(error.message))
  }

  return (
    <div className="pagina-centrale">
      <h1>Il mio tempo</h1>
      <p className="sottotitolo">Un'analisi del proprio tempo, un'ora alla volta.</p>

      {!inviata ? (
        <form onSubmit={inviaLink} className="modulo">
          <label>
            La tua email
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button className="primario" disabled={attesa}>
            {attesa ? 'Invio…' : 'Mandami il link di accesso'}
          </button>
        </form>
      ) : (
        <form onSubmit={verificaCodice} className="modulo">
          <p>
            Ti ho mandato una mail a <b>{email}</b>.
          </p>
          <p className="piccolo">
            Se usi l'app dalla Home dell'iPhone, <b>scrivi qui il codice</b> che trovi nella mail
            (il link aprirebbe Safari invece dell'app).
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
      )}
      {messaggio && <p className="messaggio-errore">{messaggio}</p>}
    </div>
  )
}

function traduci(m) {
  if (/rate limit|seconds/i.test(m)) return 'Troppe richieste: aspetta un minuto e riprova.'
  if (/expired|invalid/i.test(m)) return 'Codice scaduto o sbagliato. Fatti mandare una nuova mail.'
  if (/fetch|network/i.test(m)) return 'Nessuna connessione. Riprova quando c\'è rete.'
  return m
}
