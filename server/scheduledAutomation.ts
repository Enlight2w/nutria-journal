import type { Request, Response } from "express";
import { getAutomationScheduleByTaskUid, recordAutomationScheduleRun } from "./db";
import { sdk } from "./_core/sdk";

/**
 * Heartbeat callback. The schedule task UID is taken only from the authenticated cron identity,
 * never from request payload, which keeps user-owned schedules isolated and retry-safe.
 */
export async function handleScheduledAutomation(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });

    const schedule = await getAutomationScheduleByTaskUid(user.taskUid);
    if (!schedule) return res.json({ ok: true, skipped: "orphan" });
    if (!schedule.enabled) return res.json({ ok: true, skipped: "paused" });

    await recordAutomationScheduleRun(user.taskUid);
    return res.json({ ok: true, scheduleId: schedule.id, action: "wellness-check-in-recorded" });
  } catch (error) {
    const details = error instanceof Error ? { error: error.message, stack: error.stack } : { error: String(error) };
    console.error("[Automation schedule] callback failed", details);
    return res.status(500).json({ ...details, timestamp: new Date().toISOString(), context: { url: req.originalUrl } });
  }
}
