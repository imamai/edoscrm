# EDOS CRM

Multi-tenant complaint management / case workflow SaaS. See
[ARCHITECTURE.md](./ARCHITECTURE.md) for the full system design and build
sequence. Through Phase 9 (of the sequence in ARCHITECTURE.md §14): tenants,
auth, RBAC, complaints with an event log, a data-driven workflow engine with
a chevron stage stepper (ported from EDOSPMIS), tasks on a generic Kanban
board, an SLA engine, Investigation/RCA/CAPA, dashboards and analytics,
edos.ai (case summaries, drafted communications, and a tool-grounded Q&A
assistant), a public intake API, eight intake channels, downloadable report
registers, an in-app notification centre, product/batch tracking with
pattern-based escalation, closure control, customer communication and
compensation logging, CSV import/export, and the seven roles the complaint
brief defines — with a screen to actually assign them.

As of the 26 September 2026 requirements pass, every requirement in
`crm-word/Complaint Management System.docx` is met. The three that had held
most of the rest back are now done: **scheduled work** (SLA reminders,
automatic escalation of overdue cases, weekly and monthly reports — nothing
depends on somebody opening a page any more), **the complainant as a record**
who is acknowledged on logging and told the outcome at closure, and **member
management**, so the role model is usable rather than merely enforced. The
app also works on a phone. See `crm-word/EDOS-CRM-Brief-Audit.pdf` for the
line-by-line position and `crm-word/EDOS-CRM-Improvement-Audit.pdf` for what
is worth doing beyond the brief.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the keys — see comments in that file
npm run dev
```

Checks, all of which CI runs on every push:

```bash
npm run typecheck   # tsc --noEmit
npm run lint
npm test            # vitest — the SLA and escalation rules
```

### Environment

| Variable | Needed for |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Everything |
| `SUPABASE_SERVICE_ROLE_KEY` | Public intake, inbound email, invitations, scheduled jobs |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Notifications, complainant acknowledgements, scheduled reports |
| `ANTHROPIC_API_KEY` | edos.ai — summaries, drafts, the assistant. Without it those show a "not configured" notice and nothing else breaks |
| `ANTHROPIC_MODEL` | Optional; defaults to `claude-haiku-4-5-20251001` |
| `CRON_SECRET` | **Required** for `/api/cron`. Without it the endpoint refuses to run rather than defaulting to open — it emails whole workspaces and purges personal data |
| `INBOUND_EMAIL_SECRET` | Optional; authorises the email-to-case webhook at `/api/v1/inbound-email` |

### Scheduled jobs

`vercel.json` registers three crons, all hitting `/api/cron` with
`Authorization: Bearer $CRON_SECRET`:

| Schedule | Job | What it does |
| --- | --- | --- |
| Daily 06:00 UTC | *(default)* | SLA approach and breach notices; escalates an overdue case to the next accountable owner; re-checks batch thresholds as the window moves; purges complainant contact details past the retention period |
| Mondays 06:00 UTC | `?job=weekly` | Last week's report to leadership |
| 1st of month 07:00 UTC | `?job=monthly` | Previous month's management report |

**The SLA pass wants to run hourly, and currently cannot.** Vercel's Hobby
plan allows only daily cron schedules and rejects the deployment outright if
any schedule is more frequent, so the pass is set to once a day. That is
enough for the T2 and T3 deadlines, which are measured in days — but it makes
the T1 acknowledgement SLA (one hour) effectively unenforced, since a breach
would not be noticed until the next morning.

Two ways to get hourly back, whenever it matters enough:

- **Upgrade to Vercel Pro** and change the first schedule back to `0 * * * *`.
  Nothing else needs to change.
- **Call the endpoint from somewhere else on an hourly schedule** — GitHub
  Actions (`schedule: - cron: "0 * * * *"`), or any uptime pinger — with the
  `Authorization: Bearer $CRON_SECRET` header. The job is idempotent: it
  de-duplicates against notifications already sent in the last 20 hours, so
  running it more often than needed is harmless.

Run one by hand with
`curl -H "Authorization: Bearer $CRON_SECRET" localhost:3005/api/cron`.

The database lives in the shared `edos-pos` Supabase project
(`cnlyuwslpcgosgwdmzav`) — see ARCHITECTURE.md §2 for what that sharing does
and doesn't mean. Migrations are in `supabase/migrations/`, applied directly
against that project (no local Supabase stack).

**Demo account**, seeded with realistic data across every feature above —
log in and explore rather than starting from an empty workspace:

- URL: `/login`
- Email: `demo@edoscrm.co.ke`
- Password: `EdosDemo2026!`
- Workspace: Amani Foods Ltd

## Status

- [x] Phase 1 — architecture
- [x] Phase 2 — foundation: `edoscrm_tenants`/`edoscrm_users`/RBAC/RLS, sign
      up, sign in, workspace creation, empty dashboard shell
- [x] Phase 3 — cases + event log: `edoscrm_complaints`/`edoscrm_complaint_events`,
      case numbering, list + detail pages
- [x] Phase 4 — workflow engine + chevron stepper: `edoscrm_workflows`/
      `edoscrm_workflow_versions` (JSON stage definitions, one default per
      tenant), stage-advance action, chevron stepper ported from EDOSPMIS
      (verified: no such component exists in edos-poa or edospoa-posv1 —
      those only use ChevronRight/Left as plain icons)
- [x] Phase 5 — tasks + generic board: `edoscrm_tasks` (fixed todo/
      in_progress/done status, optional `complaint_id` link), the reusable
      `components/board/board.tsx` Kanban component, task cards on the
      complaint detail page
- [x] Phase 6 — SLA engine: `edoscrm_sla_rules` (per-severity
      acknowledgement/RCA deadlines, seeded at provisioning), status
      computed at render time (`lib/domain/sla.ts`) — never stored — shown
      on the complaint list and detail header
- [x] Phase 7 — Investigation/RCA/CAPA: `edoscrm_investigations`/
      `edoscrm_root_causes`/`edoscrm_capas`, one record of each per
      complaint, gated behind a single `investigations.manage` permission
- [x] Phase 8 — dashboard: one "what needs attention" view (open/T1/SLA
      overdue/tasks-overdue counts, an attention list, recent activity) —
      not per-role variants yet, since the only two roles that exist
      (Tenant Administrator, Member) aren't differentiated enough to design
      real variants against
- [x] Phase 9 — edos.ai + public intake:
      - `edos.ai`'s first action, "Summarize case" (`edoscrm_ai_interactions`,
        a shared system prompt in `lib/ai/client.ts` grounding every future
        action in the same domain vocabulary and human-in-the-loop rules).
        **Needs `ANTHROPIC_API_KEY` set to actually run** — verified the
        graceful "not configured yet" path live, but the real model call is
        unverified pending that key.
      - `/api/v1/intake` — public, unauthenticated complaint submission via
        the service-role client, forced to T3 severity, rate-limited by
        (tenant, IP). Verified live end-to-end: real submission, unknown
        workspace, missing fields, a field-injection attempt (severity/
        created_by silently ignored), rate limiting tripping at the 6th
        request from one IP and not affecting a different IP, and the
        resulting complaint rendering correctly in the internal UI with a
        "(via web)" timeline marker and reporter contact info.
- [x] Brief gap-closure pass: audited against `crm-word/Complaint Management
      System.docx` and closed most of what was missing — product/SKU/batch/
      expiry fields, batch-pattern escalation (48h/72h/7-day thresholds,
      §"Escalation procedures"), a notification centre (in-app + real email
      via Resend, `lib/notify/email.ts` — verified live against Resend's own
      sandbox address after RESEND_API_KEY was configured, satisfying §6
      "Notifications"), assignment, severity override with a recorded
      reason, a "pending information" flag, closure control (requires a
      verified CAPA + written confirmation before a case can close),
      customer communication log, compensation (hamper/credit note)
      tracking, attachments (Supabase Storage), search/filter, CSV
      import/export, KPI computation (§7 — capture rate flagged as not
      measurable from inside this system alone), and named roles matching
      the brief's §4 table. Verified live: created a T1 complaint, a second
      complaint on the same batch (correctly fired the 48h-window
      escalation and cross-linked both cases), searched/filtered/exported
      the list, and confirmed every new nav destination renders with real
      data. Not done: platform admin console, workflow builder UI, and a
      member-management screen to actually assign people to the new roles
      (they exist in the data model; nothing yet assigns non-admin members
      to them).
- [x] Requirements pass (26 Sep 2026) — closed every remaining gap from the
      brief audit. Migrations `0015`–`0017`:
      - **Scheduled work** (`lib/jobs/`, `/api/cron`, `vercel.json`): SLA
        reminders and breach escalation to the next accountable owner, batch
        thresholds re-evaluated over time rather than only at logging,
        retention purging, and weekly/monthly report distribution recorded in
        `edoscrm_report_runs` so a re-run is a no-op rather than a second email
      - **Contacts** (`edoscrm_contacts`): the complainant as a record, matched
        on normalised email/phone, with history on the case and a full record
        page. Acknowledged automatically on logging; told the outcome at
        closure, which is now required before a case with an address can close
      - **Members & roles**: invite by email (no Bio account needed), assign
        the seven roles, suspend — with a guard against the last administrator
        locking the workspace out
      - **Rules & categories**: SLA deadlines (including T2's separate
        resolution-plan deadline), escalation thresholds, KPI targets,
        categories and retention, all per workspace instead of compiled in
      - **Product actions**: hold / release / withdrawal / recall, raised by
        Quality and decided by Manufacturing, with the complaints as evidence
      - **RCA summaries**: write → approve → share, every send logged
      - **Email-to-case** (`/api/v1/inbound-email` + `/inbox`): controlled, so
        auto-replies never become cases
      - **Complaint correction** with before/after and a reason in the audit
        log, which is now written to, readable and exportable
      - **Mobile navigation**, error/loading/not-found boundaries, and the
        shared Badge/Card/DataTable/EmptyState/Modal primitives
      - KPIs read stored timestamps, so they can be reported for a past period;
        shown on the Dashboard against each workspace's targets, and broken
        down on Analytics by category, channel, severity, product and owner
      - Two intake channels the brief names and the system lacked: `social`
        and `sales_rep`
      - `vitest` + GitHub Actions running typecheck, lint and tests
- [ ] Beyond the brief: platform admin console, workflow builder UI, plan
      entitlements and billing, observability and error tracking. These are
      set out with reasoning in `crm-word/EDOS-CRM-Improvement-Audit.pdf`
