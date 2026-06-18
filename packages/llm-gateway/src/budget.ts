/**
 * Token budget per student per day (PRD §9.4, Q19). Keeps MVP < $500/month.
 * The store is injected so this stays pure/testable; M1 wires a Supabase-backed store.
 */

export interface BudgetStore {
  /** Tokens already spent by this student today (input+output). */
  getSpent(studentId: string, dayKey: string): Promise<number>;
  addSpent(studentId: string, dayKey: string, tokens: number): Promise<void>;
}

export class BudgetExceededError extends Error {
  constructor(
    public studentId: string,
    public limit: number,
    public spent: number,
  ) {
    super(`Token budget exceeded for ${studentId}: ${spent}/${limit}`);
    this.name = "BudgetExceededError";
  }
}

export interface BudgetConfig {
  /** Max tokens/student/day. */
  dailyTokenLimit: number;
  /** Returns the YYYY-MM-DD day key; injected to avoid Date in pure code paths. */
  dayKey: () => string;
}

export class TokenBudget {
  constructor(
    private store: BudgetStore,
    private config: BudgetConfig,
  ) {}

  /** Throws BudgetExceededError if the student is already at/over the daily limit. */
  async assertWithinBudget(studentId: string): Promise<void> {
    if (!studentId) return; // anonymous/diagnostic calls are not metered here
    const spent = await this.store.getSpent(studentId, this.config.dayKey());
    if (spent >= this.config.dailyTokenLimit) {
      throw new BudgetExceededError(studentId, this.config.dailyTokenLimit, spent);
    }
  }

  async record(studentId: string, tokens: number): Promise<void> {
    if (!studentId || tokens <= 0) return;
    await this.store.addSpent(studentId, this.config.dayKey(), tokens);
  }
}
