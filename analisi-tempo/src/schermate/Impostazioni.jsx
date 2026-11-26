// =====================================================================
// IMPOSTAZIONI: fascia di lavoro, categorie e sottocategorie, uscita.
// Queste modifiche vanno direttamente al database, quindi serve la rete.
// =====================================================================
import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import * as archivio from '../lib/archivio.js'
import { usaArchivio } from '../lib/usaArchivio.js'
import { vaiA } from '../lib/navigazione.js'

const GIORNI = [
  ['1', 'Lunedì'],
  ['2', 'Martedì'],
  ['3', 'Mercoledì'],
  ['4', 'Giovedì'],
  ['5', 'Venerdì'],
  ['6', 'Sabato'],
  ['0', 'Domenica'],
]

export default function Impostazioni({ utente }) {
  const stato = usaArchivio()
  const [messaggio, setMessaggio] = useState('')

  /** Esegue una modifica sul database e ricarica la configurazione. */
  async function esegui(promessa, ok = 'Salvato ✓') {
    setMessaggio('Salvo…')
    const { error } = await promessa
    if (error) {
      setMessaggio(
        navigator.onLine ? `Errore: ${error.message}` : 'Serve la rete per cambiare le impostazioni.',
      )
      return
    }
    await archivio.scaricaConfigurazione().catch(() => {})
    setMessaggio(ok)
    setTimeout(() => setMessaggio(''), 2000)
  }

  return (
    <div className="impostazioni">
      {messaggio && <div className="avviso fisso">{messaggio}</div>}

      <button className="sezione voce-menu" onClick={() => vaiA('/notifiche')}>
        <span>
          🔔 <b>Notifiche ogni ora</b>
          <small>Attiva, prova, pausa per oggi, installazione sull'iPhone</small>
        </span>
        <span className="freccia">›</span>
      </button>

      <Fascia stato={stato} utente={utente} esegui={esegui} />
      <Categorie stato={stato} esegui={esegui} />

      <section className="sezione">
        <h2>Account</h2>
        <p className="piccolo">Collegato come {utente.email}</p>
        {stato.coda.length > 0 && (
          <p className="messaggio-errore">
            Hai {stato.coda.length} ore non ancora inviate: se esci adesso le perdi. Aspetta di
            avere rete.
          </p>
        )}
        <button className="secondario largo" onClick={() => supabase.auth.signOut()}>
          Esci
        </button>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------
function Fascia({ stato, utente, esegui }) {
  const fascia = stato.impostazioni?.fascia ?? {}
  const ore = Array.from({ length: 25 }, (_, h) => h)

  function cambia(giorno, campo, valore) {
    const nuova = { ...fascia, [giorno]: { ...fascia[giorno], [campo]: valore } }
    const f = nuova[giorno]
    if (f.fine <= f.inizio) return // fine dopo l'inizio
    esegui(supabase.from('impostazioni').update({ fascia: nuova }).eq('user_id', utente.id))
  }

  return (
    <section className="sezione">
      <h2>Fascia di lavoro</h2>
      <p className="piccolo">
        Le ore fuori dalla fascia non ti vengono proposte da compilare. Togli la spunta per i giorni
        di riposo.
      </p>
      {GIORNI.map(([g, nome]) => {
        const f = fascia[g] ?? { attivo: false, inizio: 8, fine: 23 }
        return (
          <div key={g} className={'riga-fascia' + (f.attivo ? '' : ' riposo')}>
            <label className="interruttore">
              <input
                type="checkbox"
                checked={!!f.attivo}
                onChange={(e) => cambia(g, 'attivo', e.target.checked)}
              />
              {nome}
            </label>
            {f.attivo ? (
              <span className="orari">
                <select value={f.inizio} onChange={(e) => cambia(g, 'inizio', +e.target.value)}>
                  {ore.slice(0, 24).map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
                –
                <select value={f.fine} onChange={(e) => cambia(g, 'fine', +e.target.value)}>
                  {ore.slice(1).map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
              </span>
            ) : (
              <span className="piccolo">riposo</span>
            )}
          </div>
        )
      })}
    </section>
  )
}

// ---------------------------------------------------------------------
function Categorie({ stato, esegui }) {
  const [aperta, setAperta] = useState(null)

  function aggiungiCategoria() {
    const ordine = Math.max(0, ...stato.categorie.map((c) => c.ordine)) + 1
    esegui(supabase.from('categorie').insert({ nome: 'Nuova categoria', colore: '#64748b', ordine }))
  }

  return (
    <section className="sezione">
      <h2>Categorie</h2>
      <p className="piccolo">
        Tocca una categoria per rinominarla, cambiarne il colore o le sottocategorie. Una categoria
        nascosta non compare più nei pulsanti ma resta nei report passati.
      </p>
      {stato.categorie.map((c) => (
        <div key={c.id} className="riga-categoria" style={{ '--colore': c.colore }}>
          <button className="riga-categoria-testa" onClick={() => setAperta(aperta === c.id ? null : c.id)}>
            <span className="pallino" />
            <span className={c.attiva ? '' : 'barrato'}>{c.nome}</span>
            {!c.lavoro && <small> (non è lavoro)</small>}
            <span className="freccia">{aperta === c.id ? '▾' : '▸'}</span>
          </button>
          {aperta === c.id && <ModificaCategoria categoria={c} stato={stato} esegui={esegui} />}
        </div>
      ))}
      <button className="secondario largo" onClick={aggiungiCategoria}>
        + Nuova categoria
      </button>
    </section>
  )
}

function ModificaCategoria({ categoria: c, stato, esegui }) {
  const [nome, setNome] = useState(c.nome)
  const [descrizione, setDescrizione] = useState(c.descrizione ?? '')
  const [nuovaSotto, setNuovaSotto] = useState('')
  const sotto = stato.sottocategorie.filter((s) => s.categoria_id === c.id)
  const aggiorna = (campi) => esegui(supabase.from('categorie').update(campi).eq('id', c.id))

  return (
    <div className="modifica-categoria">
      <label>
        Nome
        <input
          value={nome}
          maxLength={60}
          onChange={(e) => setNome(e.target.value)}
          onBlur={() => nome.trim() && nome !== c.nome && aggiorna({ nome: nome.trim() })}
        />
      </label>
      <label>
        Descrizione
        <input
          value={descrizione}
          maxLength={120}
          onChange={(e) => setDescrizione(e.target.value)}
          onBlur={() =>
            descrizione !== (c.descrizione ?? '') && aggiorna({ descrizione: descrizione.trim() || null })
          }
        />
      </label>
      {c.lavoro && (
        <div className="riga-dettaglio">
          <span>Ore stimate al mese</span>
          <input
            className="input-corto"
            inputMode="decimal"
            placeholder="–"
            defaultValue={c.ore_stimate_mese == null ? '' : Number(c.ore_stimate_mese)}
            onBlur={(e) => {
              const t = e.target.value.trim().replace(',', '.')
              const v = t === '' ? null : Number(t)
              if (v != null && (Number.isNaN(v) || v < 0)) return
              if (v !== (c.ore_stimate_mese == null ? null : Number(c.ore_stimate_mese))) {
                aggiorna({ ore_stimate_mese: v })
              }
            }}
          />
        </div>
      )}
      <div className="riga-dettaglio">
        <span>Colore</span>
        <input type="color" value={c.colore} onChange={(e) => aggiorna({ colore: e.target.value })} />
      </div>
      <label className="interruttore">
        <input type="checkbox" checked={c.lavoro} onChange={(e) => aggiorna({ lavoro: e.target.checked })} />
        Conta come lavoro (togli la spunta per pause e tempo personale)
      </label>
      <label className="interruttore">
        <input type="checkbox" checked={c.attiva} onChange={(e) => aggiorna({ attiva: e.target.checked })} />
        Mostra tra i pulsanti
      </label>

      <h3>Sottocategorie</h3>
      {sotto.length === 0 && <p className="piccolo">Nessuna.</p>}
      {sotto.map((s) => (
        <div key={s.id} className="riga-sotto">
          <span className={s.attiva ? '' : 'barrato'}>{s.nome}</span>
          <button
            className="link"
            onClick={() =>
              esegui(supabase.from('sottocategorie').update({ attiva: !s.attiva }).eq('id', s.id))
            }
          >
            {s.attiva ? 'Nascondi' : 'Mostra'}
          </button>
        </div>
      ))}
      <form
        className="riga-sotto"
        onSubmit={(e) => {
          e.preventDefault()
          if (!nuovaSotto.trim()) return
          esegui(
            supabase.from('sottocategorie').insert({
              categoria_id: c.id,
              nome: nuovaSotto.trim(),
              ordine: sotto.length + 1,
            }),
          )
          setNuovaSotto('')
        }}
      >
        <input
          placeholder="Nuova sottocategoria"
          maxLength={40}
          value={nuovaSotto}
          onChange={(e) => setNuovaSotto(e.target.value)}
        />
        <button className="secondario">Aggiungi</button>
      </form>
    </div>
  )
}
