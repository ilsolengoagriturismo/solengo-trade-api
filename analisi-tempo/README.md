# Il mio tempo — analisi del proprio tempo

Web app da usare sul telefono per l'esercizio **"Un'analisi del proprio tempo"** del corso
Hi-Performance. Ogni ora registri in pochi secondi che cosa hai fatto. L'app poi ti mostra
dove va davvero il tuo tempo.

**Stato dei lavori**

| Fase | Contenuto | Stato |
|---|---|---|
| 1 | Database, login, registrazione rapida, timeline, uso offline | ✅ pronta |
| 2 | App installabile (PWA) e notifiche orarie | ✅ pronta |
| 3 | Report giorno / settimana / mese | ✅ pronta |
| 4 | Stima vs Reale, ore delegabili, export CSV e PDF | ✅ pronta |

---

## Come è fatta (in breve)

- **Vite + React**: l'interfaccia. Sono pagine statiche, quindi Vercel le pubblica gratis.
- **Supabase**: il database (Postgres), il login via email e, dalla Fase 2, l'invio orario
  delle notifiche.
- **Row Level Security**: ogni utente vede solo i propri dati. Per ora l'utente sei solo tu,
  ma le tabelle sono già pronte per più persone.
- **Offline**: ogni registrazione viene salvata subito sul telefono e inviata al database
  appena c'è rete.

```
analisi-tempo/
├── supabase/migrations/   ← modifiche al database, numerate in ordine
├── src/
│   ├── lib/ore.js         ← calcoli sulle ore (ore mancanti, fascia, ora legale)
│   ├── lib/archivio.js    ← salvataggio sul telefono + sincronizzazione
│   ├── schermate/         ← Registra, Giornata, Impostazioni, Login
│   └── componenti/        ← pezzi riutilizzati (editor dell'ora, pulsanti)
└── README.md
```

---

## Messa in funzione (da fare una volta sola)

Servono circa 20 minuti, dal computer. Entrambi i servizi sono gratuiti per questo uso.

### Passo 1 — Crea il progetto Supabase

1. Vai su <https://supabase.com> → **Start your project** e accedi (va bene anche con GitHub).
2. **New project**:
   - Name: `il-mio-tempo`
   - Database password: premi **Generate**, poi **salvala** nel gestore password
   - Region: **Central EU (Frankfurt)**
3. Aspetta un paio di minuti che il progetto sia pronto.

### Passo 2 — Crea le tabelle

1. Nel progetto apri **SQL Editor** (menu a sinistra) → **New query**.
2. Apri il file `supabase/migrations/20261126000001_schema_iniziale.sql`, copia **tutto** il
   contenuto, incollalo e premi **Run**.
3. Deve comparire *"Success. No rows returned"*.
4. Ripeti con `supabase/migrations/20261126000003_stime.sql`, che contiene le tue ore
   stimate. La migrazione `…0002_notifiche.sql` si esegue più avanti, al passo 8.

> Le migrazioni vanno eseguite **in ordine di numero**, una volta sola ciascuna. Le prossime
> fasi aggiungeranno altri file in questa cartella.

### Passo 3 — Prendi le chiavi

**Project Settings → API** (oppure il pulsante **Connect** in alto). Copia:

- **Project URL** (`https://xxxx.supabase.co`) → servirà come `VITE_SUPABASE_URL`
- chiave **anon / public** (oppure **publishable**) → servirà come `VITE_SUPABASE_ANON_KEY`

⚠️ **Non usare mai** la chiave `service_role` / `secret` nell'app: quella apre tutto il database.

### Passo 4 — Configura il login via email

In **Authentication**:

1. **Sign In / Providers → Email**: deve essere attivo. Puoi lasciare spento
   "Confirm email".
