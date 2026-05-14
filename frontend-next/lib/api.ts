import type { Save, Stats } from "@/types";

const API_BASE = "http://localhost:8000";

export async function listSaves(params: {
  source?: string;
  category?: string;
  tag?: string;
  limit?: number;
} = {}): Promise<{ saves: Save[]; count: number }> {
  const url = new URL(`${API_BASE}/list`);
  if (params.source)   url.searchParams.set("source",   params.source);
  if (params.category) url.searchParams.set("category", params.category);
  if (params.tag)      url.searchParams.set("tag",      params.tag);
  if (params.limit)    url.searchParams.set("limit",    String(params.limit));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function searchSaves(q: string): Promise<{ results: Save[]; count: number; query: string }> {
  const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function getSave(id: number): Promise<Save> {
  const res = await fetch(`${API_BASE}/saves/${id}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function getStats(): Promise<Stats> {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function markConsulted(id: number, action = "read"): Promise<void> {
  await fetch(`${API_BASE}/saves/${id}/consult`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
}

export async function setFavorite(id: number, value: boolean): Promise<void> {
  await fetch(`${API_BASE}/saves/${id}/favorite`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_favorite: value }),
  });
}

export async function setRead(id: number, value: boolean): Promise<void> {
  await fetch(`${API_BASE}/saves/${id}/read`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_read: value }),
  });
}
