// =====================================================================
// Pagina di servizio: /genera-chiavi
// Crea le chiavi VAPID (per le notifiche) e il segreto del cron
// DIRETTAMENTE nel browser: non passano da nessun server.
// Serve una volta sola, durante la configurazione (README, passo 7).
// =====================================================================
import { useState } from 'react'

const b64url = (byte) =>
  btoa(String.fromCharCode(...new Uint8Array(byte)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

async function genera() {
  const coppia = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])
  const pubblica = b64url(await crypto.subtle.exportKey('raw', coppia.publicKey))
  const privata = (await crypto.subtle.exportKey('jwk', coppia.privateKey)).d // già base64url
  const segreto = b64url(crypto.getRandomValues(new Uint8Array(24)))
  return { pubblica, privata, segreto }
}

export default function GeneraChiavi() {
  const [chiavi, setChiavi] = useState(null)

  return (
    <div className="contenuto guida">
      <h1>Chiavi per le notifiche</h1>
      <p>
        Premi il pulsante <b>una volta sola</b> e copia i valori dove indicato nel README. Se
        rigeneri le chiavi dovrai riattivare le notifiche sul telefono.
      </p>
      <button className="primario" onClick={async () => setChiavi(await genera())}>
        Genera chiavi
      </button>
      {chiavi && (
        <>
          <Valore
            nome="VAPID_PUBLIC_KEY"
            dove="Su Supabase (Edge Functions → Secrets) E su Vercel come VITE_VAPID_PUBLIC_KEY"
            valore={chiavi.pubblica}
          />
          <Valore
            nome="VAPID_PRIVATE_KEY"
            dove="SOLO su Supabase (Edge Functions → Secrets). Non metterla mai su Vercel."
            valore={chiavi.privata}
          />
          <Valore
            nome="CRON_SECRET"
            dove="Su Supabase (Edge Functions → Secrets) E nel Vault come segreto_cron"
            valore={chiavi.segreto}
          />
          <p className="piccolo">
            Chiudi questa pagina quando hai finito: le chiavi non vengono salvate da nessuna parte.
          </p>
        </>
      )}
    </div>
  )
}

function Valore({ nome, dove, valore }) {
  const [copiato, setCopiato] = useState(false)
  return (
    <div className="sezione">
      <b>{nome}</b>
      <p className="piccolo">{dove}</p>
      <code className="chiave">{valore}</code>
      <button
        className="secondario largo"
        onClick={async () => {
          await navigator.clipboard.writeText(valore)
          setCopiato(true)
          setTimeout(() => setCopiato(false), 1500)
        }}
      >
        {copiato ? 'Copiato ✓' : 'Copia'}
      </button>
    </div>
  )
}
