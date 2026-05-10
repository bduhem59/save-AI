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
    Extrait le JSON de la réponse Claude.
    Gère le cas où Claude ajoute des balises markdown autour du JSON.
    """
    cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("`").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            return json.loads(match.group())
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


def _mock_summary(source: str, title: str, content: str, metadata: dict, nb_comments: int) -> dict:
    """Synthèses fictives réalistes — aucun appel Claude."""

    # YouTube : mode déterminé par la longueur réelle du transcript
    if source == "youtube":
        word_count = len(content.split()) if content else 0
        if word_count < 5_000:
            summary_data = _mock_youtube_standard(title, metadata)
        elif word_count <= 15_000:
            summary_data = _mock_youtube_enriched(title, metadata)
        else:
            summary_data = _mock_youtube_chapters(title, metadata)
        return {
            "summary_data": summary_data,
            "tokens_input": 0,
            "tokens_output": 0,
            "cost_eur": 0.0,
            "model_used": "mock",
        }

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
            "citations": [
                {"texte": "Citation exemple extraite de l'article.", "source": "Auteur mock"},
            ],
            "donnees": {
                "source_type": "article",
                "auteur": metadata.get("author", "Auteur non renseigné"),
                "date": metadata.get("published_date"),
                "type_contenu": "analyse",
            },
            "conclusions": "[MOCK] Conclusion factuelle synthétisant la position de l'article.",
            "category": "IA",
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
                "points_minoritaires": ["Point de vue minoritaire mais notable"],
                "evolution_fil": "Discussion restée polarisée sans consensus clair.",
                "citations": [
                    {"auteur": "u/mock_user_1", "texte": "Citation exemple d'un commentaire représentatif."},
                    {"auteur": "u/mock_user_2", "texte": "Deuxième citation illustrant un autre angle."},
                ],
            },
            "conclusions": "[MOCK] Conclusion sur la dynamique de la discussion Reddit.",
            "category": "Société",
            "tags": ["mock-data", "reddit", "test"],
            "relevance_score": 3,
        },
    }

    return {
        "summary_data": base.get(source, base["article"]),
        "tokens_input": 0,
        "tokens_output": 0,
        "cost_eur": 0.0,
        "model_used": "mock",
    }


# ── Mocks YouTube par mode ────────────────────────────────────────────────────

def _mock_youtube_standard(title: str, metadata: dict) -> dict:
    return {
        "tldr": f"[MOCK • standard] Vidéo YouTube : {title}. Synthèse courte générée sans appel Claude (MOCK_MODE=true).",
        "points_cles": [
            "Point clé 1 présenté dans la vidéo",
            "Information technique ou factuelle exposée",
            "Troisième point factuel extrait du contenu",
            "Quatrième enseignement ou démonstration",
            "Conclusion ou takeaway principal",
        ],
        "citations": [
            {"texte": "Citation exemple prononcée dans la vidéo.", "intervenant": "présentateur"},
        ],
        "donnees": {
            "source_type": "youtube",
            "chaine": metadata.get("channel", "Chaîne inconnue"),
            "duree": metadata.get("duration", "??:??"),
            "type_contenu": "tuto",
        },
        "conclusions": "[MOCK] Message principal de la vidéo résumé en une phrase.",
        "category": "Tech & Dev",
        "tags": ["mock-data", "youtube", "standard"],
        "relevance_score": 3,
        "mode_used": "standard",
    }


def _mock_youtube_enriched(title: str, metadata: dict) -> dict:
    return {
        "tldr": (
            f"[MOCK • enriched] Vidéo YouTube enrichie : {title}. "
            "Synthèse détaillée sans appel Claude (MOCK_MODE=true). "
            "La vidéo couvre plusieurs angles avec données chiffrées et interviews."
        ),
        "points_cles": [
            "Point clé 1 avec données précises mentionnées dans la vidéo",
            "Argument 2 appuyé par des exemples concrets",
            "Fait 3 extrait du transcript avec contexte",
            "Point 4 : contradiction ou nuance apportée",
            "Insight 5 sur les implications pratiques",
            "Donnée 6 : chiffre précis cité",
            "Point 7 : perspective d'un intervenant",
            "Conclusion partielle 8 sur la première partie",
        ],
        "citations": [
            {"texte": "Première citation marquante du présentateur.", "intervenant": "présentateur"},
            {"texte": "Citation d'un invité sur le sujet principal.", "intervenant": "invité"},
            {"texte": "Troisième citation illustrant un point de friction.", "intervenant": "présentateur"},
        ],
        "donnees_chiffrees": [
            "Donnée A : valeur X dans le contexte Y mentionné à la minute Z",
            "Donnée B : statistique précise issue d'une étude citée",
        ],
        "donnees": {
            "source_type": "youtube",
            "chaine": metadata.get("channel", "Chaîne inconnue"),
            "duree": metadata.get("duration", "??:??"),
            "type_contenu": "interview",
        },
        "conclusions": "[MOCK] La vidéo conclut sur deux points distincts qui synthétisent l'ensemble du propos.",
        "category": "Business",
        "tags": ["mock-data", "youtube", "enriched"],
        "relevance_score": 4,
        "mode_used": "enriched",
    }


def _mock_youtube_chapters(title: str, metadata: dict) -> dict:
    return {
        "tldr": (
            f"[MOCK • chapters] Longue vidéo YouTube : {title}. "
            "Synthèse par chapitres sans appel Claude (MOCK_MODE=true). "
            "Format interview/conférence avec plusieurs intervenants couvrant des sujets distincts."
        ),
        "chapters": [
            {
                "title": "Introduction et présentation des intervenants",
                "timestamp_approx": "00:00 - 12:00",
                "key_points": [
                    "Présentation du contexte et des objectifs de la vidéo",
                    "Présentation des intervenants et de leurs parcours",
                    "Annonce du plan général de la vidéo",
                ],
                "key_quotes": [
                    "Citation d'introduction du premier intervenant.",
                ],
            },
            {
                "title": "Premier sujet principal",
                "timestamp_approx": "12:00 - 35:00",
                "key_points": [
                    "Argument central du premier sujet avec données chiffrées",
                    "Exemple concret illustrant la thèse principale",
                    "Nuance ou contre-argument apporté par un second intervenant",
                    "Point factuel précis avec référence à une source externe",
                ],
                "key_quotes": [
                    "Citation marquante sur le premier sujet.",
                    "Réponse clé d'un autre intervenant.",
                ],
            },
            {
                "title": "Deuxième sujet : approfondissement et débat",
                "timestamp_approx": "35:00 - 58:00",
                "key_points": [
                    "Transition vers le deuxième angle de la discussion",
                    "Données et preuves présentées à l'appui",
                    "Débat entre intervenants sur ce point précis",
                ],
                "key_quotes": [
                    "Formulation synthétique d'un des intervenants.",
                ],
            },
            {
                "title": "Conclusion et takeaways",
                "timestamp_approx": "58:00 - 75:00",
                "key_points": [
                    "Récapitulatif des points clés de la vidéo",
                    "Recommandations ou prochaines étapes proposées",
                    "Message final de clôture des intervenants",
                ],
                "key_quotes": [
                    "Citation de clôture mémorable.",
                ],
            },
        ],
        "donnees_chiffrees": [
            "Donnée mock A : valeur chiffrée et son contexte dans la vidéo",
            "Donnée mock B : statistique mentionnée par un intervenant",
        ],
        "donnees": {
            "source_type": "youtube",
            "chaine": metadata.get("channel", "Chaîne inconnue"),
            "duree": metadata.get("duration", "??:??"),
            "type_contenu": "conférence",
        },
        "conclusion_globale": (
            "[MOCK] La vidéo développe plusieurs axes complémentaires et conclut sur des "
            "recommandations pratiques. Les intervenants s'accordent sur les grandes lignes "
            "tout en maintenant des nuances sur les détails d'application."
        ),
        "category": "Culture",
        "tags": ["mock-data", "youtube", "chapters"],
        "relevance_score": 4,
        "mode_used": "chapters",
    }
