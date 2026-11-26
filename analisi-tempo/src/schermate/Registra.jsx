// =====================================================================
// REGISTRAZIONE RAPIDA
//
//  • Ogni tocco su un'attività = 10 minuti (div.PASSO).
//    Esempio: telefono ×1, supervisione ×3, viaggi ×2 = 60′.
//  • A 60′ l'ora si salva da sola e si passa all'ora successiva.
//  • In basso il riepilogo: − / + per correggere, "+N′" completa l'ora,
//    "Salva così" per salvare un'ora incompleta.
//  • "Come l'ora precedente": copia l'ultima ora registrata.
//  • Se mancano più ore, le propone una dopo l'altra, con l'opzione
//    "stessa attività per tutte".
//  • Dopo il salvataggio compare un riquadro (facoltativo) per:
//    sottocategoria, delegabile, urgente, importante, in linea con
//    l'obiettivo (1-5), energia, nota. E "Annulla".
// =====================================================================
import { useEffect, useMemo, useState } from 'react'
import * as archivio from '../lib/archivio.js'
import { usaArchivio } from '../lib/usaArchivio.js'
import {
  oreMancanti,
  ultimaOraConclusa,
  etichettaOra,
  etichettaGiorno,
  chiaveOra,
} from '../lib/ore.js'
import { Pillole, OPZIONI_ENERGIA } from '../componenti/Scelte.jsx'
import DomandeAttivita from '../componenti/DomandeAttivita.jsx'
import { permesso } from '../lib/notifiche.js'
import { vaiA } from '../lib/navigazione.js'
import * as div from '../lib/divisione.js'

