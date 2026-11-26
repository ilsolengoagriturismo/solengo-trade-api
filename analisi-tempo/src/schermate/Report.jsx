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
  tempoEnergia,
  energiaComeRighe,
} from '../lib/report.js'
import { posizione } from '../lib/mappa.js'
import { csvRiepilogo, csvDettaglio, pdfReport, condividiOScarica, nomeFile } from '../lib/esporta.js'
import { aderenzaIdeale, periodoAnalisi, NOMI_GIORNI } from '../lib/settimana.js'
import { FASE_2_ATTIVA } from '../lib/fasi.js'
import { IdealeVsReale, StimaVsReale, Delegabili } from './report/SezioniAnalisi.jsx'
import {
  MappaBolle,
  Concentrazione,
  TempoEnergia,
  OreMigliori,
  UrgenteImportante,
  Allineamento,
} from './report/SezioniMappa.jsx'
import { Esporta } from './report/Esporta.jsx'

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

  // energia misurata da Esydo nello stesso periodo (vuota se non collegato)
  const [esydo, setEsydo] = useState([])
  useEffect(() => {
    let annullato = false
    archivio.caricaEnergiaEsydo(p.da, p.a).then((e) => !annullato && setEsydo(e))
    return () => {
      annullato = true
    }
  }, [p.da.getTime(), p.a.getTime()])

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
  // ore migliori: energia misurata da Esydo se c'è, altrimenti quella che segni tu
  const energia = esydo.length
    ? { ...oreMigliori(energiaComeRighe(esydo)), scala: 100, fonte: 'Esydo (escore da 0 a 100)' }
    : { ...oreMigliori(dati.righe), scala: 3, fonte: 'segnata da te (da 1 a 3)' }
  const tEn = tempoEnergia(dati.righe, esydo, stato.categorie)
  const valoreOra = stato.impostazioni?.valore_ora ? Number(stato.impostazioni.valore_ora) : null
  const frasi = frasiChiave({ r, deleg, matrice, allin, svr, conc, valoreOra, tempoEn: tEn })

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
      <TempoEnergia t={tEn} />
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