2. **Emails → Magic Link** (il modello della mail). Sostituisci il testo con questo, così la
   mail contiene **sia il link sia il codice**:

   ```html
   <h2>Accedi a Il mio tempo</h2>
   <p>Il tuo codice: <b style="font-size:24px">{{ .Token }}</b></p>
   <p>Oppure tocca qui (solo se usi l'app da Safari, non dalla Home):
      <a href="{{ .ConfirmationURL }}">Entra</a></p>
   ```

   **Perché il codice?** Se l'app è installata sulla Home dell'iPhone, il link della mail si
   apre in Safari, che per iOS è un'app diversa. Saresti dentro Safari e non nell'app. Il
   codice invece lo scrivi direttamente nell'app.
3. **URL Configuration**: lo compilerai dopo il Passo 5, quando avrai l'indirizzo di Vercel.
   - Site URL: `https://<il-tuo-indirizzo>.vercel.app`
   - Redirect URLs: aggiungi `https://<il-tuo-indirizzo>.vercel.app/**`

> Il servizio email incluso in Supabase manda **poche mail all'ora**. Per una persona basta.
> Se compare "troppe richieste", aspetta qualche minuto.

### Passo 5 — Pubblica su Vercel

1. Vai su <https://vercel.com> e accedi con GitHub.
2. **Add New… → Project** → importa il repository `solengo-trade-api`.
3. Nella schermata di configurazione:
   - **Project Name**: `il-mio-tempo`
   - **Root Directory**: premi **Edit** e scegli **`analisi-tempo`** ← importante
   - Framework Preset: **Vite** (lo riconosce da solo)
   - **Environment Variables**: aggiungi le due variabili del Passo 3
     (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`)
4. **Deploy**. Dopo un minuto avrai un indirizzo tipo `https://il-mio-tempo.vercel.app`.
5. Torna al Passo 4.3 e inserisci questo indirizzo in Supabase.

> Finché il codice è sul ramo `claude/...`, in Vercel vai su **Settings → Git** e imposta
> come *Production Branch* quel ramo, oppure unisci il ramo in `main`.

### Passo 6 — Primo accesso dal telefono

1. Apri l'indirizzo di Vercel in **Safari** sull'iPhone.
2. Scrivi la tua email → **Mandami il link di accesso**.
3. Apri la mail, copia il **codice** e scrivilo nell'app → **Entra**.

Al primo accesso l'app crea da sola le 9 categorie e la fascia 5:00–24:00 (migrazione 0005; prima era 8:00–23:00).

---

## Notifiche orarie (Fase 2)

Come funziona: ogni ora al minuto 0 l'**orologio del database** (pg_cron) chiama la funzione
`notifica-oraria` su Supabase. La funzione manda il promemoria solo se quell'ora è nella tua
fascia di lavoro, non è un giorno di riposo, non hai messo "pausa per oggi" e non l'hai già
registrata. Vercel non c'entra, quindi va bene il piano gratuito.

### Passo 7 — Genera le chiavi

1. Dal computer apri `https://<il-tuo-indirizzo>.vercel.app/genera-chiavi`.
2. Premi **Genera chiavi** (una volta sola). Ottieni tre valori: `VAPID_PUBLIC_KEY`,
   `VAPID_PRIVATE_KEY` e `CRON_SECRET`. Tieni la pagina aperta per i passi successivi.
3. Su **Vercel** → progetto → **Settings → Environment Variables** aggiungi
   `VITE_VAPID_PUBLIC_KEY` = il valore di `VAPID_PUBLIC_KEY`.
   Poi **Deployments → ⋯ → Redeploy**, perché la variabile entri nell'app.

⚠️ La chiave **privata** va solo su Supabase, mai su Vercel.

### Passo 8 — Segreti nel Vault e seconda migrazione

In Supabase → **SQL Editor**, esegui questo (sostituisci i due valori tra apici):

```sql
select vault.create_secret('https://xxxx.supabase.co', 'url_progetto');   -- Project URL
select vault.create_secret('IL-TUO-CRON_SECRET', 'segreto_cron');         -- dal passo 7
```

Poi apri `supabase/migrations/20261126000002_notifiche.sql`, copia tutto, incolla e **Run**.

> Se compare un errore su `pg_cron` o `pg_net`: **Database → Extensions**, attiva `pg_cron`
> e `pg_net`, poi riesegui la migrazione.

### Passo 9 — Pubblica la funzione `notifica-oraria`

1. Supabase → **Edge Functions → Secrets** (o *Manage secrets*). Aggiungi:

   | Nome | Valore |
   |---|---|
   | `VAPID_PUBLIC_KEY` | dal passo 7 |
   | `VAPID_PRIVATE_KEY` | dal passo 7 |
   | `CRON_SECRET` | dal passo 7 |
   | `VAPID_SUBJECT` | `mailto:` più la tua email, per esempio `mailto:nome@dominio.it` |

2. **Edge Functions → Deploy a new function → Via Editor**.
   - Nome: **`notifica-oraria`** (esattamente così)
   - Cancella il codice di esempio e incolla tutto il file
     `supabase/functions/notifica-oraria/index.ts`
   - **Deploy function**
3. Nella pagina della funzione apri **Details** (o *Settings*) e **disattiva
   "Verify JWT" / "Enforce JWT verification"**, poi salva. La funzione controlla da sola chi
   la chiama: il segreto del cron oppure il tuo login.

*(Se preferisci la riga di comando: `npx supabase functions deploy notifica-oraria --no-verify-jwt`.)*

### Passo 10 — Installa l'app sull'iPhone e attiva le notifiche

Serve iOS 16.4 o successivo (Impostazioni → Generali → Info → Versione iOS).

1. Apri l'indirizzo dell'app in **Safari**.
2. Tocca **Condividi** (il quadrato con la freccia) → **Aggiungi alla schermata Home** →
   lascia attivo *Apri come app web* → **Aggiungi**.
3. Apri **"Il mio tempo"** dall'icona sulla Home. Rientra con il **codice** della mail:
   l'app installata non condivide il login con Safari.
4. **Impostazioni → 🔔 Notifiche ogni ora → Attiva notifiche** → **Consenti**.
5. Tocca **Invia notifica di prova**, poi **chiudi l'app** (torna alla Home). In pochi secondi
   deve arrivare *"Notifica di prova ✓"*. Toccala: si apre la registrazione.

**Da sapere**
- La prima notifica oraria arriva allo scoccare dell'ora successiva, per esempio alle 15:00
  per l'ora 14–15.
- Con l'iPhone in **Full immersion / Non disturbare** le notifiche arrivano in silenzio. Se
  vuoi, aggiungi "Il mio tempo" alle app consentite.
- Se disinstalli l'icona dalla Home, le notifiche si fermano. Reinstallala e ripeti il punto 4.

---

## Come si usa

**Registra** (schermata principale)
- In alto vedi l'ora da compilare, per esempio *13:00 – 14:00*.
- **Un tocco su una categoria** assegna tutta l'ora a quella categoria.
- **↺ Come l'ora precedente** copia l'ultima ora registrata.
- **½ Dividi l'ora**: tocca 2 o 3 categorie, scegli 15/30/45 minuti per ciascuna (il totale
  deve fare 60), poi **Salva**.
