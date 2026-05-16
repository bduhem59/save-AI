#!/bin/bash
# stop_app.sh — Save & Resurface stopper

pkill -f "uvicorn backend.app" 2>/dev/null
pkill -f "next dev"            2>/dev/null
sleep 1
lsof -ti:3000 -ti:8000 | xargs kill -9 2>/dev/null

if lsof -ti:8000 > /dev/null 2>&1 || lsof -ti:3000 > /dev/null 2>&1; then
  osascript -e 'display notification "Erreur : ports encore occupés." with title "Save & Resurface"'
  exit 1
fi

osascript -e 'display notification "Save & Resurface arrêtée." with title "Save & Resurface"'
exit 0
