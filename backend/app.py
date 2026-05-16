"""
Save & Resurface — Backend FastAPI
Endpoints : POST /save | GET /list | GET /search | GET /stats
"""

import os
import sys
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

# Permet d'importer storage et claude_client depuis le même dossier
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env", override=True)

from fastapi import FastAPI, Query, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator

import storage
import claude_client

# --- Logging ---

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# --- Application FastAPI ---

@asynccontextmanager
async def lifespan(_: FastAPI):
    storage.init_db()
    mode = "MOCK (pas d'appel Claude)" if claude_client.MOCK_MODE else "CLAUDE API (appels réels)"
    logger.info(f"Save & Resurface démarré — mode {mode}")
    logger.info(f"Base de données : {storage.DB_PATH}")
    yield


app = FastAPI(
    title="Save & Resurface API",
    version="0.2.0",
    description="Backend local pour sauvegarder et synthétiser du contenu web avec Claude.",
    lifespan=lifespan,
)

# CORS ouvert : accepte les requêtes de l'extension Chrome et du frontend Next.js en local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SOURCES_VALIDES = {"article", "reddit", "youtube"}

CATEGORIES_VALIDES = {
    "IA", "Tech & Dev", "Business", "Productivité",
    "Sport", "Société", "Culture", "Autre",
}


# --- Modèles Pydantic ---

class SaveRequest(BaseModel):
    source: str           # "article" | "reddit" | "youtube"
    url: str
    title: str
    content: str
    metadata: dict = {}
    comments: list = []   # Reddit uniquement : liste de {author, score, level, text}

    @field_validator("source")
    @classmethod
    def source_valide(cls, v: str) -> str:
        if v not in SOURCES_VALIDES:
            raise ValueError(f"Source invalide '{v}'. Valeurs acceptées : {SOURCES_VALIDES}")
        return v

    @field_validator("content")
    @classmethod
    def content_non_vide(cls, v: str) -> str:
        if not v or len(v.strip()) < 10:
            raise ValueError("Contenu trop court ou vide — vérifier le scraper")
        return v


class ConsultationRequest(BaseModel):
    action: str  # "read" | "archived" | "dismissed"


class FavoriteRequest(BaseModel):
    is_favorite: bool


class ReadRequest(BaseModel):
    is_read: bool


# --- Endpoints ---

def _run_summary_background(
    save_id: int,
    source: str,
    title: str,
    content: str,
    metadata: dict,
    comments: list,
) -> None:
    """Tourne en background thread : appelle Claude puis met à jour le save."""
    try:
        result = claude_client.generate_summary(
            source=source,
            title=title,
            content=content,
            metadata=metadata,
            comments=comments,
        )
        sd = result["summary_data"]
        raw_category = sd.get("category", "Autre")
        category = raw_category if raw_category in CATEGORIES_VALIDES else "Autre"
        storage.update_save_summary(
            save_id=save_id,
            summary=sd.get("synthesis", ""),
            title=sd.get("title"),
            tags=sd.get("tags", []),
            relevance_score=sd.get("relevance_score", 3),
            category=category,
            tokens_input=result["tokens_input"],
            tokens_output=result["tokens_output"],
            cost_eur=result["cost_eur"],
            model_used=result["model_used"],
        )
        logger.info(
            f"[SAVE #{save_id}] synthèse prête | {source} | {sd.get('title', title)[:60]!r} | "
            f"catégorie: {category} | coût: {result['cost_eur']:.4f}€"
        )
    except Exception:
        logger.exception(f"[SAVE #{save_id}] Erreur lors de la synthèse background")
        storage.update_save_summary(
            save_id=save_id,
            summary="",
            tags=[],
            relevance_score=3,
            category="Autre",
            tokens_input=0,
            tokens_output=0,
            cost_eur=0.0,
            model_used="",
            status="error",
        )