- Se mancano più ore te le propone una dopo l'altra. Con **"Stessa attività per tutte"**
  le compili tutte con un solo tocco.
- Dopo il salvataggio compare un riquadro con **Annulla** e **+ Dettagli** (facoltativi):
  sottocategoria, *Potevi delegarla?*, energia, nota.

**Giornata**: la timeline del giorno. Tocca un'ora per modificarla, dividerla o compilarla.
Con le frecce ‹ › cambi giorno.

**Impostazioni**
- *Fascia di lavoro*: orari per ogni giorno della settimana. Togli la spunta nei giorni di
  riposo. Le ore fuori fascia non ti vengono chieste, ma puoi sempre registrarle dalla
  timeline.
- *Categorie*: tocca una categoria per cambiarne nome, descrizione e colore, per indicare
  se conta come lavoro, per nasconderla o per gestire le sottocategorie. Le categorie non
  si cancellano, si nascondono, così i report passati restano corretti.

**Report** (Giorno / Settimana / Mese, con ‹ › per cambiare periodo)
- In alto: ore di lavoro, **% di ore compilate** (quante ore della fascia hai registrato) e,
  nel mese in corso, la **proiezione a fine mese**.
- **Tabella del corso**: Attività | Ore-mese | %. La % è sul totale lavoro, quindi
  "Pausa / personale" è esclusa. Tocca una categoria con ▸ per vedere le sottocategorie.