export default function Registra() {
  const stato = usaArchivio()
  const adesso = usaOrologio()

  const categorie = stato.categorie.filter((c) => c.attiva)
  const fascia = stato.impostazioni?.fascia

  // Ore da compilare e ora "bersaglio" (la più vecchia ancora vuota)
  const mancanti = useMemo(
    () => oreMancanti(fascia, archivio.oreRegistrate(), adesso),
    // stato.voci cambia a ogni salvataggio → ricalcolo
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fascia, stato.voci, adesso],
  )
  const bersaglio = mancanti[0] ?? ultimaOraConclusa(adesso)
  const vociBersaglio = archivio.vociOra(bersaglio)

  const [tutteInsieme, setTutteInsieme] = useState(false)
  // minuti assegnati finora all'ora in corso: ogni tocco = +10′
  const [selezione, setSelezione] = useState([]) // [{ categoria_id, minuti }]
  const [ultimo, setUltimo] = useState(null) // ultimo salvataggio, per dettagli e Annulla

  const oreDaSalvare = tutteInsieme && mancanti.length > 1 ? mancanti : [bersaglio]
  const precedente = archivio.ultimaOraRegistrataPrima(bersaglio)

  /** Salva le stesse voci su tutte le ore scelte. */
  function salva(creaVoci) {
    const prima = {}
    for (const ora of oreDaSalvare) {
      prima[chiaveOra(ora)] = archivio.vociOra(ora)
      archivio.impostaOra(ora, creaVoci())
    }
    setUltimo({ ore: oreDaSalvare, prima, aperto: true })
    setTutteInsieme(false)
    setSelezione([])
    navigator.vibrate?.(25)
  }

  /**
   * Aggiorna i minuti dell'ora. Quando si arriva a 60′ l'ora si salva
   * da sola e si passa alla successiva.
   */
  function aggiorna(nuova) {
    if (div.totale(nuova) === div.ORA) {
      const voci = div.daSalvare(nuova)
      salva(() => voci.map((x) => archivio.nuovaVoce(x.categoria_id, x.minuti)))
    } else {
      setSelezione(nuova)
    }
  }

  // ogni tocco aggiunge 10 minuti a quell'attività
  function toccaCategoria(c) {
    navigator.vibrate?.(10)
    aggiorna(div.aggiungi(selezione, c.id))
  }

  function comePrecedente() {
    if (!precedente) return
    salva(() =>
      precedente.voci.map((v) =>
        archivio.nuovaVoce(v.categoria_id, v.minuti, {
          sottocategoria_id: v.sottocategoria_id,
          delegabile: v.delegabile,
          energia: v.energia,
          urgente: v.urgente,
          importante: v.importante,
          allineamento: v.allineamento,
        }),
      ),
    )
  }

  const totaleDivisione = div.totale(selezione)
  const mancano = div.rimanenti(selezione)

  return (
    <div className={selezione.length ? 'registra dividendo' : 'registra'}>
      <InvitoNotifiche />
      {ultimo && <RiquadroSalvato ultimo={ultimo} setUltimo={setUltimo} stato={stato} />}

      <header className="bersaglio">
        <div className="bersaglio-giorno">{etichettaGiorno(bersaglio, adesso)}</div>
        <div className="bersaglio-ora">{etichettaOra(bersaglio)}</div>
        {mancanti.length > 1 && (
          <div className="bersaglio-mancanti">
            {mancanti.length} ore da compilare
            <label className="interruttore">
              <input
                type="checkbox"
                checked={tutteInsieme}
                onChange={(e) => setTutteInsieme(e.target.checked)}
              />
              Stessa attività per tutte
            </label>
          </div>
        )}
        {mancanti.length === 0 && vociBersaglio.length > 0 && (
          <div className="bersaglio-fatto">
            ✓ Già registrata: {nomiVoci(vociBersaglio)}. Tocca per cambiarla.
          </div>
        )}
      </header>

      <div className="azioni-rapide">
        <button
          className="secondario"
          disabled={!precedente}
          onClick={comePrecedente}
          title={precedente ? nomiVoci(precedente.voci) : ''}
        >
          ↺ Come l'ora precedente
          {precedente && <small>{nomiVoci(precedente.voci)}</small>}
        </button>
        <button className="secondario" disabled={!selezione.length} onClick={() => setSelezione([])}>
          ✕ Ricomincia
          <small>
            {selezione.length ? `${totaleDivisione}′ su 60′` : `ogni tocco = ${div.PASSO} min`}
          </small>
        </button>
      </div>

      <div className="griglia-categorie">
        {categorie.map((c) => {
          const scelta = selezione.find((s) => s.categoria_id === c.id)
          return (
            <button
              key={c.id}
              className={'categoria' + (scelta ? ' selezionata' : '') + (c.lavoro ? '' : ' pausa')}
              style={{ '--colore': c.colore }}
              onClick={() => toccaCategoria(c)}
            >
              <span className="categoria-nome">{c.nome}</span>
              {c.descrizione && <span className="categoria-desc">{c.descrizione}</span>}
              {scelta && <span className="categoria-minuti">{scelta.minuti}′</span>}
            </button>
          )
        })}
      </div>

      {selezione.length === 0 && (
        <p className="piccolo centrato suggerimento">
          Ogni tocco = {div.PASSO} minuti. A 60′ l'ora si salva da sola.
        </p>
      )}

      {selezione.length > 0 && (
        <div className="pannello-dividi">
          {selezione.map((s) => (
            <div key={s.categoria_id} className="riga-dividi">
              <span className="dividi-nome">
                <span className="pallino" style={{ '--colore': archivio.categoriaPerId(s.categoria_id)?.colore }} />
                {archivio.categoriaPerId(s.categoria_id)?.nome}
              </span>
              <span className="dividi-comandi">
                <button aria-label={`Meno ${div.PASSO} minuti`} onClick={() => setSelezione((x) => div.cambia(x, s.categoria_id, -div.PASSO))}>
                  −
                </button>
                <span className="dividi-valore">
                  <b>{s.minuti}′</b>
                  <small>{div.percentualeOra(s.minuti)}</small>
                </span>
                <button aria-label={`Più ${div.PASSO} minuti`} disabled={!mancano} onClick={() => aggiorna(div.cambia(selezione, s.categoria_id, div.PASSO))}>
                  +
                </button>
                {mancano > 0 && (
                  <button className="dividi-resto" onClick={() => aggiorna(div.resto(selezione, s.categoria_id))}>
                    +{mancano}′
                  </button>
                )}
                <button aria-label="Togli" className="dividi-togli" onClick={() => setSelezione((x) => div.rimuovi(x, s.categoria_id))}>
                  ✕
                </button>
              </span>
            </div>
          ))}
          {selezione.length > 0 && (
            <div className={'dividi-totale' + (mancano ? ' incompleto' : '')}>
              {mancano ? `Assegnati ${totaleDivisione}′ · mancano ${mancano}′` : 'Ora completa: 60′ ✓'}
            </div>
          )}
          <button
            className="primario"
            disabled={totaleDivisione === 0}
            onClick={() =>
              salva(() => div.daSalvare(selezione).map((s) => archivio.nuovaVoce(s.categoria_id, s.minuti)))
            }
          >
            {mancano ? `Salva così (${totaleDivisione}′ su 60′)` : 'Salva'}
          </button>
        </div>
      )}
    </div>
  )
}

/** Invito ad attivare le notifiche (finché non sono attive o lo chiudi). */
function InvitoNotifiche() {
  const [chiuso, setChiuso] = useState(() => localStorage.getItem('analisi-tempo.invito-chiuso') === '1')
  if (chiuso || permesso() === 'granted') return null
  return (
    <div className="invito">
      <button className="link" onClick={() => vaiA('/notifiche')}>
        🔔 Attiva il promemoria ogni ora ›
      </button>
      <button
        className="link"
        aria-label="Chiudi"
        onClick={() => {
          localStorage.setItem('analisi-tempo.invito-chiuso', '1')
          setChiuso(true)
        }}
      >
        ✕
      </button>
    </div>
  )
}

