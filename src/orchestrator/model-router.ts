/**
 * Model routing: select the cheapest model that can handle the task.
 * Tier 1 (free): Ollama local
 * Tier 2 (cheap): Ollama cloud
 * Tier 3 (frontier): Claude API
 */

import { config } from "../config.js";

export type AgentType = "ingest" | "research" | "coder" | "review" | "ops";
export type Complexity = "low" | "medium" | "high";

export interface ModelConfig {
  provider: "ollama" | "anthropic" | "openrouter";
  model: string;
  baseUrl: string;
  tier: 1 | 2 | 3;
  estimatedCostPer1kTokens: number; // USD
}

const ROUTING_TABLE: Record<AgentType, Record<Complexity, ModelConfig>> = {
  ingest: {
    low: {
      provider: "ollama",
      model: "qwen3:8b",
      baseUrl: config.ollamaUrl,
      tier: 1,
      estimatedCostPer1kTokens: 0,
    },
    medium: {
      provider: "ollama",
      model: "glm-4.7",
      baseUrl: config.ollamaUrl,
      tier: 1,
      estimatedCostPer1kTokens: 0,
    },
    high: {
      provider: "ollama",
      model: "glm-4.7",
      baseUrl: config.ollamaUrl,
      tier: 1,
      estimatedCostPer1kTokens: 0,
    },
  },
  research: {
    low: {
      provider: "ollama",
      model: "glm-4.7",
      baseUrl: config.ollamaUrl,
      tier: 1,
      estimatedCostPer1kTokens: 0,
    },
    medium: {
      provider: "ollama",
      model: "glm-4.7",
      baseUrl: config.ollamaUrl,
      tier: 1,
      estimatedCostPer1kTokens: 0,
    },
    high: {
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      baseUrl: "https://api.anthropic.com",
      tier: 3,
      estimatedCostPer1kTokens: 0.003,
    },
  },
  coder: {
    low: {
      provider: "ollama",
      model: "qwen3-coder:30b",
      baseUrl: config.ollamaUrl,
      tier: 1,
      estimatedCostPer1kTokens: 0,
    },
    medium: {
      provider: "ollama",
      model: "minimax-m2.5:cloud",
      baseUrl: config.ollamaUrl,
      tier: 2,
      estimatedCostPer1kTokens: 0.0005,
    },
    high: {
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      baseUrl: "https://api.anthropic.com",
      tier: 3,
      estimatedCostPer1kTokens: 0.003,
    },
  },
  review: {
    low: {
      provider: "ollama",
      model: "qwen3-coder:30b",
      baseUrl: config.ollamaUrl,
      tier: 1,
      estimatedCostPer1kTokens: 0,
    },
    medium: {
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      baseUrl: "https://api.anthropic.com",
      tier: 3,
      estimatedCostPer1kTokens: 0.003,
    },
    high: {
      provider: "anthropic",
      model: "claude-opus-4-6",
      baseUrl: "https://api.anthropic.com",
      tier: 3,
      estimatedCostPer1kTokens: 0.015,
    },
  },
  ops: {
    low: {
      provider: "ollama",
      model: "qwen3:8b",
      baseUrl: config.ollamaUrl,
      tier: 1,
      estimatedCostPer1kTokens: 0,
    },
    medium: {
      provider: "ollama",
      model: "qwen3:8b",
      baseUrl: config.ollamaUrl,
      tier: 1,
      estimatedCostPer1kTokens: 0,
    },
    high: {
      provider: "ollama",
      model: "glm-4.7",
      baseUrl: config.ollamaUrl,
      tier: 1,
      estimatedCostPer1kTokens: 0,
    },
  },
};

/**
 * Select model for an agent + complexity level.
 */
export function selectModel(agent: AgentType, complexity: Complexity): ModelConfig {
  return ROUTING_TABLE[agent][complexity];
}

/**
 * Estimate complexity from task description.
 * Simple heuristic — can be replaced with a classifier later.
 */
export function estimateComplexity(task: string): Complexity {
  const lower = task.toLowerCase();

  // High complexity indicators
  const highIndicators = [
    "architect", "security", "review", "redesign", "refactor entire",
    "complex", "multi-step", "cross-cutting", "migrate",
  ];
  if (highIndicators.some((i) => lower.includes(i))) return "high";

  // Medium complexity indicators
  const mediumIndicators = [
    "implement", "add feature", "fix bug", "research", "analyze",
    "compare", "synthesize", "multiple files",
  ];
  if (mediumIndicators.some((i) => lower.includes(i))) return "medium";

  return "low";
}

/**
 * Auto-escalate: if a model fails twice, bump to next tier.
 */
export function escalateModel(current: ModelConfig): ModelConfig | null {
  if (current.tier >= 3) return null; // Already at frontier

  // Simple escalation: local → cloud → frontier
  if (current.provider === "ollama" && !current.model.includes("cloud")) {
    return {
      provider: "ollama",
      model: "minimax-m2.5:cloud",
      baseUrl: config.ollamaUrl,
      tier: 2,
      estimatedCostPer1kTokens: 0.0005,
    };
  }

  return {
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    baseUrl: "https://api.anthropic.com",
    tier: 3,
    estimatedCostPer1kTokens: 0.003,
  };
}