- **Grafico** a barre con i colori delle categorie.
- **Stima vs Reale** (solo vista Mese). Stima, reale e scostamento. Nel mese in corso il
  confronto è con la proiezione, altrimenti a metà mese sembrerebbe tutto "sotto stima". In
  arancione le attività che si discostano di più del 25%. Le stime si cambiano con
  **Modifica stime** o in Impostazioni → Categorie.
- **Ore delegabili**: totale, % del lavoro e dettaglio per categoria. Indica anche per quante
  ore hai risposto alla domanda, così sai quanto è affidabile il dato.
- **Condividi con il coach**: **PDF** (tabella del corso, stima vs reale, delegabili,
  grafico), **CSV riepilogo** (lo stesso formato per Excel/Numbers) e **CSV dettaglio ore**
  (una riga per ogni ora registrata). Sull'iPhone si apre il menu Condividi (Mail,
  WhatsApp, File…). Sul computer il file viene scaricato.

**Come si calcola la proiezione**: le ore registrate finora × (ore di fascia del mese ÷ ore di
fascia già trascorse). Se lasci molte ore vuote, la proiezione viene più bassa del reale: per
questo in alto vedi la % di ore compilate.

**Notifiche** (Impostazioni → 🔔): attiva o disattiva su questo telefono, notifica di prova,
**pausa notifiche per oggi** (domani ripartono da sole), promemoria orari on/off.

## Aggiornare il database per le fasi 3 e 4

La Fase 3 non cambia il database. Per la Fase 4 esegui nello **SQL Editor** il file
`supabase/migrations/20261126000003_stime.sql`. Aggiunge le ore stimate e inserisce la tua
stima: 140, 28, 20, 28, 28, 0, 5, 28 = **277 ore al mese**.

**Ordine delle migrazioni** (ognuna una volta sola):

| File | Fase |
|---|---|
| `20261126000001_schema_iniziale.sql` | 1 |
| `20261126000002_notifiche.sql` | 2 (prima i due segreti nel Vault, passo 8) |
| `20261126000003_stime.sql` | 4 |

---

## Checklist di prova — Fase 1

Spunta ogni voce dal telefono:

- [ ] Accesso: ricevo la mail con il codice, lo scrivo ed entro.
- [ ] Chiudo Safari e lo riapro: sono ancora dentro, senza rifare l'accesso.
- [ ] Vedo 8 categorie colorate più "Pausa / personale" in grigio.
- [ ] In alto c'è l'ora giusta da compilare (alle 14:10 deve chiedere 13:00 – 14:00).
- [ ] Al primo uso propone le ore di oggi dalle 8:00 in poi ("N ore da compilare").
- [ ] Un tocco su "Lavoro autonomo": compare ✓ e passa all'ora successiva.
- [ ] **Annulla** rimette l'ora com'era.
- [ ] "Stessa attività per tutte" + un tocco compila tutte le ore mancanti.
- [ ] "Come l'ora precedente" copia l'ultima ora.
- [ ] "Dividi l'ora": Telefono 45′ + Pausa 15′ → Salva. In Giornata l'ora è divisa in due colori.
- [ ] + Dettagli su "Supervisione": compaiono Cucina / Sala / Fornitori / Eventi.
- [ ] Giornata: tocco un'ora, aggiungo una nota, Salva → compare ✎.
- [ ] **Offline**: attivo la modalità aereo, registro un'ora, compare la barra gialla
      *"Sei offline… (1 da inviare)"*. Tolgo la modalità aereo, la barra sparisce in pochi
      secondi.
- [ ] Impostazioni: rinomino una categoria e il nome cambia anche nei pulsanti.
- [ ] Impostazioni: metto la domenica come riposo; la domenica non mi chiede ore.
- [ ] Da computer, in Supabase → **Table Editor → registrazioni**, vedo le mie righe.

