"""
Wrapper Claude pour Save & Resurface.
- MOCK_MODE=true  : retourne une synthèse fictive, zéro appel API
- MOCK_MODE=false : appel réel à Claude avec cache prompt activé
"""

import os
import re
import json
import logging
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env", override=True)

logger = logging.getLogger(__name__)

# --- Configuration depuis .env ---

MOCK_MODE = os.getenv("MOCK_MODE", "true").lower() == "true"
MODEL_SONNET = os.getenv("MODEL_SONNET", "claude-sonnet-4-6")
MODEL_HAIKU = os.getenv("MODEL_HAIKU", "claude-haiku-4-5-20251001")
EUR_USD_RATE = float(os.getenv("EUR_USD_RATE", "0.92"))

# Tarifs Claude en USD par million de tokens (approximatifs, mis à jour si besoin)
_PRICING = {
    "claude-sonnet-4-6": {"input": 3.0, "output": 15.0},
    "claude-haiku-4-5-20251001": {"input": 0.80, "output": 4.0},
}

# Client Anthropic initialisé à la première utilisation
_client = None


def _get_client():
    """Initialise le client Anthropic une seule fois (singleton)."""
    global _client
    if _client is None:
        from anthropic import Anthropic
        _client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    return _client


def _calculate_cost_eur(model: str, tokens_in: int, tokens_out: int) -> float:
    """Convertit le nombre de tokens en coût en euros."""
    prices = _PRICING.get(model, _PRICING[MODEL_SONNET])
    cost_usd = (tokens_in * prices["input"] + tokens_out * prices["output"]) / 1_000_000
    return round(cost_usd * EUR_USD_RATE, 6)


def _parse_json_response(raw: str) -> dict:
    """
    Extrait le JSON de la réponse Claude.
    Gère le cas où Claude ajoute des balises markdown autour du JSON.
    """
    # Nettoyer les balises ```json ... ``` si présentes
    cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("`").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Dernier recours : chercher le premier bloc JSON dans le texte
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            return json.loads(match.group())
        # Fallback si tout échoue
        logger.warning("Impossible de parser le JSON Claude, fallback texte brut")
        return {"tldr": raw[:500], "points_cles": [], "tags": [], "relevance_score": 3}


def _format_reddit_content(content: str, comments: list) -> str:
    """Formate post + commentaires en texte structuré pour le prompt."""
    parts = [f"=== POST ===\n{content}\n\n=== COMMENTAIRES ({len(comments)}) ==="]
    for c in comments:
        level = c.get("level", 0)
        indent = "  " * level
        header = f"[u/{c.get('author', '?')} | score: {c.get('score', 0)} | niveau: {level}]"
        parts.append(f"{indent}{header}\n{indent}{c.get('text', '').strip()}")
    return "\n\n".join(parts)


# --- Fonction principale ---

def generate_summary(
    source: str,
    title: str,
    content: str,
    metadata: dict,
    comments: list,
) -> dict:
    """
    Génère la synthèse d'un contenu.
    Retourne un dict avec : summary_data, tokens_input, tokens_output, cost_eur, model_used.
    """
    if MOCK_MODE:
        logger.info(f"[MOCK] Synthèse mock pour source={source}")
        return _mock_summary(source, title, metadata, len(comments))

    return _real_summary(source, title, content, metadata, comments)


