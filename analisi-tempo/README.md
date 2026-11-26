# Il mio tempo — analisi del proprio tempo

Web app da usare sul telefono per l'esercizio **"Un'analisi del proprio tempo"** del corso
Hi-Performance. Ogni ora registri in pochi secondi che cosa hai fatto. L'app poi ti mostra
dove va davvero il tuo tempo.

**Stato dei lavori**

| Fase | Contenuto | Stato |
|---|---|---|
| 1 | Database, login, registrazione rapida, timeline, uso offline | ✅ pronta |
| 2 | App installabile (PWA) e notifiche orarie | da fare |
| 3 | Report giorno / settimana / mese | da fare |
| 4 | Stima vs Reale, ore delegabili, export CSV e PDF | da fare |

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

Al primo accesso l'app crea da sola le 9 categorie e la fascia 8:00–23:00.

*(L'installazione sulla Home e le notifiche arrivano con la Fase 2.)*

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

---

## Per lo sviluppo (facoltativo)

```bash
cd analisi-tempo
cp .env.example .env.local   # e inserisci URL e chiave
npm install
npm run dev                  # apre l'app su http://localhost:5173
npm test                     # test automatici dei calcoli sulle ore
```