## Checklist di prova — Fase 2

- [ ] Da Safari: Condividi → Aggiungi alla schermata Home. Compare l'icona con l'orologio verde.
- [ ] Aperta dalla Home, l'app è a schermo intero (niente barra di Safari).
- [ ] Rientro con il codice della mail.
- [ ] Da Safari (non installata), Impostazioni → Notifiche mostra la guida passo passo.
- [ ] Dall'app installata: **Attiva notifiche** → l'iPhone chiede il permesso → Consenti →
      *"✓ Notifiche attive su questo telefono"*.
- [ ] **Invia notifica di prova**, chiudo l'app → arriva entro pochi secondi.
- [ ] Tocco la notifica → si apre direttamente la schermata Registra.
- [ ] Aspetto lo scoccare dell'ora (dentro la fascia) → arriva *"14:00 – 15:00…"*.
- [ ] Registro l'ora in anticipo → allo scoccare **non** arriva la notifica per quell'ora.
- [ ] **Pausa notifiche per oggi** → per il resto della giornata non arriva nulla.
- [ ] Modalità aereo, apro l'app dalla Home → si apre lo stesso (offline) e posso registrare.
- [ ] Da computer: Supabase → **Table Editor → push_iscrizioni** c'è una riga "iPhone" con
      `ultimo_invio` aggiornato.
- [ ] Se una notifica non arriva: Supabase → **Edge Functions → notifica-oraria → Logs**, e
      in **Integrations → Cron → Jobs** il lavoro `notifica-oraria` con le sue esecuzioni.

## Checklist di prova — Fasi 3 e 4

- [ ] Nel menu in basso c'è **📊 Report**.
- [ ] Vista **Mese**: la tabella mostra le 8 attività numerate, Ore-mese e %. La somma delle
      % fa 100. "Pausa / personale" è sotto, segnata "esclusa".
- [ ] Le ore del report corrispondono a quelle della schermata Giornata (prova su un giorno).
- [ ] Tocco "4. Supervisione ▸": compaiono Cucina / Sala / Fornitori / Eventi.
- [ ] **Settimana** parte dal lunedì; **Giorno** mostra lo stesso totale della Giornata.
- [ ] Mese in corso: in alto c'è "proiezione mese"; nel mese scorso no.
- [ ] **Stima vs Reale**: il totale delle stime è **277**. Modifico una stima → cambia lo
      scostamento.
- [ ] **Ore delegabili**: dopo aver risposto "Sì" a qualche ora, compaiono qui.
- [ ] **PDF** → si apre Condividi → lo mando a me stesso via Mail e si legge bene.
- [ ] **CSV riepilogo** → aperto con Numbers/Excel, le colonne sono separate e gli accenti
      corretti.
- [ ] Modalità aereo → il report mostra lo stesso i dati recenti, con l'avviso "Offline".

---

## Per lo sviluppo (facoltativo)

```bash
cd analisi-tempo
cp .env.example .env.local   # e inserisci URL e chiave
npm install
npm run dev                  # apre l'app su http://localhost:5173
npm test                     # test automatici (ore, regole delle notifiche)
```

Struttura aggiunta in Fase 2:

```
public/sw.js                                   ← service worker: offline + notifiche
public/manifest.webmanifest                    ← nome, icona, avvio a schermo intero
supabase/functions/notifica-oraria/index.ts    ← invio dei push (regole + servizio)
supabase/migrations/…0002_notifiche.sql        ← tabella iscrizioni + orologio pg_cron
src/lib/notifiche.js, src/schermate/Notifiche.jsx
```

Fasi 3 e 4:

```
src/lib/report.js         ← calcoli: periodi, riepilogo, proiezione, stima vs reale, delegabili
src/lib/esporta.js        ← CSV (formato Excel italiano) e PDF (jsPDF, caricato solo quando serve)
src/schermate/Report.jsx
supabase/migrations/…0003_stime.sql
```
