# EdilGest AI - Project Requirements Document

## Problem Statement
L'app EdilGest non riusciva a salvare foto e documenti. Quando si cliccava "Salva", l'app iniziava a girare e poi si bloccava dopo un timeout.

## Root Cause Analysis
**Firebase Storage non è abilitato** nel progetto Firebase. Il codice tentava di caricare file su Firebase Storage, ma il servizio non era stato attivato nella console Firebase.

## Solution Implemented

### Code Changes
1. **`src/firebase.ts`**:
   - Timeout aumentato da 60s a 120s per file grandi
   - Aggiunta verifica del bucket Storage
   - Messaggi di errore dettagliati con istruzioni per la risoluzione
   - Gestione specifica per errori: `storage/unauthorized`, `storage/bucket-not-found`, CORS, network

2. **`src/App.tsx`**:
   - Migliorata gestione errori in `handleSave()` (task edit)
   - Migliorata gestione errori in `handleAddTask()` (nuovo task)
   - Migliorata gestione errori in `handleAddDocument()` (nuovo documento)

### User Action Required
L'utente deve abilitare Firebase Storage nella console Firebase seguendo la guida in `FIREBASE_STORAGE_SETUP.md`.

## Architecture
- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS
- **Backend**: Firebase (Firestore, Storage, Auth)
- **Auth**: Google Sign-In

## Core Features
1. Gestione Progetti e Cantieri
2. Task Management (Job Tracker)
3. Hub Documentale con upload file
4. Chat di progetto
5. Notifiche
6. Sistema di abbonamenti (Starter/Pro/Enterprise)

## What's Been Implemented (Fix)
- [x] Miglioramento gestione errori upload
- [x] Messaggi di errore chiari per l'utente
- [x] Guida dettagliata per abilitare Firebase Storage
- [x] Verifica configurazione bucket

## Next Steps (User)
1. Abilitare Firebase Storage nella console Firebase
2. Pubblicare le regole di sicurezza (file `storage.rules`)
3. Testare l'upload di file

## Future Backlog
- P1: Integrazione AI con Gemini per scanner documenti
- P1: Budgeting e controllo costi
- P2: Gantt chart per cronoprogramma
- P2: Geolocalizzazione cantieri
- P3: Firma digitale
- P3: Modalità offline
