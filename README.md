# EDOS CRM

Multi-tenant complaint management / case workflow SaaS. See
[ARCHITECTURE.md](./ARCHITECTURE.md) for the full system design and build
sequence. Through Phase 9 (of the sequence in ARCHITECTURE.md §14): tenants,
auth, RBAC, complaints with an event log, a data-driven workflow engine with
a chevron stage stepper (ported from EDOSPMIS), tasks on a generic Kanban
board, an SLA engine, Investigation/RCA/CAPA, a "what needs attention"
dashboard, edos.ai (one action: summarize a case), a public intake API,
multi-channel intake tagging, a Reports page with brief-aligned KPIs, an
in-app notification centre, product/batch tracking with pattern-based
escalation, closure control, customer communication and compensation
logging, CSV import/export, and role differentiation (Marketing Operations/
Quality/Manufacturing/Sales/Finance/Leadership/Report Only). No platform
admin console, workflow builder UI, or a member-management screen to assign
people to the new roles yet — see ARCHITECTURE.md §14's "everything else"
bucket and the CRM brief audit for what's still open.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the keys — see comments in that file
npm run dev
```

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
      §"Escalation procedures"), an in-app notification centre (no email
      provider configured, so this is the honest working half of §6
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
- [ ] Platform admin console, workflow builder UI, member-management UI,
      and the rest of ARCHITECTURE.md §14's "everything else"
