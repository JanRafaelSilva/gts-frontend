export type Category = "Economy" | "Politics" | "Military" | "Technology" | "Climate";
export type SimulationMode = "reality" | "future";

export interface Transaction {
  id: string;
  type: Category;
  loc: [number, number];
  desc: string;
  intensity: number;
  source_title: string;
  source_url: string;
  created_at: string;
  region: string;
  tags: string[];
  branch: string;
}

export interface ConnectionLine {
  id: string;
  type: Category;
  from_loc: [number, number];
  to_loc: [number, number];
  desc: string;
  intensity: number;
  source_title: string;
  source_url: string;
  created_at: string;
  branch: string;
  tags: string[];
}

export interface WorldState {
  branch_name: string;
  mode: SimulationMode;
  updated_at: string;
  transactions: Transaction[];
  connections: ConnectionLine[];
  notes: string[];
}

export interface StateEnvelope {
  future_mode: boolean;
  analyst_persona: string;
  base_state: WorldState;
  future_state: WorldState | null;
  active_state: WorldState;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode: SimulationMode;
  created_at: string;
}

export interface ChatResponse {
  assistant_message: ChatMessage;
  envelope: StateEnvelope;
}
