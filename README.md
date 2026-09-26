# EDOS CRM

Multi-tenant complaint management / case workflow SaaS. See
[ARCHITECTURE.md](./ARCHITECTURE.md) for the full system design and build
sequence. Through Phase 5: tenants, users, org structure, RBAC, auth,
complaints with an event log, a data-driven workflow engine with a chevron
stage stepper (ported from EDOSPMIS), and tasks on a generic Kanban board
that can optionally link to a complaint. No SLA engine, investigations/
RCA/CAPA or dashboards yet.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY
npm run dev
```

The database lives in the shared `edos-pos` Supabase project
(`cnlyuwslpcgosgwdmzav`) — see ARCHITECTURE.md §2 for what that sharing does
and doesn't mean. Migrations are in `supabase/migrations/`, applied directly
against that project (no local Supabase stack).

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
- [ ] Phase 6 — SLA engine
- [ ] everything after — see ARCHITECTURE.md §14