@app.post("/save")
def save_content(req: SaveRequest, background_tasks: BackgroundTasks) -> dict:
    """
    Sauvegarde un contenu web.
    Retourne immédiatement après insertion — la synthèse Claude tourne en arrière-plan.
    Si l'URL existe déjà en base, retourne le save existant sans appeler Claude.
    """
    # Déduplication par URL
    existing_id = storage.url_exists(req.url)
    if existing_id:
        save = storage.get_save_by_id(existing_id)
        logger.info(f"[DOUBLON] URL déjà sauvegardée (id={existing_id}) : {req.url}")
        return {
            "id": existing_id,
            "status": save.get("status", "done"),
            "tags": save["tags"],
            "summary": save["summary"],
            "relevance_score": save.get("relevance_score", 3),
            "category": save.get("category"),
            "cost_eur": 0.0,
            "duplicate": True,
        }

    # Insertion immédiate avec status pending
    save_id = storage.insert_pending_save(
        url=req.url,
        source=req.source,
        title=req.title,
        content_raw=req.content,
        metadata=req.metadata,
    )
    logger.info(f"[SAVE #{save_id}] inséré (pending) — synthèse Claude en cours…")

    # Synthèse Claude en arrière-plan
    background_tasks.add_task(
        _run_summary_background,
        save_id=save_id,
        source=req.source,
        title=req.title,
        content=req.content,
        metadata=req.metadata,
        comments=req.comments,
    )

    return {
        "id": save_id,
        "status": "processing",
        "duplicate": False,
    }


@app.get("/list")
def list_saves(
    source: Optional[str] = Query(None, description="Filtrer par source : article | reddit | youtube"),
    tag: Optional[str] = Query(None, description="Filtrer par tag exact"),
    category: Optional[str] = Query(None, description="Filtrer par catégorie"),
    limit: int = Query(50, ge=1, le=200, description="Nombre max de résultats"),
) -> dict:
    """Liste les saves triés par date décroissante, sans le contenu brut."""
    saves = storage.list_saves(source=source, tag=tag, category=category, limit=limit)
    for s in saves:
        s.pop("content_raw", None)
    return {"saves": saves, "count": len(saves)}


@app.get("/search")
def search_saves(
    q: str = Query(..., min_length=1, description="Terme de recherche"),
) -> dict:
    """Recherche full-text dans titre, contenu, synthèse et tags."""
    results = storage.search_saves(q)
    for r in results:
        r.pop("content_raw", None)
    return {"results": results, "count": len(results), "query": q}


@app.get("/stats")
def get_stats() -> dict:
    """Statistiques globales : total saves, répartition sources/catégories, coûts Claude, top tags."""
    return storage.get_stats()


@app.get("/saves/{save_id}")
def get_save(save_id: int) -> dict:
    """Retourne un save complet (avec contenu brut) par son ID. Met à jour last_consulted_at."""
    save = storage.get_save_by_id(save_id)
    if not save:
        raise HTTPException(status_code=404, detail=f"Save #{save_id} introuvable")
    storage.touch_consulted(save_id)
    return save


@app.patch("/saves/{save_id}/favorite")
def toggle_favorite(save_id: int, req: FavoriteRequest) -> dict:
    """Bascule l'état favori d'un save."""
    if not storage.get_save_by_id(save_id):
        raise HTTPException(status_code=404, detail=f"Save #{save_id} introuvable")
    storage.set_favorite(save_id, req.is_favorite)
    return {"ok": True, "is_favorite": req.is_favorite}


@app.patch("/saves/{save_id}/read")
def mark_read(save_id: int, req: ReadRequest) -> dict:
    """Marque un save comme lu ou non lu (action explicite utilisateur)."""
    if not storage.get_save_by_id(save_id):
        raise HTTPException(status_code=404, detail=f"Save #{save_id} introuvable")
    storage.set_read(save_id, req.is_read)
    return {"ok": True, "is_read": req.is_read}


@app.post("/saves/{save_id}/consult")
def record_consultation(save_id: int, req: ConsultationRequest) -> dict:
    """Enregistre une action de consultation (lu, archivé, ignoré)."""
    if not storage.get_save_by_id(save_id):
        raise HTTPException(status_code=404, detail=f"Save #{save_id} introuvable")
    storage.record_consultation(save_id, req.action)
    return {"ok": True}


# --- Point d'entrée pour exécution directe ---

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("BACKEND_PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
