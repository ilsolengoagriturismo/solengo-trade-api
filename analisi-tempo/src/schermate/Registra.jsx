// =====================================================================
// REGISTRAZIONE RAPIDA — obiettivo: meno di 5 secondi.
//
//  • Un tocco su una categoria = tutta l'ultima ora a quella categoria.
//  • "Dividi l'ora": scegli 2-3 categorie e i minuti (15/30/45).
//  • "Come l'ora precedente": copia l'ultima ora registrata.
//  • Se mancano più ore, le propone una dopo l'altra, con l'opzione
//    "stessa attività per tutte".
//  • Dopo il salvataggio compare un riquadro (facoltativo) per:
//    sottocategoria, "Potevi delegarla?", energia, nota. E "Annulla".
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
import { Pillole, OPZIONI_DELEGA, OPZIONI_ENERGIA } from '../componenti/Scelte.jsx'

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
  const [dividi, setDividi] = useState(false)
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
    setUltimo({ ore: oreDaSalvare, prima, aperto: false })
    setTutteInsieme(false)
    setDividi(false)
    setSelezione([])
    navigator.vibrate?.(25)
  }

  function toccaCategoria(c) {
    if (!dividi) {
      salva(() => [archivio.nuovaVoce(c.id, 60)])
      return
    }
    // modalità "dividi": seleziono/deseleziono (max 3)
    setSelezione((sel) => {
      const gia = sel.some((s) => s.categoria_id === c.id)
      const nuova = gia
        ? sel.filter((s) => s.categoria_id !== c.id)
        : sel.length < 3
          ? [...sel, { categoria_id: c.id }]
          : sel
      return distribuisci(nuova)
    })
  }

  function comePrecedente() {
    if (!precedente) return
    salva(() =>
      precedente.voci.map((v) =>
        archivio.nuovaVoce(v.categoria_id, v.minuti, {
          sottocategoria_id: v.sottocategoria_id,
          delegabile: v.delegabile,
          energia: v.energia,
        }),
      ),
    )
  }

  const totaleDivisione = selezione.reduce((s, x) => s + x.minuti, 0)

  return (
    <div className={dividi ? 'registra dividendo' : 'registra'}>
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
        <button
          className={dividi ? 'secondario acceso' : 'secondario'}
          onClick={() => {
            setDividi(!dividi)
            setSelezione([])
          }}
        >
          ½ Dividi l'ora
          <small>{dividi ? 'scegli 2 o 3 attività' : '15 / 30 / 45 min'}</small>
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

      {dividi && selezione.length > 0 && (
        <div className="pannello-dividi">
          {selezione.map((s, i) => (
            <div key={s.categoria_id} className="riga-dividi">
              <span>{archivio.categoriaPerId(s.categoria_id)?.nome}</span>
              <div className="pillole">
                {[15, 30, 45].map((m) => (
                  <button
                    key={m}
                    className={s.minuti === m ? 'scelta' : ''}
                    onClick={() =>
                      setSelezione((sel) => sel.map((x, j) => (j === i ? { ...x, minuti: m } : x)))
                    }
                  >
                    {m}′
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            className="primario"
            disabled={selezione.length < 2 || totaleDivisione !== 60}
            onClick={() => salva(() => selezione.map((s) => archivio.nuovaVoce(s.categoria_id, s.minuti)))}
          >
            {selezione.length < 2
              ? 'Scegli almeno 2 attività'
              : totaleDivisione === 60
                ? 'Salva'
                : `Totale ${totaleDivisione}′ su 60′`}
          </button>
        </div>
      )}
    </div>
  )
}

/** Ripartizione iniziale dei minuti: 2 → 30/30, 3 → 30/15/15. */
function distribuisci(sel) {
  const schemi = { 1: [60], 2: [30, 30], 3: [30, 15, 15] }
  const minuti = schemi[sel.length] ?? []
  return sel.map((s, i) => ({ ...s, minuti: minuti[i] }))
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
  function modifica(campo, valore) {
    for (const ora of ultimo.ore) {
      archivio.impostaOra(
        ora,
        archivio.vociOra(ora).map((v) => ({ ...v, [campo]: valore })),
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
          + Dettagli (facoltativi): delegabile, energia, nota
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
          <div className="riga-dettaglio">
            <span>Potevi delegarla?</span>
            <Pillole
              opzioni={OPZIONI_DELEGA}
              valore={voci[0].delegabile}
              onCambia={(v) => modifica('delegabile', v)}
            />
          </div>
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