function nomiVoci(voci) {
  return voci
    .map((v) => {
      const nome = archivio.categoriaPerId(v.categoria_id)?.nome ?? '?'
      return v.minuti < 60 ? `${nome} ${v.minuti}′` : nome
    })
    .join(' + ')
}

/** Riquadro dopo il salvataggio: Annulla + dettagli facoltativi. */
function RiquadroSalvato({ ultimo, setUltimo, stato }) {
  const primaOra = ultimo.ore[0]
  const voci = archivio.vociOra(primaOra)
  if (!voci.length) return null

  const categorieUsate = [...new Set(voci.map((v) => v.categoria_id))]
  const unaCategoria = categorieUsate.length === 1 ? categorieUsate[0] : null
  const sotto = unaCategoria
    ? stato.sottocategorie.filter((s) => s.categoria_id === unaCategoria && s.attiva)
    : []

  // i dettagli valgono per tutte le voci delle ore appena salvate
  // categoriaId = null → vale per tutte le attività dell'ora
  function modifica(campo, valore, categoriaId = null) {
    for (const ora of ultimo.ore) {
      archivio.impostaOra(
        ora,
        archivio
          .vociOra(ora)
          .map((v) => (categoriaId && v.categoria_id !== categoriaId ? v : { ...v, [campo]: valore })),
      )
    }
  }

  function annulla() {
    for (const ora of ultimo.ore) archivio.impostaOra(ora, ultimo.prima[chiaveOra(ora)])
    setUltimo(null)
  }

  const quando =
    ultimo.ore.length > 1
      ? `${ultimo.ore.length} ore (${etichettaOra(primaOra).split(' – ')[0]} → ${etichettaOra(ultimo.ore.at(-1)).split(' – ')[1]})`
      : etichettaOra(primaOra)

  return (
    <div className="salvato">
      <div className="salvato-riga">
        <span>
          ✓ <b>{quando}</b>: {nomiVoci(voci)}
        </span>
        <button className="link" onClick={annulla}>
          Annulla
        </button>
      </div>

      {!ultimo.aperto ? (
        <button className="link" onClick={() => setUltimo({ ...ultimo, aperto: true })}>
          + Dettagli: delegabile, urgente, importante, obiettivo
        </button>
      ) : (
        <div className="dettagli">
          {sotto.length > 0 && (
            <Pillole
              etichetta="Sottocategoria"
              opzioni={sotto.map((s) => ({ valore: s.id, testo: s.nome }))}
              valore={voci[0].sottocategoria_id}
              onCambia={(v) => modifica('sottocategoria_id', v)}
            />
          )}
          {stato.impostazioni?.obiettivo && (
            <p className="obiettivo-promemoria">🎯 Obiettivo: {stato.impostazioni.obiettivo}</p>
          )}
          {voci.length === 1 ? (
            <DomandeAttivita voce={voci[0]} onCambia={(campo, x) => modifica(campo, x)} />
          ) : (
            // più attività nella stessa ora: le domande valgono per ciascuna
            voci.map((v) => (
              <DomandeAttivita
                key={v.id}
                voce={v}
                titolo={`${archivio.categoriaPerId(v.categoria_id)?.nome ?? '?'} · ${v.minuti}′`}
                onCambia={(campo, x) => modifica(campo, x, v.categoria_id)}
              />
            ))
          )}
          <div className="riga-dettaglio">
            <span>Energia</span>
            <Pillole
              opzioni={OPZIONI_ENERGIA}
              valore={voci[0].energia}
              onCambia={(v) => modifica('energia', v)}
            />
          </div>
          <NotaBreve valore={voci[0].nota} onSalva={(t) => modifica('nota', t || null)} />
          <button className="link" onClick={() => setUltimo(null)}>
            Fatto
          </button>
        </div>
      )}
    </div>
  )
}

/** Nota salvata quando esci dal campo (non a ogni lettera). */
export function NotaBreve({ valore, onSalva }) {
  const [testo, setTesto] = useState(valore ?? '')
  useEffect(() => setTesto(valore ?? ''), [valore])
  return (
    <input
      className="nota"
      placeholder="Nota breve (facoltativa)"
      maxLength={280}
      value={testo}
      onChange={(e) => setTesto(e.target.value)}
      onBlur={() => testo !== (valore ?? '') && onSalva(testo.trim())}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}

/** "adesso" che si aggiorna ogni 30 secondi (per il cambio d'ora). */
function usaOrologio() {
  const [adesso, setAdesso] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => {
      const n = new Date()
      // aggiorno solo quando cambia l'ora, per non ricalcolare inutilmente
      setAdesso((a) => (a.getHours() !== n.getHours() || a.getDate() !== n.getDate() ? n : a))
    }, 30000)
    const suVisibile = () => document.visibilityState === 'visible' && setAdesso(new Date())
    document.addEventListener('visibilitychange', suVisibile)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', suVisibile)
    }
  }, [])
  return adesso
}
