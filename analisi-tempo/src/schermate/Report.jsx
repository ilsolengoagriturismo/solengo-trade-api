// =====================================================================
// REPORT: giorno / settimana / mese.
// Tabella nel formato del foglio del corso (Attività | Ore | %),
// grafico a barre, copertura e proiezione a fine mese.
// =====================================================================
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import * as archivio from '../lib/archivio.js'
import { usaArchivio } from '../lib/usaArchivio.js'
import {
  periodo,
  spostaPeriodo,
  riepilogo,
  fattoreProiezione,
  copertura,
  ore,
  percento,
  stimaVsReale,
  delegabili,
  conSegno,
  matriceUrgenteImportante,
  allineamentoObiettivo,
  bolleMappa,
  concentrazione,
  frasiChiave,
  oreMigliori,
} from '../lib/report.js'
import { posizione } from '../lib/mappa.js'
import { csvRiepilogo, csvDettaglio, pdfReport, condividiOScarica, nomeFile } from '../lib/esporta.js'
import { aderenzaIdeale, periodoAnalisi, NOMI_GIORNI } from '../lib/settimana.js'
import { FASE_2_ATTIVA } from '../lib/fasi.js'

const TIPI = [
  ['giorno', 'Giorno'],
  ['settimana', 'Settimana'],
  ['mese', 'Mese'],
]
// quarta scheda, solo se in Impostazioni c'è il periodo di analisi
const SCHEDA_PERIODO = ['analisi', 'Periodo']

