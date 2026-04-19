from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import base64
import json
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# --- Existing Models ---
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# --- Quote Analyzer Models ---
class QuoteExtractRequest(BaseModel):
    file_base64: str
    file_name: str
    mime_type: str

class QuoteItem(BaseModel):
    descrizione: str = ""
    quantita: float = 0
    dimensioni: Optional[str] = None
    materiale: Optional[str] = None
    caratteristiche: List[str] = []
    prezzo_unitario: float = 0
    prezzo_totale: float = 0

class ExtractedQuote(BaseModel):
    fornitore: str = ""
    data_preventivo: Optional[str] = None
    validita: Optional[str] = None
    items: List[QuoteItem] = []
    totale_imponibile: float = 0
    iva: float = 0
    totale_lordo: float = 0
    posa_inclusa: bool = False
    garanzia_anni: Optional[int] = None
    tempi_consegna: Optional[str] = None
    note: Optional[str] = None

class QuoteCompareRequest(BaseModel):
    project_id: str
    quotes: List[Dict[str, Any]]
    quote_names: List[str]
    user_id: str
    categoria: str = "generale"

class SavedComparison(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    categoria: str
    quotes: List[Dict[str, Any]]
    quote_names: List[str]
    report: str
    summary: Dict[str, Any] = {}
    user_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# --- Existing Routes ---
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    return status_checks

# --- Quote Analyzer Routes ---

def _clean_json_response(text: str) -> str:
    """Extract JSON from LLM response, handling markdown code blocks."""
    # Remove markdown code blocks
    match = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
    if match:
        return match.group(1).strip()
    # Try to find JSON object directly
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        return match.group(0).strip()
    return text.strip()

@api_router.post("/quotes/extract")
async def extract_quote(request: QuoteExtractRequest):
    """Extract structured data from a quote document using Gemini Vision."""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            return {"success": False, "error": "EMERGENT_LLM_KEY non configurata"}
        
        session_id = f"quote-extract-{uuid.uuid4()}"
        
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message="""Sei un esperto analista di preventivi edili italiani. 
Analizza il documento fornito ed estrai tutti i dati in formato JSON strutturato.

RISPONDI SOLO con il JSON, senza commenti o testo aggiuntivo.

Formato richiesto:
{
  "fornitore": "Nome azienda",
  "data_preventivo": "DD/MM/YYYY o null",
  "validita": "es. 30 giorni o null",
  "items": [
    {
      "descrizione": "Descrizione completa del prodotto/servizio",
      "quantita": 1,
      "dimensioni": "es. 120x140 cm o null",
      "materiale": "es. PVC, Alluminio, Legno o null",
      "caratteristiche": ["lista", "caratteristiche", "tecniche"],
      "prezzo_unitario": 0.00,
      "prezzo_totale": 0.00
    }
  ],
  "totale_imponibile": 0.00,
  "iva": 0.00,
  "totale_lordo": 0.00,
  "posa_inclusa": true/false,
  "garanzia_anni": null,
  "tempi_consegna": "es. 30 giorni lavorativi o null",
  "note": "altre informazioni rilevanti o null"
}

Se non riesci a leggere un valore, usa null. Se non riesci a calcolare un totale, sommalo dalle voci.
Estrai TUTTE le voci del preventivo, non saltarne nessuna."""
        ).with_model("gemini", "gemini-2.5-flash")
        
        # Create image content from base64
        image_content = ImageContent(image_base64=request.file_base64)
        
        user_message = UserMessage(
            text=f"Analizza questo preventivo edile ({request.file_name}) ed estrai i dati strutturati in JSON.",
            file_contents=[image_content]
        )
        
        response = await chat.send_message(user_message)
        logger.info(f"Gemini extraction response length: {len(response)}")
        
        # Parse JSON from response
        cleaned = _clean_json_response(response)
        extracted_data = json.loads(cleaned)
        
        return {"success": True, "data": extracted_data}
        
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}, raw response: {response[:500]}")
        return {"success": False, "error": f"Impossibile analizzare la risposta AI: {str(e)}", "raw_response": response[:1000]}
    except Exception as e:
        logger.error(f"Extract error: {e}")
        return {"success": False, "error": str(e)}

