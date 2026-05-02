import type { Category, ChatResponse, StateEnvelope } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Request failed");
  }
  return response.json() as Promise<T>;
}

export async function fetchState(): Promise<StateEnvelope> {
  const response = await fetch(`${API_BASE}/state`);
  return handleResponse<StateEnvelope>(response);
}

export async function refreshState(categories: Category[]): Promise<StateEnvelope> {
  const response = await fetch(`${API_BASE}/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ categories })
  });
  return handleResponse<StateEnvelope>(response);
}

export async function toggleFutureMode(enabled: boolean): Promise<StateEnvelope> {
  const response = await fetch(`${API_BASE}/mode/futures`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled })
  });
  return handleResponse<StateEnvelope>(response);
}

export async function sendChat(message: string, categories: Category[]): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, categories })
  });
  return handleResponse<ChatResponse>(response);
}
