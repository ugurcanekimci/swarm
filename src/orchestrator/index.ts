/**
 * Swarm orchestrator — routes tasks to agents, manages inter-agent communication
 * via Obsidian vault, and tracks token spend.
 */

import { routeTask, routeCompoundTask } from "./router.js";
import { selectModel, estimateComplexity, escalateModel, type AgentType, type ModelConfig } from "./model-router.js";

export interface TaskResult {
  taskId: string;
  agent: AgentType;
  model: ModelConfig;
  status: "success" | "error" | "escalated";
  output: string;
  tokensUsed: number;
  estimatedCost: number;
  duration: number;
}

interface CostTracker {
  totalTokens: number;
  totalCost: number;
  byAgent: Record<AgentType, { tokens: number; cost: number }>;
  byTier: Record<1 | 2 | 3, { tokens: number; cost: number }>;
}

const costTracker: CostTracker = {
  totalTokens: 0,
  totalCost: 0,
  byAgent: {
    ingest: { tokens: 0, cost: 0 },
    research: { tokens: 0, cost: 0 },
    coder: { tokens: 0, cost: 0 },
    review: { tokens: 0, cost: 0 },
    ops: { tokens: 0, cost: 0 },
  },
  byTier: {
    1: { tokens: 0, cost: 0 },
    2: { tokens: 0, cost: 0 },
    3: { tokens: 0, cost: 0 },
  },
};

/**
 * Plan the execution of a task.
 * Returns the routing decision without executing.
 */
export function planTask(task: string) {
  const routes = routeCompoundTask(task);
  return routes.map((route) => {
    const complexity = estimateComplexity(task);
    const model = selectModel(route.agent, complexity);
    return {
      agent: route.agent,
      confidence: route.confidence,
      reason: route.reason,
      complexity,
      model: {
        provider: model.provider,
        model: model.model,
        tier: model.tier,
        estimatedCost: model.estimatedCostPer1kTokens,
      },
    };
  });
}

/**
 * Track cost after task completion.
 */
export function trackCost(agent: AgentType, model: ModelConfig, tokensUsed: number): void {
  const cost = (tokensUsed / 1000) * model.estimatedCostPer1kTokens;

  costTracker.totalTokens += tokensUsed;
  costTracker.totalCost += cost;
  costTracker.byAgent[agent].tokens += tokensUsed;
  costTracker.byAgent[agent].cost += cost;
  costTracker.byTier[model.tier].tokens += tokensUsed;
  costTracker.byTier[model.tier].cost += cost;
}

/**
 * Get current cost report.
 */
export function getCostReport(): CostTracker & { summary: string } {
  const lines = [
    `Total: ${costTracker.totalTokens} tokens, $${costTracker.totalCost.toFixed(4)}`,
    "",
    "By Agent:",
    ...Object.entries(costTracker.byAgent).map(
      ([agent, { tokens, cost }]) => `  ${agent}: ${tokens} tokens, $${cost.toFixed(4)}`,
    ),
    "",
    "By Tier:",
    `  Tier 1 (local): ${costTracker.byTier[1].tokens} tokens, $${costTracker.byTier[1].cost.toFixed(4)}`,
    `  Tier 2 (cloud): ${costTracker.byTier[2].tokens} tokens, $${costTracker.byTier[2].cost.toFixed(4)}`,
    `  Tier 3 (frontier): ${costTracker.byTier[3].tokens} tokens, $${costTracker.byTier[3].cost.toFixed(4)}`,
  ];

  return {
    ...costTracker,
    summary: lines.join("\n"),
  };
}

/**
 * Reset cost tracker.
 */
export function resetCostTracker(): void {
  costTracker.totalTokens = 0;
  costTracker.totalCost = 0;
  for (const agent of Object.values(costTracker.byAgent)) {
    agent.tokens = 0;
    agent.cost = 0;
  }
  for (const tier of Object.values(costTracker.byTier)) {
    tier.tokens = 0;
    tier.cost = 0;
  }
}