@api_router.post("/quotes/compare")
async def compare_quotes(request: QuoteCompareRequest):
    """Compare multiple quotes and generate AI analysis report."""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            return {"success": False, "error": "EMERGENT_LLM_KEY non configurata"}
        
        if len(request.quotes) < 2:
            return {"success": False, "error": "Servono almeno 2 preventivi per il confronto"}
        
        session_id = f"quote-compare-{uuid.uuid4()}"
        
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message="""Sei un consulente esperto del settore edile italiano. 
Analizzi preventivi e fornisci consigli professionali dettagliati sui migliori rapporti qualità/prezzo.
Rispondi sempre in italiano. Usa un tono professionale ma comprensibile."""
        ).with_model("gemini", "gemini-2.5-flash")
        
        # Build comparison prompt
        quotes_text = ""
        for i, (quote, name) in enumerate(zip(request.quotes, request.quote_names)):
            quotes_text += f"\n--- PREVENTIVO {i+1}: {name} ---\n"
            quotes_text += json.dumps(quote, indent=2, ensure_ascii=False)
            quotes_text += "\n"
        
        prompt = f"""Confronta questi {len(request.quotes)} preventivi per la categoria "{request.categoria}" e genera un report dettagliato.

{quotes_text}

Genera il report nel seguente formato JSON:
{{
  "riepilogo": {{
    "miglior_qualita_prezzo": {{
      "fornitore": "Nome",
      "motivo": "Spiegazione breve"
    }},
    "piu_economico": {{
      "fornitore": "Nome",
      "prezzo": 0,
      "sacrifici": "Cosa si perde scegliendo il più economico"
    }},
    "premium": {{
      "fornitore": "Nome",
      "prezzo": 0,
      "vantaggi": "Perché costa di più e se ne vale la pena"
    }}
  }},
  "confronto_voci": [
    {{
      "voce": "Descrizione voce confrontata",
      "confronti": [
        {{
          "fornitore": "Nome",
          "prezzo": 0,
          "dettagli": "Specifiche tecniche",
          "valutazione": "buono/medio/scarso"
        }}
      ],
      "nota": "Differenza chiave tra i fornitori per questa voce"
    }}
  ],
  "analisi_fornitori": [
    {{
      "fornitore": "Nome",
      "pro": ["lista", "punti", "positivi"],
      "contro": ["lista", "punti", "negativi"],
      "adatto_a": "A chi è consigliato questo preventivo",
      "score": 85
    }}
  ],
  "raccomandazione": {{
    "per_risparmio": "Consiglio se obiettivo è risparmiare",
    "per_qualita": "Consiglio se obiettivo è massima qualità",
    "per_equilibrio": "Consiglio per miglior rapporto qualità/prezzo"
  }},
  "domande_fornitori": [
    "Domanda 1 da fare ai fornitori prima di decidere",
    "Domanda 2",
    "Domanda 3"
  ],
  "report_testo": "Report discorsivo completo con analisi dettagliata di almeno 300 parole"
}}

IMPORTANTE: Rispondi SOLO con il JSON, senza commenti o testo aggiuntivo. 
Analizza TUTTE le voci, confronta dimensioni, materiali, prezzi e garanzie.
Se le misure non corrispondono tra preventivi, segnalalo chiaramente."""
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        logger.info(f"Gemini comparison response length: {len(response)}")
        
        # Parse response
        cleaned = _clean_json_response(response)
        report_data = json.loads(cleaned)
        
        # Save comparison to MongoDB
        comparison = {
            "id": str(uuid.uuid4()),
            "project_id": request.project_id,
            "categoria": request.categoria,
            "quotes": request.quotes,
            "quote_names": request.quote_names,
            "report": report_data.get("report_testo", ""),
            "summary": {k: v for k, v in report_data.items() if k != "report_testo"},
            "user_id": request.user_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.quote_comparisons.insert_one({**comparison, "_id": comparison["id"]})
        # Remove MongoDB _id before returning
        comparison.pop("_id", None)
        
        return {"success": True, "comparison": comparison, "report": report_data}
        
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error in compare: {e}")
        return {"success": False, "error": f"Errore nell'analisi AI: {str(e)}"}
    except Exception as e:
        logger.error(f"Compare error: {e}")
        return {"success": False, "error": str(e)}

@api_router.get("/quotes/comparisons/{project_id}")
async def get_comparisons(project_id: str):
    """Get all saved comparisons for a project."""
    try:
        comparisons = await db.quote_comparisons.find(
            {"project_id": project_id}, 
            {"_id": 0}
        ).sort("created_at", -1).to_list(50)
        return {"success": True, "comparisons": comparisons}
    except Exception as e:
        logger.error(f"Get comparisons error: {e}")
        return {"success": False, "error": str(e)}

@api_router.get("/quotes/comparison/{comparison_id}")
async def get_comparison(comparison_id: str):
    """Get a specific comparison."""
    try:
        comparison = await db.quote_comparisons.find_one(
            {"id": comparison_id}, 
            {"_id": 0}
        )
        if not comparison:
            return {"success": False, "error": "Confronto non trovato"}
        return {"success": True, "comparison": comparison}
    except Exception as e:
        logger.error(f"Get comparison error: {e}")
        return {"success": False, "error": str(e)}

@api_router.delete("/quotes/comparison/{comparison_id}")
async def delete_comparison(comparison_id: str):
    """Delete a comparison."""
    try:
        result = await db.quote_comparisons.delete_one({"id": comparison_id})
        if result.deleted_count == 0:
            return {"success": False, "error": "Confronto non trovato"}
        return {"success": True}
    except Exception as e:
        logger.error(f"Delete comparison error: {e}")
        return {"success": False, "error": str(e)}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
