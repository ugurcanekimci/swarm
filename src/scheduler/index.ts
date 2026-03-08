/**
 * Direct scheduler — runs ingestion jobs via node-cron.
 * No LLM, no container — calls ingest functions directly.
 */

import * as cron from "node-cron";
import { loadSources, type SourceConfig } from "../ingest/sources.js";
import { ingestUserTimeline, ingestSearchTweets } from "../ingest/x-twitter.js";
import { appendHistory, readHistory, type HistoryEntry } from "./history.js";

interface ScheduledJob {
  name: string;
  schedule: string;
  type: string;
  source: string;
  task: cron.ScheduledTask | null;
  lastRun: string | null;
  lastResult: { items: number; errors: string[] } | null;
}

const jobs: Map<string, ScheduledJob> = new Map();

function registerJob(
  name: string,
  schedule: string,
  type: string,
  source: string,
  runner: () => Promise<{ items: number; errors: string[] }>,
): void {
  // Validate cron expression
  if (!cron.validate(schedule)) {
    console.error(`[scheduler] Invalid cron "${schedule}" for job "${name}" — skipping`);
    return;
  }

  const task = cron.schedule(schedule, async () => {
    const start = Date.now();
    console.log(`[scheduler] Running: ${name}`);

    try {
      const result = await runner();
      const entry: HistoryEntry = {
        timestamp: new Date().toISOString(),
        jobName: name,
        source,
        type,
        itemsIngested: result.items,
        errors: result.errors,
        durationMs: Date.now() - start,
      };
      appendHistory(entry);

      const job = jobs.get(name);
      if (job) {
        job.lastRun = entry.timestamp;
        job.lastResult = result;
      }

      console.log(`[scheduler] Done: ${name} — ${result.items} items, ${result.errors.length} errors (${entry.durationMs}ms)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[scheduler] Error in ${name}: ${msg}`);
      appendHistory({
        timestamp: new Date().toISOString(),
        jobName: name,
        source,
        type,
        itemsIngested: 0,
        errors: [msg],
        durationMs: Date.now() - start,
      });
    }
  });

  jobs.set(name, { name, schedule, type, source, task, lastRun: null, lastResult: null });
}

function registerSourceJobs(sources: SourceConfig): void {
  for (const yt of sources.youtube) {
    registerJob(
      `youtube:${yt.channelId}`,
      yt.schedule,
      "youtube",
      yt.name,
      async () => {
        // TODO: YouTube channel polling requires listing recent videos first
        // For now, this is a placeholder — individual video URLs are ingested on demand
        return { items: 0, errors: ["YouTube channel polling not yet implemented"] };
      },
    );
  }

  for (const x of sources.xAccounts) {
    registerJob(
      `x-timeline:${x.handle}`,
      x.schedule,
      "x-timeline",
      `@${x.handle}`,
      async () => {
        const tweets = await ingestUserTimeline(x.handle, 10);
        return { items: tweets.length, errors: [] };
      },
    );
  }

  for (const x of sources.xSearchTerms) {
    registerJob(
      `x-search:${x.query}`,
      x.schedule,
      "x-search",
      `search:"${x.query}"`,
      async () => {
        const tweets = await ingestSearchTweets(x.query, 10);
        return { items: tweets.length, errors: [] };
      },
    );
  }

  for (const rss of sources.rssFeeds) {
    registerJob(
      `rss:${rss.name}`,
      rss.schedule,
      "rss",
      rss.url,
      async () => {
        // TODO: RSS feed polling not yet implemented
        return { items: 0, errors: ["RSS ingestion not yet implemented"] };
      },
    );
  }

  for (const gh of sources.githubRepos) {
    registerJob(
      `github:${gh.owner}/${gh.repo}`,
      gh.schedule,
      "github",
      `${gh.owner}/${gh.repo}`,
      async () => {
        // TODO: GitHub issue/PR polling not yet implemented
        return { items: 0, errors: ["GitHub ingestion not yet implemented"] };
      },
    );
  }

  for (const sub of sources.substackNewsletters) {
    registerJob(
      `substack:${sub.publication}`,
      sub.schedule,
      "substack",
      sub.publication,
      async () => {
        // TODO: Substack polling not yet implemented
        return { items: 0, errors: ["Substack ingestion not yet implemented"] };
      },
    );
  }
}

export function startScheduler(): void {
  const sources = loadSources();
  const totalSources =
    sources.youtube.length +
    sources.xAccounts.length +
    sources.xSearchTerms.length +
    sources.rssFeeds.length +
    sources.githubRepos.length +
    sources.substackNewsletters.length;

  if (totalSources === 0) {
    console.log("[scheduler] No sources configured — scheduler idle. Edit data/sources.json to add sources.");
    return;
  }

  registerSourceJobs(sources);
  console.log(`[scheduler] Started with ${jobs.size} jobs from ${totalSources} sources`);
}

export function stopScheduler(): void {
  for (const job of jobs.values()) {
    job.task?.stop();
  }
  jobs.clear();
  console.log("[scheduler] Stopped all jobs");
}

export function getStatus(): Array<{
  name: string;
  schedule: string;
  type: string;
  source: string;
  lastRun: string | null;
  lastResult: { items: number; errors: string[] } | null;
}> {
  return Array.from(jobs.values()).map(({ task: _, ...rest }) => rest);
}

export async function triggerNow(jobName: string): Promise<{ items: number; errors: string[] } | null> {
  const job = jobs.get(jobName);
  if (!job?.task) return null;

  // Manually trigger the job
  (job.task as unknown as { now: () => void }).now();

  // Return the last result (may not be updated yet for async tasks)
  return job.lastResult;
}

export { readHistory };
