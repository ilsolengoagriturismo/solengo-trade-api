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
} from '../lib/report.js'
import { posizione } from '../lib/mappa.js'
import { csvRiepilogo, csvDettaglio, pdfReport, condividiOScarica, nomeFile } from '../lib/esporta.js'

const TIPI = [
  ['giorno', 'Giorno'],
  ['settimana', 'Settimana'],
  ['mese', 'Mese'],
]

export default function Report() {
  const stato = usaArchivio()
  const [tipo, setTipo] = useState(() => sessionStorage.getItem('report.tipo') || 'mese')
  const [riferimento, setRiferimento] = useState(() => new Date())
  const [dati, setDati] = useState({ righe: [], daTelefono: false, caricato: false })

  const p = useMemo(() => periodo(tipo, riferimento), [tipo, riferimento])
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
  const etichettaOre = { giorno: 'Ore', settimana: 'Ore-sett.', mese: 'Ore-mese' }[tipo]
  const svr = tipo === 'mese' ? stimaVsReale(r.righe, fattore) : null
  const deleg = delegabili(dati.righe, stato.categorie)
  const matrice = matriceUrgenteImportante(dati.righe, stato.categorie)
  const allin = allineamentoObiettivo(dati.righe, stato.categorie)
  const bolle = bolleMappa(dati.righe, stato.categorie)

  return (
    <div className="report">
      <div className="schede" role="tablist">
        {TIPI.map(([t, testo]) => (
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
      <Delegabili deleg={deleg} r={r} />
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
        cop={cop}
        righe={dati.righe}
        stato={stato}
      />
    </div>
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
function Delegabili({ deleg, r }) {
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
            Hai risposto a "Potevi delegarla?" per {ore(deleg.minutiConRisposta)} h su{' '}
            {ore(deleg.minutiLavoro)} h di lavoro
            {deleg.minutiConRisposta < deleg.minutiLavoro * 0.5 &&
              ': rispondi più spesso (+ Dettagli dopo la registrazione) per un dato più affidabile'}
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
function Esporta({ p, tipo, r, svr, fattore, deleg, matrice, allin, cop, righe, stato }) {
  const [stato_, setStato] = useState('')
  const nomePeriodo = { giorno: 'Giorno', settimana: 'Settimana', mese: 'Mese' }[tipo]
  const titolo = `${nomePeriodo}: ${p.etichetta}`

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
                }),
              nomeFile(p.etichetta, 'pdf'),
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
