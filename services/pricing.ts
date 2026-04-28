
export interface UsageRecord {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  timestamp: number;
  type: 'text' | 'image' | 'audio' | 'search';
}

export interface CostSummary {
  totalCost: number;
  sessionCost: number;
  totalTokens: number;
}

// Pricing Rates (Estimated based on public Pay-as-you-go rates)
// Rates are per 1 Million Tokens unless specified
const RATES: Record<string, { input: number; output: number; type: 'token' | 'image' | 'char' }> = {
  // Flash (approx $0.075 / $0.30)
  'gemini-3-flash-preview': { input: 0.075, output: 0.30, type: 'token' },
  // Pro (approx $3.50 / $10.50)
  'gemini-3-pro-preview': { input: 3.50, output: 10.50, type: 'token' },
  // Image (approx $0.04 per image)
  'gemini-3-pro-image-preview': { input: 0.04, output: 0, type: 'image' },
  // TTS (approx $15 per 1M characters -> $0.015 per 1k)
  'gemini-2.5-flash-preview-tts': { input: 15.00, output: 0, type: 'char' }
};

const STORAGE_KEY = 'lore_cost_history';

export const PricingService = {
  sessionCost: 0,
  listeners: new Set<(summary: CostSummary) => void>(),

  getHistory(): { totalCost: number; totalTokens: number } {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : { totalCost: 0, totalTokens: 0 };
    } catch {
      return { totalCost: 0, totalTokens: 0 };
    }
  },

  updateStorage(cost: number, tokens: number) {
    const history = this.getHistory();
    history.totalCost += cost;
    history.totalTokens += tokens;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    return history;
  },

  trackUsage(model: string, inputCount: number, outputCount: number) {
    let cost = 0;
    const rate = RATES[model];

    if (rate) {
      if (rate.type === 'token') {
        cost = (inputCount / 1_000_000 * rate.input) + (outputCount / 1_000_000 * rate.output);
      } else if (rate.type === 'image') {
        // Input count here treats 1 as 1 image
        cost = inputCount * rate.input;
      } else if (rate.type === 'char') {
        // Input count is characters
        cost = (inputCount / 1_000_000 * rate.input);
      }
    }

    this.sessionCost += cost;
    const history = this.updateStorage(cost, inputCount + outputCount);
    
    this.notify({
      sessionCost: this.sessionCost,
      totalCost: history.totalCost,
      totalTokens: history.totalTokens
    });

    console.log(`[Cost] Model: ${model} | In: ${inputCount} | Out: ${outputCount} | Cost: $${cost.toFixed(5)}`);
  },

  subscribe(callback: (summary: CostSummary) => void) {
    this.listeners.add(callback);
    const history = this.getHistory();
    callback({
      sessionCost: this.sessionCost,
      totalCost: history.totalCost,
      totalTokens: history.totalTokens
    });
    return () => this.listeners.delete(callback);
  },

  notify(summary: CostSummary) {
    this.listeners.forEach(cb => cb(summary));
  }
};