def _real_summary(
    source: str,
    title: str,
    content: str,
    metadata: dict,
    comments: list,
) -> dict:
    """Appel réel à Claude Sonnet avec cache prompt sur le système."""
    from prompts import SYSTEM_ARTICLE, SYSTEM_REDDIT, SYSTEM_YOUTUBE

    client = _get_client()

    if source == "article":
        system = SYSTEM_ARTICLE
        user_content = f"Titre : {title}\n\n{content}"

    elif source == "reddit":
        system = SYSTEM_REDDIT
        user_content = _format_reddit_content(content, comments)

    elif source == "youtube":
        system = SYSTEM_YOUTUBE
        channel = metadata.get("channel", "Chaîne inconnue")
        duration = metadata.get("duration", "??:??")
        user_content = f"Titre : {title}\nChaîne : {channel}\nDurée : {duration}\n\n{content}"

    else:
        raise ValueError(f"Source inconnue : {source}")

    response = client.messages.create(
        model=MODEL_SONNET,
        max_tokens=2048,
        # cache_control sur le système = économie sur les appels répétés du même type
        system=[
            {
                "type": "text",
                "text": system,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_content}],
    )

    raw = response.content[0].text.strip()
    tokens_in = response.usage.input_tokens
    tokens_out = response.usage.output_tokens
    cost = _calculate_cost_eur(MODEL_SONNET, tokens_in, tokens_out)

    logger.info(
        f"[Claude] source={source} | {tokens_in} in + {tokens_out} out tokens | coût: {cost:.4f}€"
    )

    return {
        "summary_data": _parse_json_response(raw),
        "tokens_input": tokens_in,
        "tokens_output": tokens_out,
        "cost_eur": cost,
        "model_used": MODEL_SONNET,
    }


def _mock_summary(source: str, title: str, metadata: dict, nb_comments: int) -> dict:
    """Synthèses fictives réalistes — aucun appel Claude."""

    base = {
        "article": {
            "tldr": f"[MOCK] Article analysant : {title}. Synthèse factuelle générée sans appel Claude (MOCK_MODE=true).",
            "points_cles": [
                "Point factuel 1 extrait du texte de l'article",
                "Donnée chiffrée précise mentionnée dans le texte",
                "Argument principal exposé par l'auteur",
                "Conclusion ou prise de position présentée",
                "Référence ou source citée dans l'article",
            ],
            "donnees": {
                "source_type": "article",
                "auteur": metadata.get("author", "Auteur non renseigné"),
                "date": metadata.get("published_date"),
                "type_contenu": "analyse",
            },
            "tags": ["mock-data", "article", "test"],
            "relevance_score": 3,
        },
        "reddit": {
            "tldr": f"[MOCK] Discussion Reddit sur : {title}. {nb_comments} commentaires analysés (MOCK_MODE=true).",
            "points_cles": [
                "Point principal du post présenté par l'OP",
                "Argument factuel central de la discussion",
                "Élément de contexte mentionné dans le fil",
            ],
            "donnees": {
                "source_type": "reddit",
                "subreddit": metadata.get("subreddit", "r/unknown"),
                "commentaires_analyses": nb_comments or metadata.get("comments_filtered", 0),
                "type_contenu": "discussion",
            },
            "discussion_communautaire": {
                "sujets_frequents": [
                    "Sujet A qui revient le plus souvent dans les commentaires",
                    "Sujet B récurrent dans les échanges",
                ],
                "consensus": ["Point d'accord général observé dans la communauté"],
                "debats": ["Point activement contesté dans les commentaires"],
                "contre_arguments": ["Contre-argument notable face à la position majoritaire"],
                "citations": [
                    {
                        "auteur": "u/mock_user_1",
                        "texte": "Citation exemple d'un commentaire représentatif de la discussion.",
                    }
                ],
            },
            "tags": ["mock-data", "reddit", "test"],
            "relevance_score": 3,
        },
        "youtube": {
            "tldr": f"[MOCK] Vidéo YouTube : {title}. Synthèse mock sans appel Claude (MOCK_MODE=true).",
            "points_cles": [
                "Point clé 1 présenté dans la vidéo",
                "Information technique ou factuelle exposée",
                "Conclusion ou démonstration finale",
            ],
            "donnees": {
                "source_type": "youtube",
                "chaine": metadata.get("channel", "Chaîne inconnue"),
                "duree": metadata.get("duration", "??:??"),
                "type_contenu": "tuto",
            },
            "tags": ["mock-data", "youtube", "test"],
            "relevance_score": 3,
        },
    }

    summary_data = base.get(source, base["article"])

    return {
        "summary_data": summary_data,
        "tokens_input": 0,
        "tokens_output": 0,
        "cost_eur": 0.0,
        "model_used": "mock",
    }
