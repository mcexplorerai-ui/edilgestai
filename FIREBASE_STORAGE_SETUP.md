# Guida per Abilitare Firebase Storage - EdilGest AI

## Problema Identificato
L'app non riesce a salvare foto e documenti perché **Firebase Storage non è abilitato** nel tuo progetto Firebase.

## Soluzione: Attiva Firebase Storage

### Passo 1: Accedi alla Console Firebase
1. Vai su [console.firebase.google.com](https://console.firebase.google.com)
2. Seleziona il tuo progetto: `gen-lang-client-0413066454`

### Passo 2: Attiva Storage
1. Nel menu laterale sinistro, clicca su **"Storage"** (icona della cartella)
2. Clicca il pulsante blu **"Inizia"** o **"Get Started"**
3. Ti verrà chiesto di configurare le regole di sicurezza:
   - Seleziona **"Start in production mode"** (modalità produzione)
   - Oppure **"Start in test mode"** per testare (scade dopo 30 giorni)
4. Scegli la **Location** (posizione del server):
   - Consigliato: `europe-west1` (Belgio) per utenti europei
   - Oppure `us-central1` (USA) per bassa latenza globale
5. Clicca **"Done"** o **"Fatto"**

### Passo 3: Configura le Regole di Sicurezza
1. Una volta attivato Storage, vai alla tab **"Rules"** (Regole)
2. Sostituisci le regole con quelle nel file `storage.rules` del progetto:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // File allegati ai task, dentro un progetto
    match /projects/{projectId}/{allPaths=**} {
      allow read, write: if request.auth != null;
    }

    // File personali dell'utente
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. Clicca **"Publish"** (Pubblica) per attivare le nuove regole

### Passo 4: Verifica la Configurazione
Controlla che il file `firebase-applet-config.json` contenga il campo `storageBucket` corretto:
```json
{
  "storageBucket": "gen-lang-client-0413066454.firebasestorage.app"
}
```

### Passo 5: Testa l'Upload
1. Ricarica l'applicazione
2. Prova a caricare una foto o un documento
3. Se funziona, vedrai il file nella sezione Storage della console Firebase

## Troubleshooting

### Errore "Permission Denied"
- Verifica che le regole di Storage siano pubblicate
- Controlla che l'utente sia autenticato (loggato)

### Errore "Bucket Not Found"
- Verifica che il campo `storageBucket` nel config sia corretto
- Assicurati di aver completato la procedura di attivazione di Storage

### Errore "CORS"
1. Vai su Google Cloud Console: https://console.cloud.google.com
2. Seleziona il progetto `gen-lang-client-0413066454`
3. Vai su Storage > Browser
4. Clicca sul bucket e poi su "CORS configuration"
5. Aggiungi la configurazione CORS (se necessario)

### Il caricamento è lento
- I file vengono compressi automaticamente prima dell'upload
- Per file > 5MB, l'upload può richiedere alcuni secondi
- Verifica la connessione internet

## Codice Modificato
Ho migliorato la gestione degli errori nel codice per mostrare messaggi più chiari:

1. **`src/firebase.ts`**: Timeout aumentato a 120 secondi, messaggi di errore dettagliati
2. **`src/App.tsx`**: Gestione errori migliorata in tutte le funzioni di upload

## Contatti
Se hai ancora problemi dopo aver seguito questa guida, controlla:
1. La console del browser (F12 > Console) per errori dettagliati
2. I log di Firebase nel pannello di monitoraggio
