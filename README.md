# Save & Resurface

Sauvegardez du contenu web (articles, Reddit, YouTube) en 1 clic. Claude génère une synthèse factuelle automatiquement. Plus de cimetière de bookmarks jamais relus.

## Prérequis

- Python 3.10+
- [uv](https://docs.astral.sh/uv/) — `curl -LsSf https://astral.sh/uv/install.sh | sh`
- Clé API Anthropic (obtenir sur [console.anthropic.com](https://console.anthropic.com))

## Installation

```bash
# 1. Installer les dépendances
uv sync

# 2. Créer le fichier d'environnement
cp .env.example .env

# 3. Éditer .env
#    → Ajouter votre ANTHROPIC_API_KEY
#    → Garder MOCK_MODE=true pour débuter sans dépenser de tokens
```

## Lancement du backend

```bash
# Depuis la racine du projet
uv run uvicorn backend.app:app --reload --port 8000
```

- API : http://localhost:8000
- Documentation interactive (Swagger) : http://localhost:8000/docs

## Endpoints

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/save` | Sauvegarder un contenu avec synthèse Claude |
| `GET` | `/list` | Lister les saves (filtres : `source`, `tag`, `limit`) |
| `GET` | `/search?q=...` | Recherche full-text |
| `GET` | `/stats` | Statistiques et coûts Claude cumulés |
| `GET` | `/saves/{id}` | Détail complet d'un save |
| `POST` | `/saves/{id}/consult` | Enregistrer une consultation |

## Tests rapides (curl)

### Sauvegarder un article

```bash
curl -s -X POST http://localhost:8000/save \
  -H "Content-Type: application/json" \
  -d '{
    "source": "article",
    "url": "https://example.com/article-test-1",
    "title": "Les coûts d'\''inférence IA ont chuté de 80% en 2 ans",
    "content": "Selon une analyse publiée en janvier 2025, le coût moyen d'\''un appel API aux grands modèles de langage a été divisé par dix entre 2023 et 2025. Cette évolution est principalement due à la concurrence accrue entre Anthropic, OpenAI et Google, ainsi qu'\''aux optimisations matérielles sur les GPU H100.",
    "metadata": {"author": "Jane Smith", "published_date": "2025-01-15"}
  }' | python3 -m json.tool
```

### Sauvegarder un post Reddit

```bash
curl -s -X POST http://localhost:8000/save \
  -H "Content-Type: application/json" \
  -d '{
    "source": "reddit",
    "url": "https://reddit.com/r/MachineLearning/comments/abc123",
    "title": "DeepSeek-R1 vs o1 : benchmarks comparatifs",
    "content": "J'\''ai passé la semaine à comparer DeepSeek-R1 et o1 sur des tâches de raisonnement mathématique et de coding. Résultats surprenants : à 5% du prix, R1 atteint 90% des performances d'\''o1 sur mes cas d'\''usage.",
    "metadata": {"subreddit": "r/MachineLearning", "comments_filtered": 2},
    "comments": [
      {"author": "researcher_42", "score": 150, "level": 0, "text": "Ces résultats correspondent à ce que j'\''observe en prod. La latence reste le vrai problème pour les apps temps réel."},
      {"author": "ml_practitioner", "score": 89, "level": 1, "text": "DeepSeek-R1 en local sur 2x A100 tourne très bien. C'\''est viable pour un labo de recherche avec budget limité."}
    ]
  }' | python3 -m json.tool
```

### Lister, rechercher, voir les stats

```bash
# Tous les saves
curl -s http://localhost:8000/list | python3 -m json.tool

# Filtrer par source
curl -s "http://localhost:8000/list?source=article"

# Recherche
curl -s "http://localhost:8000/search?q=DeepSeek" | python3 -m json.tool

# Statistiques et coûts
curl -s http://localhost:8000/stats | python3 -m json.tool
```

### Enregistrer une consultation

```bash
curl -s -X POST http://localhost:8000/saves/1/consult \
  -H "Content-Type: application/json" \
  -d '{"action": "read"}'
```

## Mode mock vs Claude réel

| `.env` | Comportement |
|--------|-------------|
| `MOCK_MODE=true` | Synthèse fictive, 0 appel Claude, 0 coût — idéal pour développer |
| `MOCK_MODE=false` | Appels réels à Claude Sonnet 4.6 (nécessite `ANTHROPIC_API_KEY` valide) |

## Extension Chrome — Installation

**Prérequis** : le backend doit tourner (`uv run uvicorn backend.app:app --reload --port 8000`).

1. Ouvrir **`chrome://extensions/`** dans Chrome
2. Activer **Developer mode** (interrupteur en haut à droite)
3. Cliquer **Load unpacked**
4. Sélectionner le dossier **`extension/`** de ce projet
5. L'icône Save & Resurface apparaît dans la barre Chrome

> **Note** : si tu avais des onglets ouverts avant l'installation, recharge-les (F5) avant d'utiliser l'extension — les content scripts s'injectent uniquement sur les pages chargées après installation.

### Recharger après modification de l'extension

Après avoir modifié un fichier JS ou le manifest :
1. Retourner sur `chrome://extensions/`
2. Cliquer l'icône ↺ sur la carte "Save & Resurface"
3. Recharger la page web cible (F5)

### Utilisation

1. Naviguer vers un article (blog, newsletter, Substack, presse…)
2. Cliquer sur l'icône Save & Resurface dans la barre Chrome
3. Vérifier le titre détecté, cliquer **Sauvegarder**
4. La popup affiche `Saved ✓ Score X/5 · Tags : ...` en cas de succès

## Structure du projet

```
save-and-resurface/
├── backend/
│   ├── app.py            # FastAPI — tous les endpoints
│   ├── claude_client.py  # Wrapper Claude avec mode mock
│   ├── prompts.py        # Prompts système versionnés
│   └── storage.py        # Wrapper SQLite (saves + consultations)
├── extension/
│   ├── manifest.json     # Manifest V3
│   ├── popup.html        # UI de la popup
│   ├── popup.js          # Logique du bouton Save
│   ├── content.js        # Extraction Readability (injecté dans les pages)
│   ├── readability.js    # Mozilla Readability (90KB, Apache 2.0)
│   └── icons/            # Icônes 16/48/128px
├── frontend/
│   └── streamlit_app.py  # Interface (Phase 4 — à venir)
├── .env                  # Variables locales (ne pas committer)
├── .env.example          # Template de configuration
├── pyproject.toml        # Dépendances uv
└── saves.db              # Base SQLite (générée au premier démarrage)
```

## Phases

- [x] **Phase 1** — Backend FastAPI + SQLite + Claude (synthèse articles, Reddit, YouTube)
- [x] **Phase 2** — Extension Chrome articles (Manifest V3 + Mozilla Readability.js)
- [ ] **Phase 3** — Sources Reddit + YouTube + pipeline Haiku→Sonnet
- [ ] **Phase 4** — Interface Streamlit (3 onglets : Saves / Recherche / Resurface)
- [ ] **Phase 5** — Polish + documentation finale

## Coût estimé (100 saves/mois, MOCK_MODE=false)

| Source | Coût estimé |
|--------|-------------|
| 30 articles (Sonnet, ~4k tokens) | ~0,45€ |
| 30 Reddit (Haiku+Sonnet en Phase 3) | ~0,90€ |
| 30 YouTube (Sonnet, ~15k tokens) | ~0,75€ |
| **Total** | **~2,30€/mois** |