export default function Report() {
  const stato = usaArchivio()
  const [tipoScelto, setTipo] = useState(() => sessionStorage.getItem('report.tipo') || 'mese')
  const [riferimento, setRiferimento] = useState(() => new Date())
  const [dati, setDati] = useState({ righe: [], daTelefono: false, caricato: false })

  // periodo dell'esercizio del corso (Impostazioni → Periodo di analisi)
  const pAnalisi = periodoAnalisi(stato.impostazioni?.analisi_dal, stato.impostazioni?.analisi_al)
  const schede = pAnalisi ? [...TIPI, SCHEDA_PERIODO] : TIPI
  // se il periodo è stato tolto, la scheda "Periodo" torna a "Mese"
  const tipo = tipoScelto === 'analisi' && !pAnalisi ? 'mese' : tipoScelto

  const pCalendario = useMemo(() => periodo(tipo === 'analisi' ? 'mese' : tipo, riferimento), [tipo, riferimento])
  const p = tipo === 'analisi' ? pAnalisi : pCalendario
  const adesso = new Date()
  const fascia = stato.impostazioni?.fascia

  useEffect(() => {
    let annullato = false
    archivio.caricaPeriodo(p.da, p.a).then((d) => !annullato && setDati({ ...d, caricato: true }))
    return () => {
      annullato = true
    }
    // ricarico anche quando cambiano le registrazioni (stato.voci)
  }, [p.da.getTime(), p.a.getTime(), stato.voci])

  const r = riepilogo(dati.righe, stato.categorie)
  const fattore = tipo === 'mese' ? fattoreProiezione(fascia, p.da, p.a, adesso) : null
  const cop = copertura(dati.righe, fascia, p.da, p.a, adesso)
  const futuro = p.da > adesso
  const massimo = Math.max(1, ...r.righe.map((x) => x.minuti))
  const etichettaOre = { giorno: 'Ore', settimana: 'Ore-sett.', mese: 'Ore-mese', analisi: 'Ore' }[tipo]
  // settimana ideale vs reale: nelle viste Giorno, Settimana e Periodo
  const aderenza =
    !FASE_2_ATTIVA || tipo === 'mese' ? null : aderenzaIdeale(stato.impostazioni?.settimana_ideale, dati.righe, p.da, p.a, adesso)
  const svr = tipo === 'mese' ? stimaVsReale(r.righe, fattore) : null
  const deleg = delegabili(dati.righe, stato.categorie)
  const matrice = matriceUrgenteImportante(dati.righe, stato.categorie)
  const allin = allineamentoObiettivo(dati.righe, stato.categorie)
  const bolle = bolleMappa(dati.righe, stato.categorie)
  const conc = concentrazione(dati.righe, stato.categorie)
  const energia = oreMigliori(dati.righe)
  const valoreOra = stato.impostazioni?.valore_ora ? Number(stato.impostazioni.valore_ora) : null
  const frasi = frasiChiave({ r, deleg, matrice, allin, svr, conc, valoreOra })

  return (
    <div className="report">
      <div className="schede" role="tablist">
        {schede.map(([t, testo]) => (
          <button
            key={t}
            role="tab"
            aria-selected={t === tipo}
            className={t === tipo ? 'scelta' : ''}
            onClick={() => {
              setTipo(t)
              sessionStorage.setItem('report.tipo', t)
            }}
          >
            {testo}
          </button>
        ))}
      </div>

      {tipo === 'analisi' ? (
        <div className="testa-periodo">
          <h1>Report finale per il coach</h1>
          <p className="piccolo">Periodo di analisi {p.etichetta}</p>
        </div>
      ) : (
        <div className="navigazione-giorno">
          <button className="secondario" onClick={() => setRiferimento(spostaPeriodo(tipo, riferimento, -1))}>
            ‹
          </button>
          <b className="etichetta-periodo">{p.etichetta}</b>
          <button
            className="secondario"
            disabled={p.a > adesso}
            onClick={() => setRiferimento(spostaPeriodo(tipo, riferimento, 1))}
          >
            ›
          </button>
        </div>
      )}

      {dati.daTelefono && (
        <p className="piccolo centrato">Offline: dati presenti sul telefono (ultimi 45 giorni).</p>
      )}

      <div className="riepilogo-giorno">
        <div>
          <b>{ore(r.minutiLavoro)} h</b>
          <small>lavoro</small>
        </div>
        <div>
          <b>{cop ? percento(cop.percentuale) : '—'}</b>
          <small>ore compilate</small>
        </div>
        <div>
          <b>{fattore ? `${ore(r.minutiLavoro * fattore)} h` : ore(r.minutiNonLavoro) + ' h'}</b>
          <small>{fattore ? 'proiezione mese' : 'pausa/personale'}</small>
        </div>
      </div>

      {cop && cop.percentuale < 80 && !futuro && (
        <p className="piccolo centrato">
          Hai compilato {cop.compilate} ore su {cop.attese} della tua fascia: i numeri saranno più
          affidabili completando le ore mancanti (schermata Giornata).
        </p>
      )}

      {frasi.length > 0 && (
        <section className="in-breve">
          <h2>In breve</h2>
          <ul>
            {frasi.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>
      )}

      {/* --- Tabella nel formato del corso --- */}
      <table className="tabella-corso">
        <thead>
          <tr>
            <th>Attività</th>
            <th className="num">{etichettaOre}</th>
            <th className="num">%</th>
            {fattore && <th className="num">Proiez.</th>}
          </tr>
        </thead>
        <tbody>
          {r.righe
            .filter((x) => x.categoria.lavoro)
            .map((x, i) => (
              <RigaCategoria key={x.categoria.id} x={x} n={i + 1} fattore={fattore} stato={stato} />
            ))}
        </tbody>
        <tfoot>
          <tr>
            <th>Totale lavoro</th>
            <th className="num">{ore(r.minutiLavoro)}</th>
            <th className="num">{r.minutiLavoro ? '100%' : ''}</th>
            {fattore && <th className="num">{ore(r.minutiLavoro * fattore)}</th>}
          </tr>
          {r.righe
            .filter((x) => !x.categoria.lavoro)
            .map((x) => (
              <tr key={x.categoria.id} className="riga-esclusa">
                <td>
                  <span className="pallino" style={{ '--colore': x.categoria.colore }} />
                  {x.categoria.nome} <small>(esclusa)</small>
                </td>
                <td className="num">{ore(x.minuti)}</td>
                <td />
                {fattore && <td className="num">{ore(x.minuti * fattore)}</td>}
              </tr>
            ))}
        </tfoot>
      </table>

      {/* --- Grafico --- */}
      <h2 className="titolo-grafico">Dove va il tuo tempo</h2>
      {r.minutiLavoro + r.minutiNonLavoro === 0 ? (
        <p className="piccolo centrato">{futuro ? 'Periodo futuro.' : 'Nessuna ora registrata in questo periodo.'}</p>
      ) : (
        <div className="grafico" role="img" aria-label="Ore per categoria">
          {r.righe
            .filter((x) => x.minuti > 0)
            .map((x) => (
              <div key={x.categoria.id} className="barra-riga">
                <span className="barra-nome">{x.categoria.nome}</span>
                <span className="barra-pista">
                  <span
                    className="barra"
                    style={{ '--colore': x.categoria.colore, width: `${(x.minuti / massimo) * 100}%` }}
                  />
                  <span className="barra-valore">
                    {ore(x.minuti)} h{x.percentuale != null ? ` · ${percento(x.percentuale)}` : ''}
                  </span>
                </span>
              </div>
            ))}
        </div>
      )}

      {svr && <StimaVsReale svr={svr} stato={stato} />}
      {aderenza && <IdealeVsReale a={aderenza} />}
      <Delegabili deleg={deleg} r={r} valoreOra={valoreOra} />
      <Concentrazione c={conc} />
      <OreMigliori e={energia} />
      <MappaBolle bolle={bolle} />
      <UrgenteImportante m={matrice} />
      <Allineamento a={allin} obiettivo={stato.impostazioni?.obiettivo} />
      <Esporta
        p={p}
        tipo={tipo}
        r={r}
        svr={svr}
        fattore={fattore}
        deleg={deleg}
        matrice={matrice}
        allin={allin}
        frasi={frasi}
        aderenza={aderenza}
        cop={cop}
        righe={dati.righe}
        stato={stato}
      />
    </div>
  )
}

// ---------------------------------------------------------------------
// SETTIMANA IDEALE VS REALE (Giorno, Settimana, Periodo)
// Per ogni blocco pianificato: quanta parte l'hai fatta davvero.
// ---------------------------------------------------------------------
const NOME_GIORNO = Object.fromEntries(NOMI_GIORNI)

function IdealeVsReale({ a }) {
  const due = (h) => `${String(h % 24).padStart(2, '0')}:00`
  return (
    <section className="sezione-report">
      <h2>Settimana ideale vs reale</h2>
      {a.totale.percentuale == null ? (
        <p className="piccolo">
          Nessun blocco della settimana ideale in questo periodo (o non ancora concluso). Disegnala
          in Impostazioni → Settimana ideale.
        </p>
      ) : (
        <>
          <div className="numero-grande">
            {percento(a.totale.percentuale)} <small>aderenza: {ore(a.totale.fatti)} h su {ore(a.totale.pianificati)} h pianificate</small>
          </div>
          <table className="tabella-corso">
            <tbody>
              {a.blocchi.map((b) => {
                const c = archivio.categoriaPerId(b.categoria_id)
                return (
                  <tr key={`${b.giorno}-${b.indice}`}>
                    <td>
                      <span className="pallino" style={{ '--colore': c?.colore }} />
                      {NOME_GIORNO[b.giorno].slice(0, 3)} {due(b.inizio)}–{due(b.fine)} · {c?.nome ?? '?'}
                    </td>
                    <td className="num">
                      {ore(b.fatti)}/{ore(b.pianificati)} h
                    </td>
                    <td className={'num ' + (b.percentuale < 50 ? 'scostato' : '')}>{percento(b.percentuale)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="piccolo">In arancione i blocchi rispettati per meno della metà.</p>
        </>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------
// STIMA VS REALE (solo vista Mese)
// ---------------------------------------------------------------------
function StimaVsReale({ svr, stato }) {
  const [modifica, setModifica] = useState(false)
  const senzaStima = svr.righe.every((x) => x.stima == null)
  return (
    <section className="sezione-report">
      <div className="testa-sezione">
        <h2>Stima vs Reale</h2>
        <button className="link" onClick={() => setModifica(true)}>
          {senzaStima ? 'Inserisci stime' : 'Modifica stime'}
        </button>
      </div>
      {senzaStima ? (
        <p className="piccolo">
          Inserisci quante ore al mese <b>pensi</b> di dedicare a ogni attività, poi confrontale con
          quelle misurate.
        </p>
      ) : (
        <>
          <p className="piccolo">
            {svr.usaProiezione
              ? 'Mese in corso: confronto la stima con la proiezione a fine mese.'
              : 'Confronto la stima con le ore registrate nel mese.'}
          </p>
          <table className="tabella-corso">
            <thead>
              <tr>
                <th>Attività</th>
                <th className="num">Stima</th>
                <th className="num">{svr.usaProiezione ? 'Proiez.' : 'Reale'}</th>
                <th className="num">Scost.</th>
              </tr>
            </thead>
            <tbody>
              {svr.righe.map((x) => (
                <tr key={x.categoria.id}>
                  <td>
                    <span className="pallino" style={{ '--colore': x.categoria.colore }} />
                    {x.categoria.nome}
                  </td>
                  <td className="num">{x.stima == null ? '–' : ore(x.stima * 60)}</td>
                  <td className="num">{ore(x.valore * 60)}</td>
                  <td className={'num ' + classeScostamento(x.scostamentoPct)}>
                    {x.scostamento == null ? '' : conSegno(x.scostamento)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Totale</th>
                <th className="num">{ore(svr.totale.stima * 60)}</th>
                <th className="num">{ore(svr.totale.valore * 60)}</th>
                <th className={'num ' + classeScostamento(svr.totale.scostamentoPct)}>
                  {conSegno(svr.totale.scostamento)}
                </th>
              </tr>
            </tfoot>
          </table>
          <p className="piccolo">
            In evidenza le attività che si discostano di più del 25% dalla stima.
          </p>
        </>
      )}
      {modifica && <ModificaStime stato={stato} onChiudi={() => setModifica(false)} />}
    </section>
  )
}

const classeScostamento = (pct) => (pct != null && Math.abs(pct) > 25 ? 'scostato' : '')

function ModificaStime({ stato, onChiudi }) {
  const categorie = stato.categorie.filter((c) => c.lavoro && c.attiva)
  const [valori, setValori] = useState(() =>
    Object.fromEntries(categorie.map((c) => [c.id, c.ore_stimate_mese == null ? '' : String(Number(c.ore_stimate_mese))])),
  )
  const [errore, setErrore] = useState('')
  const [attesa, setAttesa] = useState(false)
  const totale = Object.values(valori).reduce((s, v) => s + (Number(v.replace(',', '.')) || 0), 0)

  async function salva() {
    setAttesa(true)
    setErrore('')
    for (const c of categorie) {
      const testo = valori[c.id].trim().replace(',', '.')
      const nuovo = testo === '' ? null : Number(testo)
      if (nuovo != null && (Number.isNaN(nuovo) || nuovo < 0)) {
        setErrore(`Valore non valido per "${c.nome}"`)
        setAttesa(false)
        return
      }
      if (nuovo !== (c.ore_stimate_mese == null ? null : Number(c.ore_stimate_mese))) {
        const { error } = await supabase.from('categorie').update({ ore_stimate_mese: nuovo }).eq('id', c.id)
        if (error) {
          setErrore(navigator.onLine ? error.message : 'Serve la rete per salvare le stime.')
          setAttesa(false)
          return
        }
      }
    }
    await archivio.scaricaConfigurazione().catch(() => {})
    setAttesa(false)
    onChiudi()
  }

  return (
    <div className="foglio-sfondo" onClick={onChiudi}>
      <div className="foglio" onClick={(e) => e.stopPropagation()}>
        <header className="foglio-testa">
          <h2>Ore stimate al mese</h2>
          <button className="link" onClick={onChiudi}>
            Chiudi
          </button>
        </header>
        <p className="piccolo">Quante ore al mese pensi di dedicare a ogni attività?</p>
        {categorie.map((c, i) => (
          <label key={c.id} className="riga-stima">
            <span>
              <span className="pallino" style={{ '--colore': c.colore }} /> {i + 1}. {c.nome}
            </span>
            <input
              inputMode="decimal"
              value={valori[c.id]}
              placeholder="–"
              onChange={(e) => setValori({ ...valori, [c.id]: e.target.value })}
            />
          </label>
        ))}
        <p className="totale">Totale: {totale.toLocaleString('it-IT')} ore al mese</p>
        {errore && <p className="messaggio-errore">{errore}</p>}
        <button className="primario largo" disabled={attesa} onClick={salva}>
          {attesa ? 'Salvo…' : 'Salva stime'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// ORE DELEGABILI
// ---------------------------------------------------------------------
function Delegabili({ deleg, r, valoreOra }) {
  const conDelega = r.righe.filter((x) => x.categoria.lavoro && x.minutiDelegabili > 0)
  return (
    <section className="sezione-report">
      <h2>Ore delegabili</h2>
      {!deleg.minutiLavoro ? (
        <p className="piccolo">Nessuna ora di lavoro nel periodo.</p>
      ) : (
        <>
          <div className="numero-grande">
            {ore(deleg.minutiDelegabili)} h <small>{percento(deleg.percentuale)} del lavoro</small>
          </div>
          {valoreOra && deleg.minutiDelegabili > 0 && (
            <p className="valore-euro">
              ≈ {((deleg.minutiDelegabili / 60) * valoreOra).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}{' '}
              del tuo tempo (a {valoreOra.toLocaleString('it-IT')} €/h)
            </p>
          )}
          {conDelega.length > 0 && (
            <table className="tabella-corso">
              <tbody>
                {conDelega.map((x) => (
                  <tr key={x.categoria.id}>
                    <td>
                      <span className="pallino" style={{ '--colore': x.categoria.colore }} />
                      {x.categoria.nome}
                    </td>
                    <td className="num">{ore(x.minutiDelegabili)} h</td>
                    <td className="num">{percento((x.minutiDelegabili / x.minuti) * 100)} della categoria</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="piccolo">
            Attività piazzate sulla mappa: {ore(deleg.minutiConRisposta)} h su{' '}
            {ore(deleg.minutiLavoro)} h di lavoro
            {deleg.minutiConRisposta < deleg.minutiLavoro * 0.5 &&
              ': piazza più spesso le attività sulla mappa dopo la registrazione, per un dato più affidabile'}
            .
          </p>
        </>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------
// MAPPA A BOLLE: dove sta ogni attività (urgenza × obiettivo)
// colore = attività, grandezza = ore piazzate sulla mappa
// ---------------------------------------------------------------------
function MappaBolle({ bolle }) {
  const max = Math.max(1, ...bolle.map((b) => b.minuti))
  return (
    <section className="sezione-report">
      <h2>Mappa del tuo tempo</h2>
      {!bolle.length ? (
        <p className="piccolo">
          Ancora nessuna attività piazzata sulla mappa in questo periodo (la mappa compare dopo
          ogni registrazione).
        </p>
      ) : (
        <>
          <div className="mappa-cornice">
            <span className="mappa-asse-y">In linea con l'obiettivo ↑</span>
            <div className="mappa mappa-report">
              <span className="q q-pianificare">Pianificare</span>
              <span className="q q-fare">Fare subito</span>
              <span className="q q-eliminare">Eliminare</span>
              <span className="q q-delegare">Delegare</span>
              {bolle.map((b) => {
                const p = posizione(b.urgenza, b.allineamento)
                const lato = 18 + Math.sqrt(b.minuti / max) * 52 // area proporzionale alle ore
                return (
                  <span
                    key={b.categoria.id}
                    className="bolla"
                    style={{
                      left: `${p.sinistra}%`,
                      top: `${p.alto}%`,
                      width: lato,
                      height: lato,
                      '--colore': b.categoria.colore,
                    }}
                    title={`${b.categoria.nome}: ${ore(b.minuti)} h`}
                  />
                )
              })}
            </div>
            <span className="mappa-asse-x">Urgenza →</span>
          </div>
          <ul className="legenda-bolle">
            {bolle.map((b) => (
              <li key={b.categoria.id}>
                <span className="pallino" style={{ '--colore': b.categoria.colore }} />
                {b.categoria.nome} <b>{ore(b.minuti)} h</b>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------
// CONCENTRAZIONE: ore pulite / spezzate, blocchi di lavoro autonomo
// ---------------------------------------------------------------------
function Concentrazione({ c }) {
  if (!c.oreRegistrate) return null
  return (
    <section className="sezione-report">
      <h2>Concentrazione</h2>
      <div className="riepilogo-giorno">
        <div>
          <b>{c.pulite}</b>
          <small>ore senza interruzioni</small>
        </div>
        <div>
          <b>{c.spezzate}</b>
          <small>ore spezzate (3+ attività)</small>
        </div>
        <div>
          <b>{c.blocchi}</b>
          <small>blocchi di lavoro autonomo da 2+ ore</small>
        </div>
      </div>
      <p className="piccolo">
        Il lavoro di pensiero rende davvero in blocchi lunghi senza interruzioni. Su{' '}
        {c.oreRegistrate} ore registrate, {percento((c.pulite / c.oreRegistrate) * 100)} sono state
        dedicate a una sola attività.
      </p>
    </section>
  )
}

// ---------------------------------------------------------------------
// LE TUE ORE MIGLIORI: energia media per ora del giorno
// ---------------------------------------------------------------------
function OreMigliori({ e }) {
  if (!e.ore.length) return null
  const due = (h) => `${String(h % 24).padStart(2, '0')}:00`
  return (
    <section className="sezione-report">
      <h2>Le tue ore migliori</h2>
      {e.migliore && (
        <p>
          Energia più alta tra le <b>{due(e.migliore.da)}</b> e le <b>{due(e.migliore.a)}</b>:
          proteggi questa fascia per il lavoro autonomo.
        </p>
      )}
      <div className="grafico-energia">
        {e.ore.map((o) => (
          <div key={o.ora} className="colonna-energia" title={`${due(o.ora)}: ${o.media.toFixed(1)}`}>
            <span
              className={'barra-energia' + (e.migliore && o.ora >= e.migliore.da && o.ora < e.migliore.a ? ' top' : '')}
              style={{ height: `${(o.media / 3) * 100}%` }}
            />
            <small>{o.ora}</small>
          </div>
        ))}
      </div>
      <p className="piccolo">Energia media (da 1 a 3) che hai segnato per ogni ora del giorno.</p>
    </section>
  )
}

// ---------------------------------------------------------------------
// URGENTE / IMPORTANTE (matrice di Eisenhower)
// ---------------------------------------------------------------------
const QUADRANTI = [
  ['fare', 'Urgente e importante', 'fare subito'],
  ['pianificare', 'Importante, non urgente', 'da far crescere'],
  ['delegare', 'Urgente, non importante', 'da delegare'],
  ['eliminare', 'Né urgente né importante', 'da eliminare'],
]

function UrgenteImportante({ m }) {
  const tot = m.conRisposta
  return (
    <section className="sezione-report">
      <h2>Urgente / Importante</h2>
      {!tot ? (
        <p className="piccolo">
          Ancora nessuna attività con entrambe le risposte (Urgente? Importante?) in questo periodo.
        </p>
      ) : (
        <>
          <div className="matrice">
            {QUADRANTI.map(([chiave, nome, consiglio]) => (
              <div key={chiave} className={'quadrante q-' + chiave}>
                <small>{nome}</small>
                <b>{ore(m[chiave])} h</b>
                <span>
                  {percento((m[chiave] / tot) * 100)} · {consiglio}
                </span>
              </div>
            ))}
          </div>
          <p className="piccolo">
            Calcolato su {ore(tot)} h di lavoro con entrambe le risposte
            {m.senzaRisposta > 0 && ` (${ore(m.senzaRisposta)} h senza risposta)`}.
          </p>
        </>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------
// ALLINEAMENTO ALL'OBIETTIVO PRINCIPALE (1..5)
// ---------------------------------------------------------------------
function Allineamento({ a, obiettivo }) {
  const max = Math.max(1, ...Object.values(a.perVoto))
  return (
    <section className="sezione-report">
      <h2>In linea con l'obiettivo</h2>
      {obiettivo && <p className="piccolo">🎯 {obiettivo}</p>}
      {a.media == null ? (
        <p className="piccolo">Ancora nessun voto da 1 a 5 in questo periodo.</p>
      ) : (
        <>
          <div className="numero-grande">
            {a.media.toLocaleString('it-IT', { maximumFractionDigits: 1 })} / 5{' '}
            <small>media pesata sulle ore ({ore(a.minutiConVoto)} h con voto)</small>
          </div>
          <div className="grafico">
            {[5, 4, 3, 2, 1].map((n) => (
              <div key={n} className="barra-pista">
                <span className="voto">{n}</span>
                <span className="barra voto-barra" style={{ width: `${(a.perVoto[n] / max) * 70}%` }} />
                <span className="barra-valore">{ore(a.perVoto[n])} h</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------
// EXPORT CSV / PDF
// ---------------------------------------------------------------------
function Esporta({ p, tipo, r, svr, fattore, deleg, matrice, allin, cop, frasi, aderenza, righe, stato }) {
  const [stato_, setStato] = useState('')
  const titolo =
    tipo === 'analisi'
      ? `Report finale per il coach - periodo di analisi ${p.etichetta}`
      : `${{ giorno: 'Giorno', settimana: 'Settimana', mese: 'Mese' }[tipo]}: ${p.etichetta}`

  async function esegui(crea, nome, tipoMime) {
    setStato('Preparo il file…')
    try {
      const contenuto = await crea()
      const blob = contenuto instanceof Blob ? contenuto : new Blob([contenuto], { type: tipoMime })
      const esito = await condividiOScarica(blob, nome, titolo)
      setStato(esito === 'scaricato' ? 'File scaricato ✓' : esito === 'condiviso' ? 'Condiviso ✓' : '')
    } catch (e) {
      setStato(`Errore: ${e.message}`)
    }
    setTimeout(() => setStato(''), 3000)
  }

  const vuoto = !righe.length
  return (
    <section className="sezione-report">
      <h2>Condividi con il coach</h2>
      <div className="bottoni-export">
        <button
          className="primario"
          disabled={vuoto}
          onClick={() =>
            esegui(
              () =>
                pdfReport({
                  titolo,
                  sottotitolo: `Periodo: ${p.da.toLocaleDateString('it-IT')} – ${new Date(p.a.getTime() - 1).toLocaleDateString('it-IT')}`,
                  r,
                  svr: svr && svr.righe.some((x) => x.stima != null) ? svr : null,
                  fattore,
                  deleg,
                  matrice,
                  allin,
                  cop,
                  frasi,
                  aderenza,
                }),
              nomeFile(tipo === 'analisi' ? `report finale ${p.etichetta}` : p.etichetta, 'pdf'),
            )
          }
        >
          📄 PDF
        </button>
        <button
          className="secondario"
          disabled={vuoto}
          onClick={() =>
            esegui(
              () =>
                csvRiepilogo({
                  titolo,
                  r,
                  svr: svr && svr.righe.some((x) => x.stima != null) ? svr : null,
                  fattore,
                }),
              nomeFile(`riepilogo ${p.etichetta}`, 'csv'),
              'text/csv;charset=utf-8',
            )
          }
        >
          CSV riepilogo
        </button>
        <button
          className="secondario"
          disabled={vuoto}
          onClick={() =>
            esegui(
              () => csvDettaglio(righe, stato.categorie, stato.sottocategorie),
              nomeFile(`dettaglio ${p.etichetta}`, 'csv'),
              'text/csv;charset=utf-8',
            )
          }
        >
          CSV dettaglio ore
        </button>
      </div>
      {stato_ && <p className="piccolo centrato">{stato_}</p>}
    </section>
  )
}

function RigaCategoria({ x, n, fattore, stato }) {
  const [aperta, setAperta] = useState(false)
  const conSotto = x.sotto.some((s) => s.id)
  return (
    <>
      <tr onClick={() => conSotto && setAperta(!aperta)} className={conSotto ? 'cliccabile' : ''}>
        <td>
          <span className="pallino" style={{ '--colore': x.categoria.colore }} />
          {n}. {x.categoria.nome}
          {conSotto && <span className="freccia"> {aperta ? '▾' : '▸'}</span>}
        </td>
        <td className="num">{x.minuti ? ore(x.minuti) : '–'}</td>
        <td className="num">{x.minuti ? percento(x.percentuale) : ''}</td>
        {fattore && <td className="num">{x.minuti ? ore(x.minuti * fattore) : '–'}</td>}
      </tr>
      {aperta &&
        x.sotto.map((s) => (
          <tr key={s.id ?? 'senza'} className="riga-sotto-report">
            <td>{s.id ? stato.sottocategorie.find((y) => y.id === s.id)?.nome ?? '?' : 'altro / non specificato'}</td>
            <td className="num">{ore(s.minuti)}</td>
            <td className="num">{percento((s.minuti / x.minuti) * 100)}</td>
            {fattore && <td />}
          </tr>
        ))}
    </>
  )
}
