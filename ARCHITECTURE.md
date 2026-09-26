# EDOS CRM — Architecture

**Status:** approved — Phase 1 complete, no code written yet
**Date:** 26 September 2026

---

## 1. What this is, in one paragraph

EDOS CRM is a multi-tenant complaint management / case workflow SaaS: any
organisation (starting with EDOS's own businesses, sellable to others later)
runs its complaint intake, investigation, RCA/CAPA and closure process through
it. The unit of work is not a database row — it is a **case** that moves
through a configurable workflow, throwing off **events** as it goes, owned by
a **person**, racing an **SLA clock**, and occasionally spawning **tasks**.
Every screen in the product answers "what happened, who owns it, what's next"
before it answers anything else. That's the brief in full; everything below
is how to build it without it turning into either a generic CRUD admin panel
or an unshippable 44-table fantasy on day one.

---

## 2. System context

```
                              ┌───────────────────────────────┐
   EDOS website(s)  ────────▶ │   EDOS CRM (this app)          │
   (public intake form)       │   Next.js 16 App Router        │
                              │                                 │
   Internal users   ────────▶ │   /api/v1/*  (external intake  │──▶ Supabase "edos-pos"
   (agents, quality,          │   + future integrations)       │    (cnlyuwslpcgosgwdmzav —
    managers, admins)         │                                 │     shared with edos-poa,
                              │   Platform admin (EDOS Centre)  │     edospoa-posv1, edoshatch360)
                              └───────────────────────────────┘
```

One decision follows directly from this diagram and needs your sign-off
before Phase 2 (database) starts:

**EDOS CRM lands in the existing `edos-pos` Supabase project**
(`cnlyuwslpcgosgwdmzav`), alongside edos-poa, legacy edospoa-posv1, and
edoshatch360 (31 tables) — per your instruction, not a new project. Worth
being explicit about what that means in practice, since edos-poa's own
architecture doc already flagged the same tradeoffs for itself:

- **`edoscrm_*` naming is what keeps this safe to add**, not optional
  hygiene — the project already holds `edoshatch360_*` and edos-poa's
  unprefixed tables (`clients`, `invoices`, `payments`, ...) side by side.
  A fourth product with its own clean prefix is additive and low-risk; a
  collision on an unprefixed name would not be.
- **Auth settings, SMTP/email templates, and the redirect allow-list are
  project-wide**, so shared with three other live products. EDOS CRM sends
  its own transactional email via Resend with its own key (same call edos-poa
  made) rather than touching Supabase's project-level auth email config.
- **Anon key scope**: edos-poa's own doc flags that today's anon key can read
  every table in the project, including Hatch360's. EDOS CRM's RLS policies
  (§5) close this for its *own* tables from day one — every `edoscrm_*`
  table gets `tenant_id`-scoped policies with no permissive default — but it
  doesn't retroactively fix the other three products' exposure, and this
  project is a genuinely bigger blast radius for a schema mistake than a
  dedicated one would have been.
- **Selling EDOS CRM to an external organisation later** means that
  customer's data sits in a Supabase project whose name, dashboard, and
  billing are "edos-pos" — a POS project, not a CRM one. Fine for now while
  the only tenant is EDOS itself (§13); worth a real look at splitting into
  its own project before the first non-EDOS customer signs up, rather than
  after.

**A public, unauthenticated intake endpoint is a first-class citizen**, not
an afterthought bolted on in Phase 15. It has a materially different threat
model from the authenticated app (§8, §14) — and in a shared project, a
poorly-locked-down intake endpoint is a bigger deal than usual, since it's a
door into the same project as three other products' data.

---

## 3. Stack

Matching EDOSPMIS and edos-poa where there's no reason to diverge — three
sibling apps on the same stack is a real asset (shared muscle memory, shared
patterns to port forward, e.g. the chevron stepper and modal primitives
already built and battle-tested in EDOSPMIS this month).

| Concern | Choice | Reasoning |
|---|---|---|
| Framework | Next.js 16 App Router, React 19, TypeScript strict | Same as edos-poa/EDOSPMIS |
| Rendering | Server Components by default; Client Components only where there's interaction | An event timeline with thousands of rows should not ship as client JSON |
| Mutations | Server Actions | Permission checks and the service-role client never leave the server |
| Styling | Tailwind v4, `@theme` tokens in `globals.css`, no config file | Same design-token discipline as the other two apps |
| Data access | `@supabase/ssr` | Cookie-based sessions in Server Components |
| Icons | `lucide-react` | |
| Charts | `recharts` | Dashboards (§12) need real charts, not canvas hacks |
| Tables | Server-rendered, URL-driven filters | Filters become shareable/bookmarkable links |
| Forms | `react-hook-form` + `zod`, schema shared client/server | One definition of "valid" |
| Modals | Ported from EDOSPMIS's `components/ui/modal.tsx` | Already built, already accessible (focus trap, escape, reduced-motion) — no reason to rebuild |
| PDFs | `html2pdf.js`, dynamically imported | Case dossiers, compensation letters |
| Email | Resend | Acknowledgement emails, escalation notices |
| Dates | `date-fns` | |
| AI | Anthropic API (Claude), server-side only | §11 — never client-side, never given write access |

**Why not a state library, why not a separate backend service.** Same
reasoning as edos-poa: Server Components hold the data, the URL holds the
view, client state covers only in-flight UI (a modal open/closed, a board
card mid-drag). A separate API service would just be Supabase's own
PostgREST/RPC layer reimplemented badly — Postgres functions with `security
definer` (the pattern already proven in EDOSPMIS's `edospmis_has_permission`
/ `edospmis_is_member`) do the job with the tenant-isolation guarantee
enforced at the one layer that can't be bypassed by a bug in application code.

---

## 4. Directory layout

```
src/
  app/
    (auth)/           login, forgot-password, reset-password
    (app)/
      layout.tsx        shell: sidebar (grouped nav, same pattern as EDOSPMIS),
                         topbar, command palette (Cmd+K), quick-add
      dashboard/         role-specific (§9)
      cases/             list / board / calendar / [id] detail
      tasks/             list / board / calendar
      products/  batches/  customers/
      investigations/[id]/  capas/[id]/
      reports/
      settings/          workflow builder, SLA rules, categories, severities,
                          departments, teams, users, roles
    (platform)/         EDOS Centre only — tenants, plans, feature flags,
                         platform audit log
    api/
      v1/
        intake/          public complaint submission (§8, §14)
        webhooks/
  components/
    ui/                 button, field, table, badge, card, modal (ported),
                         stat-card, chevron-stepper (ported + generalised)
    app/                 sidebar-nav, command-palette, quick-add
    cases/               case-summary-header, event-timeline, sla-badge
    board/               generic Kanban (cases AND tasks reuse it — see §10)
  lib/
    supabase/{client,server,admin}.ts
    data/
      tables.ts          every table name, once — mirrors edos-poa's convention
      cases.ts  events.ts  tasks.ts  workflows.ts  sla.ts  ...
    auth/{session,permissions}.ts
    workflow/            engine: given a case + workflow definition, what
                         transitions are legal, what they trigger (§10)
    sla/                 SLA clock computation (§12)
    ai/                  server-only Claude wrapper + suggestion recording (§11)
supabase/migrations/
```

`src/lib/data/*` is the only code that queries a table; `tables.ts` is the
only place a table name is spelled. This is the single convention from
EDOSPMIS/edos-poa most worth carrying over verbatim — it's what makes tenant
isolation reviewable (a dozen files, not hundreds of call sites).

---

## 5. Multi-tenancy and RBAC — reusing a proven pattern, not reinventing one

EDOSPMIS already solved this exact problem this month, including finding and
fixing its sharp edges. Port the pattern, don't redesign it:

- `edoscrm_tenants`, `edoscrm_tenant_users` (membership + role), `tenant_id`
  on every tenant-owned table, enforced by RLS — never by application-layer
  filtering alone.
- `edoscrm_is_member(tenant_id)` / `edoscrm_has_permission(tenant_id, key)` —
  `security definer` Postgres functions, left at the default PUBLIC execute
  grant deliberately (anon calls are harmless since `auth.uid()` is null).
- **Platform admin as its own allow-list table**
  (`edoscrm_platform_admins`), never a boolean column on the self-updatable
  users table. EDOSPMIS specifically avoided a privilege-escalation hole here
  this session (a plain flag column would be writable through the user's own
  self-update RLS policy) — same rule applies here from the start instead of
  being discovered as a fix later.
- RLS policies split by operation (`insert`/`update`/`delete`, not a single
  `for all`) alongside the `select` policy from day one — EDOSPMIS had to
  retrofit this to clear 20 tables' worth of "multiple permissive policies"
  performance warnings; starting this way avoids the retrofit entirely.
- **Migrations are additive-only**, same rule edos-poa's own doc set for
  itself in this exact project: `CREATE TABLE IF NOT EXISTS edoscrm_*`, never
  a `DROP`/`RENAME`/`ALTER ... TYPE` touching anything outside the
  `edoscrm_` prefix. Three other live products (edos-poa, edospoa-posv1,
  edoshatch360) run on this database and must never notice EDOS CRM's
  migrations happened.
- Org structure: Platform → Tenant → Department → Team → User, matching §22
  of the product brief and mirroring the Business Units/Branches/Departments/
  Teams model already shipped in EDOSPMIS's settings pages.

---

## 6. Event model

Every meaningful thing that happens is one row in an append-only table:

```
edoscrm_complaint_events
  id, tenant_id, complaint_id, actor_id, event_type,
  payload jsonb,       -- previous/new values, free-form context
  created_at
```

The activity timeline, the audit trail, and (later) the AI's "summarize this
case" feature all read from the same table — there's exactly one source of
truth for "what happened," not a timeline view reconstructed from diffing
other tables after the fact. Status changes, assignments, comments, evidence
uploads, RCA/CAPA milestones, customer contact — all the same shape:
`entity + event + actor + timestamp + context` (brief §46).

---

## 7. Core data model (Phase 1 shape — full DDL is Phase 2)

Naming: `edoscrm_*`, no exceptions (brief §20 — doubly non-negotiable now
that the tables live beside edoshatch360's and edos-poa's in one project,
§2). The full 40-table brief (§43) is the ceiling, not the Phase-2 starting
floor — see §13 for what actually gets built first.

```
edoscrm_tenants, edoscrm_tenant_settings, edoscrm_platform_admins
edoscrm_users, edoscrm_departments, edoscrm_teams
edoscrm_roles, edoscrm_permissions, edoscrm_role_permissions, edoscrm_user_roles

edoscrm_complaints
edoscrm_complaint_events          -- §6
edoscrm_complaint_assignments
edoscrm_complaint_categories, edoscrm_complaint_severities, edoscrm_complaint_channels
edoscrm_complaint_attachments, edoscrm_complaint_comments, edoscrm_complaint_communications

edoscrm_products, edoscrm_product_batches, edoscrm_complaint_batch_links

edoscrm_investigations, edoscrm_root_causes, edoscrm_capas, edoscrm_corrective_actions

edoscrm_workflows, edoscrm_workflow_stages, edoscrm_workflow_transitions
edoscrm_slas, edoscrm_sla_rules
edoscrm_escalations, edoscrm_escalation_rules

edoscrm_tasks, edoscrm_task_checklists

edoscrm_notifications, edoscrm_notification_preferences
edoscrm_audit_logs
edoscrm_ai_interactions, edoscrm_ai_suggestions
```

---

## 8. Public intake API — the one endpoint with a different threat model

`/api/v1/intake` accepts unauthenticated submissions from EDOS websites. It
must:

- Rate-limit by IP and by tenant (a flood of fake complaints is the obvious
  abuse case for a public form).
- Write only to a narrow insert path — never able to read back investigation
  data, internal comments, RCA, or anything past the case number and public
  status (brief §42's "internal investigation data must never be exposed
  through this public interface" is a hard requirement, not a nice-to-have).
- Validate against the tenant's configured categories/required fields
  server-side (never trust the client to have sent a valid category).
- Still produce an `edoscrm_complaint_events` row ("Complaint received —
  web") so the timeline is complete regardless of entry point.

---

## 9. Dashboards — one screen answering one question each, per role

Per brief §11–§12: not one screen with thirty charts. Each role's dashboard
is a saved, opinionated query over `edoscrm_complaints` +
`edoscrm_complaint_events` + `edoscrm_tasks`, answering "what needs my
attention" first. Built as data (a `role → widget[]` config), not as five
hand-coded dashboard pages, so a sixth role later is a config change.

---

## 10. Workflow engine + generic board

The brief asks for a visual workflow *builder* (§45) — defer the builder UI
(see §13), but design the *engine* now so nothing has to be rearchitected
later: workflows are data (`edoscrm_workflows` → `edoscrm_workflow_stages` →
`edoscrm_workflow_transitions`, JSON condition/action payloads), exactly like
EDOSPMIS's `workflow_versions.definition.stages`. A case's current stage
plus its workflow's transition rules determine which actions are legal —
the UI never hard-codes "if status = X show button Y."

The Kanban board (cases, tasks — brief §8, §15) is one generic
`components/board/` component parameterised by workflow stages, not two
separate hand-built boards. List/Board/Calendar views share one data-fetch
and one filter state so switching views never loses context (brief §8).

---

## 11. AI assistant — human-in-the-loop, server-only, fully audited

Every suggestion (`edoscrm_ai_suggestions`) records the prompt, context,
response, and whether it was accepted or rejected — the interaction log
(`edoscrm_ai_interactions`) is itself auditable (brief §27). The assistant
never writes to `edoscrm_complaints`, severity, RCA, or CAPA directly — every
action is "AI Suggested," surfaced for a human to accept, exactly as brief
§26 requires. Implemented as server actions calling the Anthropic API
directly; no AI code ships to the client.

---

## 12. SLA engine

`edoscrm_sla_rules` holds the configurable thresholds from brief §39
(acknowledgement windows, T1/T2/T3 RCA deadlines, escalation counts) as data,
not constants in code — the brief explicitly asks for these to be
configurable rather than hard-coded. SLA status (on-track/at-risk/overdue) is
a computed value, not a stored one, so it's never stale: computed from
`now() - relevant_event.created_at` against the rule, wherever it's
displayed (card, table, detail page, notification — brief §16).

---

## 13. What Phase 1 is explicitly *not* deciding yet

- Exact permission key list (mirrors EDOSPMIS's `has_permission(key)` string
  convention — the specific keys come with each module in Phase 6+).
- Workflow *builder* UI (§45) — the engine (§10) ships first; a visual
  drag-and-drop builder is real product-design work worth its own pass once
  there's at least one real workflow running through the engine to build the
  UI against.
- Full AI feature set (§25) — one AI action ("Summarize case") end-to-end
  first, to prove the human-in-the-loop pattern, before adding the other
  seven.
- Integrations API beyond the intake endpoint (§41) — versioned `/api/v1/*`
  routes get added as real consumers need them, not speculatively.

---

## 14. Recommended build sequence (concrete version of the brief's §49 phases)

1. **Foundation**: `edoscrm_*` migrations in the `edos-pos` project,
   `edoscrm_tenants` / `edoscrm_users` / RBAC / RLS pattern (§5), auth pages,
   empty app shell with grouped nav (ported from EDOSPMIS).
2. **Cases core**: `edoscrm_complaints` + `edoscrm_complaint_events`, case
   list + detail page, manual status field (workflow engine not wired yet).
3. **Workflow engine** (§10) wired to cases; chevron stepper ported from
   EDOSPMIS; case detail becomes the command centre (brief §13).
4. **Tasks** + generic board (§10), linked to cases.
5. **SLA engine** (§12) visible on cards/tables/detail.
6. **Investigation/RCA/CAPA** modules.
7. **Dashboards** (§9), reports (§37).
8. **AI assistant**, one action end-to-end (§11).
9. **Public intake API** (§8) + first real website integration.
10. Everything else in the brief (workflow builder UI, notification centre,
    platform admin/subscriptions, integrations beyond intake) — sequenced
    against actual need once the above is live and being used.

This gets a genuinely usable, demoable product (steps 1–5) before touching
AI, the public API, or any admin-configuration UI — matching the brief's own
instruction not to start by generating hundreds of UI files.

---

## Decisions — resolved

1. **`edos-pos` project** (§2), `edoscrm_*` prefix, additive-only migrations
   alongside edos-poa/edospoa-posv1/edoshatch360.
2. **Build sequence stands as §14** — AI (step 8) and the workflow builder UI
   stay deferred. Reasoning: both are real, separable pieces of work whose
   design benefits from a live workflow/case to point at, and neither blocks
   anything else in the sequence — pulling either forward would mean
   designing them against imagined data instead of real cases.
3. **First tenant: EDOS Centre itself**, not an outside pilot org. It's the
   one workload in the household guaranteed to actually get used and produce
   honest feedback (per the standing rule this session — EDOS Centre is the
   developer's own shop, not a customer to be pitched — the CRM is a tool
   being *dogfooded* here, not sold to itself). The category/severity model
   (§7) stays generic enough that a manufacturing-style tenant (product
   batches, recalls) — edos-poultry is the obvious internal candidate — slots
   in later without a schema change; EDOS Centre's own complaint/service
   workflow just won't exercise the batch/product-recall tables (§7, §39)
   until one does.

Phase 1 is done. Next step is Phase 2 — the actual `edoscrm_*` DDL and RLS
migrations for step 1 of §14 (tenants, users, RBAC).
