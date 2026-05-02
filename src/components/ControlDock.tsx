import type { Category } from "../types";

const CATEGORIES: Category[] = ["Economy", "Politics", "Military", "Technology", "Climate"];

interface ControlDockProps {
  selectedCategories: Category[];
  futureMode: boolean;
  loading: boolean;
  onToggleCategory: (category: Category) => void;
  onToggleFutureMode: (enabled: boolean) => void;
  onRefresh: () => void;
}

export function ControlDock({
  selectedCategories,
  futureMode,
  loading,
  onToggleCategory,
  onToggleFutureMode,
  onRefresh
}: ControlDockProps) {
  return (
    <div className="control-dock">
      <div className="control-block">
        <span className="control-label">Categorias</span>
        <div className="chip-row">
          {CATEGORIES.map((category) => {
            const active = selectedCategories.includes(category);
            return (
              <button
                key={category}
                className={`chip-button ${active ? "active" : ""}`}
                onClick={() => onToggleCategory(category)}
                type="button"
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>

      <div className="control-block control-block--compact">
        <span className="control-label">Modo Futuros Possíveis</span>
        <button
          className={`future-toggle ${futureMode ? "enabled" : ""}`}
          type="button"
          onClick={() => onToggleFutureMode(!futureMode)}
        >
          {futureMode ? "ON" : "OFF"}
        </button>
      </div>

      <div className="control-block control-block--compact">
        <span className="control-label">Live-RAG</span>
        <button className="refresh-button" type="button" onClick={onRefresh} disabled={futureMode || loading}>
          {futureMode ? "Pausado em simulação" : loading ? "Atualizando..." : "Atualizar Realidade"}
        </button>
      </div>
    </div>
  );
}
