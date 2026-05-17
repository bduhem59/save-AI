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

# Tarifs Claude en USD par million de tokens (approximatifs)
_PRICING = {
    "claude-sonnet-4-6":         {"input": 3.0,  "output": 15.0},
    "claude-haiku-4-5-20251001": {"input": 0.80, "output": 4.0},
}

# YouTube mode "chapters" peut atteindre 3500 mots (~4600 tokens) de synthèse
_MAX_TOKENS = {
    "article": 4096,
    "reddit":  4096,
    "youtube": 8192,
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
    Extrait le JSON de la réponse Claude — 3 tentatives en cascade.
    Tentative 1 : json.loads direct
    Tentative 2 : json.loads sur la sous-chaîne {…} extraite par regex
    Tentative 3 : json_repair (guillemets non échappés, virgules manquantes, etc.)
    """
    cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("`").strip()

    # Tentative 1 : parse direct
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Tentative 2 : extraire le bloc {…} et re-parser
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    # Tentative 3 : json_repair — gère guillemets non échappés, JSON tronqué, etc.
    try:
        from json_repair import repair_json
        logger.warning(
            f"[Claude] JSON malformé — recours à json_repair "
            f"(preview : {cleaned[:200]!r})"
        )
        repaired = repair_json(cleaned, return_objects=True)
        if isinstance(repaired, dict):
            return repaired
    except Exception as e:
        logger.warning(f"[Claude] json_repair a échoué : {e}")

    raise ValueError(
        f"Impossible de parser la réponse Claude après 3 tentatives. "
        f"Début du JSON cassé : {cleaned[:200]!r}"
    )


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
        return _mock_summary(source, title, content, metadata, len(comments))

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
        max_tokens=_MAX_TOKENS.get(source, 4096),
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


def _mock_summary(source: str, title: str, _content: str, _metadata: dict, _nb_comments: int) -> dict:
    """Synthèses fictives au nouveau format — aucun appel Claude."""

    mocks = {
        "article": {
            "title": title,
            "synthesis": (
                f"L'article porte sur : **{title}**.\n\n"
                "L'argument central est présenté dès l'introduction et développé en plusieurs temps. "
                "L'auteur s'appuie sur des données empiriques pour étayer sa thèse principale, "
                "tout en reconnaissant les limites de son analyse.\n\n"
                "## Point de tension\n\n"
                "Une position minoritaire mais documentée contredit le consensus dominant. "
                "Elle mérite attention car elle repose sur un corpus différent de celui cité par l'auteur.\n\n"
                "*— Synthèse générée en MOCK_MODE, aucun appel Claude réel.*"
            ),
            "category": "IA",
            "tags": ["mock-data", "article", "test"],
            "relevance_score": 3,
        },
        "reddit": {
            "title": title,
            "synthesis": (
                f"Thread Reddit : **{title}**.\n\n"
                "Il s'agit d'un thread de type « ask », avec une majorité de réponses convergentes "
                "autour de deux ou trois approches pratiques. Les désaccords portent sur les détails "
                "d'implémentation plutôt que sur le principe.\n\n"
                "## Ce qui fait consensus\n\n"
                "La recommandation la plus fréquemment citée est soutenue par des retours d'expérience "
                "concrets. Elle est rarement contestée dans son principe.\n\n"
                "## Points de friction\n\n"
                "Quelques réponses avancent une approche alternative, jugée plus robuste à long terme "
                "mais plus coûteuse à mettre en place initialement.\n\n"
                "*— Synthèse générée en MOCK_MODE, aucun appel Claude réel.*"
            ),
            "category": "Société",
            "tags": ["mock-data", "reddit", "test"],
            "relevance_score": 3,
        },
        "youtube": {
            "title": title,
            "synthesis": (
                f"Vidéo : **{title}**.\n\n"
                "Format identifié : masterclass. Le contenu est dense et structuré autour d'un argument "
                "central développé en plusieurs étapes. Chaque section s'appuie sur des exemples concrets.\n\n"
                "## Première partie\n\n"
                "Le présentateur pose le cadre conceptuel et introduit les données clés. "
                "Plusieurs chiffres sont avancés pour justifier la pertinence du sujet.\n\n"
                "## Développement\n\n"
                "L'argumentation progresse logiquement. Une tension apparaît entre deux approches "
                "présentées comme complémentaires, mais dont les implications pratiques divergent.\n\n"
                "## Conclusion\n\n"
                "Le message final est clair et actionnable. Une mise en garde est formulée sur les "
                "cas où l'approche recommandée ne s'applique pas.\n\n"
                "*— Synthèse générée en MOCK_MODE, aucun appel Claude réel.*"
            ),
            "category": "Tech & Dev",
            "tags": ["mock-data", "youtube", "test"],
            "relevance_score": 3,
        },
    }

    return {
        "summary_data": mocks.get(source, mocks["article"]),
        "tokens_input": 0,
        "tokens_output": 0,
        "cost_eur": 0.0,
        "model_used": "mock",
    }
