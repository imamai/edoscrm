import { NextResponse, type NextRequest } from "next/server";
import { runScheduledPass } from "@/lib/jobs/runner";
import { runScheduledReports, type ReportKind } from "@/lib/jobs/reports";

/**
 * The scheduled pass. Vercel Cron calls this hourly (see vercel.json).
 *
 * Authorised by a shared secret rather than a session, because there is no
 * user on a cron request. Vercel sends `Authorization: Bearer $CRON_SECRET`
 * on its own invocations; the same header works for a manual run, which is how
 * this gets tested.
 *
 * Without CRON_SECRET set the route refuses to run rather than defaulting to
 * open: an unauthenticated endpoint that emails an entire workspace and purges
 * personal data is not something to leave ajar.
 */
export const maxDuration = 60;

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json(
      { error: process.env.CRON_SECRET ? "Unauthorised." : "CRON_SECRET is not configured." },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const job = url.searchParams.get("job");

  // Report runs are separate jobs on their own schedules, but share this one
  // authenticated entry point so there is a single secret to manage.
  if (job === "weekly" || job === "monthly") {
    const summary = await runScheduledReports(job as ReportKind);
    return NextResponse.json({ job, ...summary });
  }

  const summary = await runScheduledPass();
  return NextResponse.json({ job: "sla", ...summary });
}
