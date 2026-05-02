import { useState, type FormEvent } from "react";

import type { ChatMessage } from "../types";

interface ChatSidebarProps {
  messages: ChatMessage[];
  persona: string;
  futureMode: boolean;
  loading: boolean;
  onSend: (message: string) => Promise<void>;
}

export function ChatSidebar({ messages, persona, futureMode, loading, onSend }: ChatSidebarProps) {
  const [draft, setDraft] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim()) return;
    const payload = draft;
    setDraft("");
    await onSend(payload);
  }

  return (
    <aside className="chat-shell">
      <div className="chat-header">
        <h2>Analista IA</h2>
        <p>{futureMode ? "Modo especulativo ativado" : "Modo realidade baseado em dados"}</p>
      </div>

      <div className="persona-card">
        <span className="badge">Persona</span>
        <p>{persona}</p>
      </div>

      <div className="chat-feed">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <p>
              Pergunte sobre uma região, peça leitura de risco ou, no modo de futuros, teste um cenário
              hipotético.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`message-bubble ${message.role}`}>
              <span className="message-mode">{message.mode.toUpperCase()}</span>
              <p>{message.content}</p>
            </div>
          ))
        )}
      </div>

      <form className="chat-form" onSubmit={handleSubmit}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={
            futureMode
              ? "Ex.: Governo X impõe embargo naval ao país Y..."
              : "Ex.: Qual transição geopolítica está mais crítica agora?"
          }
          rows={4}
        />
        <button type="submit" disabled={loading}>
          {loading ? "Processando..." : "Enviar"}
        </button>
      </form>
    </aside>
  );
}
