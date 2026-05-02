import { useEffect, useMemo } from "react";

import { AtlasDualGlobes } from "./components/AtlasDualGlobes";
import { ChatSidebar } from "./components/ChatSidebar";
import { ControlDock } from "./components/ControlDock";
import { useWorldStore } from "./store/worldStore";
import type { Transaction } from "./types";

export default function App() {
  const {
    envelope,
    chat,
    selectedCategories,
    selectedTransaction,
    branchHistory,
    loading,
    error,
    bootstrap,
    refresh,
    toggleCategory,
    setSelectedTransaction,
    toggleFutureMode,
    sendChat
  } = useWorldStore();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const transactions = envelope?.active_state.transactions ?? [];
  const connections = envelope?.active_state.connections ?? [];
  const filteredTransactions = useMemo(
    () => transactions.filter((transaction) => selectedCategories.includes(transaction.type)),
    [selectedCategories, transactions]
  );
  const filteredConnections = useMemo(
    () => connections.filter((connection) => selectedCategories.includes(connection.type)),
    [connections, selectedCategories]
  );

  const keySignals = useMemo(() => {
    const totals = new Map<string, number>();
    filteredTransactions.forEach((transaction) => {
      totals.set(transaction.type, (totals.get(transaction.type) ?? 0) + 1);
    });
    return Array.from(totals.entries()).map(([label, count]) => ({ label, count }));
  }, [filteredTransactions]);

  const topTransactions: Transaction[] = [...filteredTransactions]
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, 5);

  return (
    <div className="app-shell">
      <header className="top-shell">
        <div>
          <p className="eyebrow">Global Transition Simulacrum</p>
          <h1>Geopolitical transition monitor and branching futures console</h1>
          <p className="subtitle">
            Reality mode is grounded in live search. Futures mode snapshots the current world and
            lets the analyst branch a speculative scenario without contaminating Base_State.
          </p>
        </div>
        <div className="status-stack">
          <div className="status-card">
            <span className="status-label">Mode</span>
            <strong>{envelope?.future_mode ? "Futures enabled" : "Reality live"}</strong>
          </div>
          <div className="status-card">
            <span className="status-label">Branch</span>
            <strong>{envelope?.active_state.branch_name ?? "Loading..."}</strong>
          </div>
          <div className="status-card">
            <span className="status-label">Updated</span>
            <strong>{envelope?.active_state.updated_at?.slice(11, 19) ?? "--:--:--"} UTC</strong>
          </div>
        </div>
      </header>

      <main className="workspace">
        <section className="map-column">
          <ControlDock
            selectedCategories={selectedCategories}
            futureMode={Boolean(envelope?.future_mode)}
            loading={loading}
            onToggleCategory={toggleCategory}
            onToggleFutureMode={(enabled) => void toggleFutureMode(enabled)}
            onRefresh={() => void refresh()}
          />

          <div className="map-wrapper">
            <AtlasDualGlobes
              transactions={filteredTransactions}
              connections={filteredConnections}
              selectedTransaction={selectedTransaction}
              futureMode={Boolean(envelope?.future_mode)}
              onSelectTransaction={setSelectedTransaction}
            />
          </div>

          <div className="analytics-grid">
            <div className="panel-card">
              <h3>High-signal transitions</h3>
              {topTransactions.length === 0 ? (
                <p className="muted-line">No plotted transactions yet.</p>
              ) : (
                topTransactions.map((transaction) => (
                  <button
                    key={transaction.id}
                    className={`transaction-row ${
                      selectedTransaction?.id === transaction.id ? "selected" : ""
                    }`}
                    type="button"
                    onClick={() => setSelectedTransaction(transaction)}
                  >
                    <span>{transaction.type}</span>
                    <strong>{transaction.region}</strong>
                    <small>{transaction.intensity}/10</small>
                  </button>
                ))
              )}
            </div>

            <div className="panel-card">
              <h3>Category pulse</h3>
              {keySignals.length === 0 ? (
                <p className="muted-line">Waiting for live state.</p>
              ) : (
                keySignals.map((signal) => (
                  <div key={signal.label} className="signal-line">
                    <span>{signal.label}</span>
                    <strong>{signal.count}</strong>
                  </div>
                ))
              )}
            </div>

            <div className="panel-card">
              <h3>Selected transaction</h3>
              {selectedTransaction ? (
                <>
                  <span className="panel-badge">{selectedTransaction.type}</span>
                  <p>{selectedTransaction.desc}</p>
                  <a href={selectedTransaction.source_url} target="_blank" rel="noreferrer">
                    {selectedTransaction.source_title}
                  </a>
                </>
              ) : (
                <p className="muted-line">
                  Click any marker or transaction row to inspect the event and source.
                </p>
              )}
            </div>

            <div className="panel-card">
              <h3>Saved branches</h3>
              {branchHistory.length === 0 ? (
                <p className="muted-line">No local branch snapshots yet.</p>
              ) : (
                branchHistory.slice(0, 4).map((entry) => (
                  <div key={entry.id} className="signal-line">
                    <span>{entry.state.branch_name}</span>
                    <strong>{entry.state.transactions.length} events</strong>
                  </div>
                ))
              )}
            </div>
          </div>

          {error && <div className="error-banner">{error}</div>}
        </section>

        <ChatSidebar
          messages={chat}
          persona={
            envelope?.analyst_persona ??
            "Elite geopolitical analyst. Reality mode is grounded. Futures mode is speculative and explicit about uncertainty."
          }
          futureMode={Boolean(envelope?.future_mode)}
          loading={loading}
          onSend={sendChat}
        />
      </main>
    </div>
  );
}
