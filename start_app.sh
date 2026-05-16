#!/bin/bash
# start_app.sh — Save & Resurface launcher

export PATH="/opt/homebrew/bin:/usr/local/bin:/Users/benduhem/.local/bin:$PATH"

PROJECT="/Users/benduhem/Documents/IA/Save AI"

# ── Déjà lancée ? ─────────────────────────────────────────────────────────────
if lsof -ti:8000 > /dev/null 2>&1 || lsof -ti:3000 > /dev/null 2>&1; then
  osascript -e 'display notification "Save & Resurface est déjà lancée." with title "Save & Resurface"'
  exit 0
fi

# ── Backend ───────────────────────────────────────────────────────────────────
(cd "$PROJECT" && exec .venv/bin/uvicorn backend.app:app \
  --host 127.0.0.1 --port 8000 --reload) >> /tmp/sr-uvicorn.log 2>&1 &
disown

# ── Frontend ──────────────────────────────────────────────────────────────────
(cd "$PROJECT/frontend-next" && exec npm run dev) >> /tmp/sr-next.log 2>&1 &
disown

# ── Attendre que localhost:3000 réponde (max 60s) ─────────────────────────────
ELAPSED=0
until curl -s http://localhost:3000 > /dev/null 2>&1; do
  sleep 0.5
  ELAPSED=$((ELAPSED + 1))
  if [ "$ELAPSED" -ge 120 ]; then
    osascript -e 'display notification "Le frontend n'\''a pas démarré (timeout 60s)." with title "Save & Resurface"'
    exit 1
  fi
done

# ── Prêt ──────────────────────────────────────────────────────────────────────
osascript -e 'display notification "Save & Resurface prête sur localhost:3000" with title "Save & Resurface"'
exit 0
