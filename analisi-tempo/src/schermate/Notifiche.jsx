// =====================================================================
// SCHERMATA GUIDATA NOTIFICHE
// Spiega passo passo come installare l'app sull'iPhone e attivare il
// promemoria orario. Contiene anche "Invia notifica di prova" e
// "Pausa notifiche per oggi".
// =====================================================================
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import * as archivio from '../lib/archivio.js'
import { usaArchivio } from '../lib/usaArchivio.js'
import * as notifiche from '../lib/notifiche.js'

export default function Notifiche({ utente }) {
  const stato = usaArchivio()
  const imp = stato.impostazioni ?? {}
  const [iscritto, setIscritto] = useState(null) // null = sto controllando
  const [permesso, setPermesso] = useState(notifiche.permesso())
  const [messaggio, setMessaggio] = useState(null) // { testo, errore }
  const [attesa, setAttesa] = useState(false)

  useEffect(() => {
    notifiche.iscrizioneAttuale().then((s) => setIscritto(Boolean(s))).catch(() => setIscritto(false))
  }, [])

  const iPhone = notifiche.eIPhone()
  const versione = notifiche.versioneIOS()
  const installata = notifiche.installata()
  const oggi = notifiche.oggiISO(imp.fuso_orario)
  const inPausaOggi = imp.notifiche_pausa_il === oggi

  async function esegui(azione, ok) {
    setAttesa(true)
    setMessaggio(null)
    try {
      await azione()
      if (ok) setMessaggio({ testo: ok })
    } catch (e) {
      setMessaggio({ testo: notifiche.spiegaErrore(e), errore: true })
    } finally {
      setAttesa(false)
      setPermesso(notifiche.permesso())
      setIscritto(Boolean(await notifiche.iscrizioneAttuale().catch(() => null)))
    }
  }

  async function aggiornaImpostazioni(campi) {
    const { error } = await supabase.from('impostazioni').update(campi).eq('user_id', utente.id)
    if (error) throw new Error(navigator.onLine ? error.message : 'Serve la rete.')
    await archivio.scaricaConfigurazione()
  }

  // ---- 1. iPhone non ancora installata sulla Home ----
  if (iPhone && !installata) {
    return (
      <div className="guida">
        <h1>Notifiche ogni ora</h1>
        {versione && versione < 16.4 && (
          <p className="messaggio-errore">
            Il tuo iPhone ha iOS {versione}: le notifiche richiedono almeno iOS 16.4. Aggiornalo
            da Impostazioni → Generali → Aggiornamento software.
          </p>
        )}
        <p>
          Sull'iPhone le notifiche funzionano solo se l'app è <b>aggiunta alla schermata Home</b>.
          Ci vogliono 20 secondi:
        </p>
        <ol className="passi">
          <li>
            Apri questa pagina in <b>Safari</b> (non in Chrome o dentro un'altra app).
          </li>
          <li>
            Tocca il pulsante <b>Condividi</b> <span className="icona-ios">⬆︎</span> (il quadrato con
            la freccia, in basso al centro o in alto a destra).
          </li>
          <li>
            Scorri e tocca <b>"Aggiungi alla schermata Home"</b>.
          </li>
          <li>
            Controlla che <b>"Apri come app web"</b> sia attivo, poi tocca <b>Aggiungi</b>.
          </li>
          <li>
            Chiudi Safari e apri <b>"Il mio tempo"</b> dall'icona sulla Home. Rientra con il codice
            via email (l'app installata non condivide il login con Safari).
          </li>
          <li>
            Torna in questa schermata (Impostazioni → Notifiche) e tocca <b>Attiva notifiche</b>.
          </li>
        </ol>
      </div>
    )
  }

  // ---- 2. Notifiche non disponibili ----
  if (!notifiche.supportate()) {
    return (
      <div className="guida">
        <h1>Notifiche ogni ora</h1>
        <p>Questo browser non supporta le notifiche push.</p>
        <p className="piccolo">
          Su iPhone usa Safari e aggiungi l'app alla Home. Su Android usa Chrome.
        </p>
      </div>
    )
  }

  // ---- 3. Attivazione e gestione ----
  return (
    <div className="guida">
      <h1>Notifiche ogni ora</h1>
      <p>
        Ogni ora, dentro la tua fascia di lavoro, ricevi un promemoria. Toccalo e si apre
        direttamente la registrazione rapida.
      </p>

      {messaggio && (
        <p className={messaggio.errore ? 'messaggio-errore' : 'messaggio-ok'}>{messaggio.testo}</p>
      )}

      {!notifiche.chiaveConfigurata() && (
        <p className="messaggio-errore">
          Configurazione incompleta: manca la chiave VAPID pubblica (README, passo 7).
        </p>
      )}

      {permesso === 'denied' ? (
        <div className="sezione">
          <p>
            <b>Le notifiche sono bloccate.</b> Per riattivarle:
          </p>
          <p className="piccolo">
            {iPhone
              ? 'Impostazioni dell\'iPhone → Notifiche → "Il mio tempo" → attiva "Consenti notifiche". Poi riapri l\'app.'
              : 'Nelle impostazioni del sito nel browser, consenti le notifiche e ricarica la pagina.'}
          </p>
        </div>
      ) : iscritto ? (
        <div className="sezione">
          <p className="messaggio-ok">✓ Notifiche attive su questo telefono</p>
          <button
            className="primario largo"
            disabled={attesa}
            onClick={() =>
              esegui(notifiche.inviaProva, 'Inviata! Dovrebbe arrivare entro pochi secondi.')
            }
          >
            {attesa ? 'Invio…' : 'Invia notifica di prova'}
          </button>
          <p className="piccolo">
            Se l'app è aperta in primo piano, la notifica di prova può non comparire: chiudi l'app
            dopo averla inviata.
          </p>
          <button
            className="secondario largo"
            disabled={attesa}
            onClick={() => esegui(notifiche.disattiva, 'Notifiche tolte da questo telefono.')}
          >
            Disattiva su questo telefono
          </button>
        </div>
      ) : (
        <button
          className="primario largo grande"
          disabled={attesa || iscritto === null || !notifiche.chiaveConfigurata()}
          onClick={() =>
            esegui(notifiche.attiva, 'Fatto! Ora tocca "Invia notifica di prova" per verificare.')
          }
        >
          {attesa ? 'Attivo…' : '🔔 Attiva notifiche'}
        </button>
      )}

      <section className="sezione">
        <h2>Oggi</h2>
        <label className="interruttore">
          <input
            type="checkbox"
            checked={inPausaOggi}
            onChange={(e) =>
              esegui(
                () => aggiornaImpostazioni({ notifiche_pausa_il: e.target.checked ? oggi : null }),
                e.target.checked ? 'Niente notifiche fino a domani.' : 'Notifiche riprese.',
              )
            }
          />
          Pausa notifiche per oggi
        </label>
        <label className="interruttore">
          <input
            type="checkbox"
            checked={imp.notifiche_attive !== false}
            onChange={(e) =>
              esegui(() => aggiornaImpostazioni({ notifiche_attive: e.target.checked }))
            }
          />
          Promemoria orari attivi (su tutti i dispositivi)
        </label>
        <p className="piccolo">
          Orari e giorni di riposo si cambiano in Impostazioni → Fascia di lavoro. Le notifiche
          arrivano allo scoccare dell'ora (es. alle 14:00 per l'ora 13–14), e non arrivano se
          quell'ora l'hai già registrata.
        </p>
      </section>
    </div>
  )
}
