# EdilGest AI - Project Requirements Document

## Original Problem Statement
Piattaforma gestionale SaaS per settore edile. Richiesta integrazione modulo "Valutatore Preventivi" con AI.

## Architecture
- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS (Firebase direct)
- **Backend**: FastAPI (Python) on port 8001
- **AI**: Gemini 2.5 Flash via Emergent LLM Key
- **Database**: MongoDB (comparisons) + Firebase Firestore (projects, tasks, docs)
- **Storage**: Firebase Storage

## Core Requirements
1. Upload fino a 5 preventivi (PDF/immagini)
2. Estrazione automatica dati con Gemini Vision AI
3. Confronto multi-dimensionale tra preventivi
4. Report AI con raccomandazioni (qualita/prezzo, economico, premium)
5. Salvataggio confronti in MongoDB
6. Cronologia confronti salvati

## What's Been Implemented
### Session 1 - Fix Upload (Jan 2026)
- [x] Fix gestione errori Firebase Storage (timeout, messaggi chiari)
- [x] Guida FIREBASE_STORAGE_SETUP.md

### Session 2 - Valutatore Preventivi (Jan 2026)
- [x] Backend API: POST /api/quotes/extract (Gemini Vision OCR)
- [x] Backend API: POST /api/quotes/compare (AI comparison report)
- [x] Backend API: GET /api/quotes/comparisons/{project_id}
- [x] Backend API: DELETE /api/quotes/comparison/{comparison_id}
- [x] Frontend: QuoteAnalyzer component (src/components/QuoteAnalyzer.tsx)
- [x] Frontend: Tab "Preventivi" integrato in ProjectDetail
- [x] Categorie: infissi, porte, persiane, pavimenti, elettrico, idraulico, altro
- [x] Cronologia confronti salvati
- [x] All 10 backend tests passed (100%)

## Prioritized Backlog
### P0 (Next)
- Frontend testing end-to-end con screenshot
- Abilitare Firebase Storage nella console Firebase

### P1
- Export PDF del report di confronto
- Inserimento manuale dati preventivo (senza OCR)
- Integrazione AI Gemini per scanner documentale (fatture/scontrini)

### P2
- Budgeting e controllo costi per progetto
- Gantt chart per cronoprogramma
- Geolocalizzazione cantieri su mappa

### P3
- Firma digitale su tablet/smartphone
- Modalita offline
- Portale cliente finale
- Inventario materiali

## User Personas
1. **Investitore Immobiliare**: Gestisce piu cantieri, confronta preventivi fornitori
2. **Tecnico/Geometra**: Gestisce task operativi, carica documenti tecnici
3. **Impresa/Contractor**: Riceve task, carica foto avanzamento
