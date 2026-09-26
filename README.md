# EDOS CRM

Multi-tenant complaint management / case workflow SaaS. See
[ARCHITECTURE.md](./ARCHITECTURE.md) for the full system design and build
sequence — this is Phase 2 (foundation): tenants, users, org structure, RBAC,
auth, and an empty app shell. No cases, tasks or workflow engine yet.

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
- [ ] Phase 3 — cases + event log
- [ ] Phase 4 — workflow engine + chevron stepper (source TBD — see open question in conversation)
- [ ] everything after — see ARCHITECTURE.md §14
