"""
Save & Resurface — Backend FastAPI
Endpoints : POST /save | GET /list | GET /search | GET /stats
"""

import os
import sys
import logging
from pathlib import Path
from typing import Optional

# Permet d'importer storage et claude_client depuis le même dossier
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env", override=True)

from fastapi import FastAPI, Query, HTTPException
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

app = FastAPI(
    title="Save & Resurface API",
    version="0.1.0",
    description="Backend local pour sauvegarder et synthétiser du contenu web avec Claude.",
)

# CORS ouvert : accepte les requêtes de l'extension Chrome et de Streamlit en local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SOURCES_VALIDES = {"article", "reddit", "youtube"}


@app.on_event("startup")
def startup() -> None:
    storage.init_db()
    mode = "MOCK (pas d'appel Claude)" if claude_client.MOCK_MODE else "CLAUDE API (appels réels)"
    logger.info(f"Save & Resurface démarré — mode {mode}")
    logger.info(f"Base de données : {storage.DB_PATH}")


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


# --- Endpoints ---

@app.post("/save")
def save_content(req: SaveRequest) -> dict:
    """
    Sauvegarde un contenu web avec synthèse Claude.
    Si l'URL existe déjà en base, retourne le save existant sans appeler Claude.
    """
    # Déduplication par URL
    existing_id = storage.url_exists(req.url)
    if existing_id:
        save = storage.get_save_by_id(existing_id)
        logger.info(f"[DOUBLON] URL déjà sauvegardée (id={existing_id}) : {req.url}")
        return {
            "id": existing_id,
            "tags": save["tags"],
            "summary": save["summary"],
            "relevance_score": save.get("relevance_score", 3),
            "cost_eur": 0.0,
            "duplicate": True,
        }

    # Génération de la synthèse (Claude réel ou mock selon MOCK_MODE)
    result = claude_client.generate_summary(
        source=req.source,
        title=req.title,
        content=req.content,
        metadata=req.metadata,
        comments=req.comments,
    )

    sd = result["summary_data"]

    # Conversion du JSON structuré en texte markdown pour stockage
    summary_text = _format_summary_as_markdown(sd)

    # Insertion en base
    save_id = storage.insert_save(
        url=req.url,
        source=req.source,
        title=req.title,
        content_raw=req.content,
        summary=summary_text,
        tags=sd.get("tags", []),
        relevance_score=sd.get("relevance_score", 3),
        # On stocke aussi le JSON structuré dans metadata pour les futures fonctionnalités
        metadata={**req.metadata, "summary_structured": sd},
        tokens_input=result["tokens_input"],
        tokens_output=result["tokens_output"],
        cost_eur=result["cost_eur"],
        model_used=result["model_used"],
    )

    logger.info(
        f"[SAVE #{save_id}] {req.source} | {req.title[:60]!r} | "
        f"coût: {result['cost_eur']:.4f}€ | modèle: {result['model_used']}"
    )

    return {
        "id": save_id,
        "tags": sd.get("tags", []),
        "summary": summary_text,
        "relevance_score": sd.get("relevance_score", 3),
        "cost_eur": result["cost_eur"],
        "duplicate": False,
    }


@app.get("/list")
def list_saves(
    source: Optional[str] = Query(None, description="Filtrer par source : article | reddit | youtube"),
    tag: Optional[str] = Query(None, description="Filtrer par tag exact"),
    limit: int = Query(50, ge=1, le=200, description="Nombre max de résultats"),
) -> dict:
    """Liste les saves triés par date décroissante, sans le contenu brut."""
    saves = storage.list_saves(source=source, tag=tag, limit=limit)
    # content_raw exclu des listes (trop volumineux)
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
    """Statistiques globales : total saves, répartition sources, coûts Claude, top tags."""
    return storage.get_stats()


@app.get("/saves/{save_id}")
def get_save(save_id: int) -> dict:
    """Retourne un save complet (avec contenu brut) par son ID."""
    save = storage.get_save_by_id(save_id)
    if not save:
        raise HTTPException(status_code=404, detail=f"Save #{save_id} introuvable")
    return save


@app.post("/saves/{save_id}/consult")
def record_consultation(save_id: int, req: ConsultationRequest) -> dict:
    """Enregistre une action de consultation (lu, archivé, ignoré)."""
    if not storage.get_save_by_id(save_id):
        raise HTTPException(status_code=404, detail=f"Save #{save_id} introuvable")
    storage.record_consultation(save_id, req.action)
    return {"ok": True}


# --- Utilitaires ---

def _format_summary_as_markdown(sd: dict) -> str:
    """Convertit le JSON structuré Claude en texte markdown pour stockage et affichage."""
    parts = []

    if sd.get("tldr"):
        parts.append(f"**TL;DR** : {sd['tldr']}")

    if sd.get("points_cles"):
        parts.append("\n**Points clés** :")
        parts.extend(f"- {p}" for p in sd["points_cles"])

    dc = sd.get("discussion_communautaire")
    if dc:
        parts.append("\n**Discussion communautaire** :")
        if dc.get("sujets_frequents"):
            sujets = " · ".join(dc["sujets_frequents"])
            parts.append(f"Sujets fréquents : {sujets}")
        if dc.get("consensus"):
            parts.append("Consensus : " + dc["consensus"][0])
        if dc.get("citations"):
            for c in dc["citations"][:2]:
                parts.append(f'> "{c["texte"]}" — {c["auteur"]}')

    return "\n".join(parts)


# --- Point d'entrée pour exécution directe ---

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("BACKEND_PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
