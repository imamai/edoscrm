"use client";

import { useState, useTransition } from "react";
import { UserPlus, ShieldCheck, Ban, RotateCcw } from "lucide-react";
import { Modal, ModalFormActions } from "@/components/ui/modal";
import {
  Badge,
  Card,
  CardHeader,
  DataTable,
  Row,
  Cell,
  EmptyState,
} from "@/components/ui/primitives";
import { FieldError } from "@/components/ui/field";
import { formatDate } from "@/lib/utils";
import type { MemberDetail, Role } from "@/lib/data/members";
import {
  inviteMemberAction,
  setMemberRolesAction,
  setMemberStatusAction,
} from "./actions";

/**
 * Members and their roles.
 *
 * The seven roles the brief defines have been enforced in the database since
 * the schema was built — what was missing was any way to hand them out, which
 * left every workspace effectively single-role. Without this screen a
 * workspace cannot separate Marketing Operations from Quality from Finance, so
 * tier-based notification has nobody to notify and "a named investigating
 * function" is unreachable.
 */
export function MembersClient({
  members,
  roles,
}: {
  members: MemberDetail[];
  roles: Role[];
}) {
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<MemberDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Roles that describe a job in the process, listed first — they are what
  // somebody is usually here to assign.
  const ordered = [...roles].sort((a, b) => {
    const rank = (n: string) =>
      n === "Tenant Administrator" ? 0 : n === "Member" ? 2 : 1;
    return rank(a.name) - rank(b.name) || a.name.localeCompare(b.name);
  });

  function toggleStatus(m: MemberDetail) {
    setError(null);
    startTransition(async () => {
      const next = m.status === "active" ? "suspended" : "active";
      const result = await setMemberStatusAction(m.user_id, next);
      if (!result.ok) setError(result.error);
      else
        setNotice(
          next === "suspended"
            ? `${m.full_name ?? m.email} can no longer sign in to this workspace.`
            : `${m.full_name ?? m.email} has access again.`,
        );
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <FieldError>{error}</FieldError>}
      {notice && !error && (
        <p className="rounded-lg border border-good/30 bg-good/10 px-3 py-2 text-sm text-good">
          {notice}
        </p>
      )}

      <Card>
        <CardHeader
          title={`${members.length} ${members.length === 1 ? "person" : "people"}`}
          subtitle="Roles decide what someone can do. Access is enforced in the database, not just hidden in the interface."
          action={
            <button
              type="button"
              onClick={() => {
                setError(null);
                setNotice(null);
                setInviting(true);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-dark"
            >
              <UserPlus className="h-4 w-4" />
              Invite someone
            </button>
          }
        />
        <div className="p-4">
          {members.length === 0 ? (
            <EmptyState
              title="Nobody else is here yet"
              description="Invite the people who handle complaints, and give each of them the role that matches what they do."
              icon={<UserPlus className="h-7 w-7" />}
            />
          ) : (
            <DataTable header={["Person", "Roles", "Status", "Joined", ""]}>
              {members.map((m) => (
                <Row key={m.user_id}>
                  <Cell>
                    <p className="font-medium text-ink">{m.full_name ?? "—"}</p>
                    <p className="text-xs text-ink-faint">{m.email}</p>
                  </Cell>
                  <Cell>
                    {m.roles.length === 0 ? (
                      <span className="text-xs text-ink-faint">
                        No role — can sign in but do nothing
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {m.roles.map((r) => (
                          <Badge
                            key={r.id}
                            tone={
                              r.name === "Tenant Administrator"
                                ? "info"
                                : "neutral"
                            }
                          >
                            {r.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </Cell>
                  <Cell>
                    <Badge tone={m.status === "active" ? "good" : "danger"}>
                      {m.status}
                    </Badge>
                  </Cell>
                  <Cell className="whitespace-nowrap text-ink-faint">
                    {formatDate(m.created_at)}
                  </Cell>
                  <Cell className="whitespace-nowrap text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setNotice(null);
                        setEditing(m);
                      }}
                      className="mr-2 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Roles
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleStatus(m)}
                      disabled={pending}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-ink-faint hover:text-danger disabled:opacity-50"
                    >
                      {m.status === "active" ? (
                        <Ban className="h-3.5 w-3.5" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                      {m.status === "active" ? "Suspend" : "Reinstate"}
                    </button>
                  </Cell>
                </Row>
              ))}
            </DataTable>
          )}
        </div>
      </Card>

      <InviteModal
        open={inviting}
        roles={ordered}
        onClose={() => setInviting(false)}
        onDone={(message) => {
          setInviting(false);
          setNotice(message);
        }}
        onError={setError}
      />

      {editing && (
        <RolesModal
          member={editing}
          roles={ordered}
          onClose={() => setEditing(null)}
          onDone={() => {
            setNotice(
              `Roles updated for ${editing.full_name ?? editing.email}.`,
            );
            setEditing(null);
          }}
          onError={(e) => {
            setError(e);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function RoleChecklist({
  roles,
  selected,
  onChange,
}: {
  roles: Role[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {roles.map((r) => (
        <label
          key={r.id}
          className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-2.5 hover:border-brand/40"
        >
          <input
            type="checkbox"
            checked={selected.includes(r.id)}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...selected, r.id]
                  : selected.filter((id) => id !== r.id),
              )
            }
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand)]"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-ink">{r.name}</span>
            {r.description && (
              <span className="block text-xs text-ink-faint">
                {r.description}
              </span>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}

function InviteModal({
  open,
  roles,
  onClose,
  onDone,
  onError,
}: {
  open: boolean;
  roles: Role[];
  onClose: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!pending}
      title="Invite someone to this workspace"
      description="They get an email invitation. Someone who already has an EDOS CRM account is added straight away."
      size="md"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const result = await inviteMemberAction(email, selected);
            if (!result.ok) {
              onError(result.error);
              return;
            }
            setEmail("");
            setSelected([]);
            onDone(
              result.status !== "invited"
                ? `${email.trim()} already had an account and has been added.`
                : result.mailed
                  ? `Invitation sent to ${email.trim()}.`
                  : `${email.trim()} was added, but the invitation email could not be sent. Ask them to use "Forgot your password?" on the sign-in page to set a password.`,
            );
          });
        }}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="invite-email"
              className="text-xs font-medium text-ink-faint"
            >
              Email address
            </label>
            <input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.co.ke"
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none"
            />
            <p className="text-xs text-ink-faint">
              No Bio email account is required — external representatives and
              distributors can be invited at any address.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-ink-faint">Roles</p>
            <RoleChecklist
              roles={roles}
              selected={selected}
              onChange={setSelected}
            />
          </div>
        </div>
        <ModalFormActions
          onCancel={onClose}
          submitLabel="Send invitation"
          busy={pending}
        />
      </form>
    </Modal>
  );
}

function RolesModal({
  member,
  roles,
  onClose,
  onDone,
  onError,
}: {
  member: MemberDetail;
  roles: Role[];
  onClose: () => void;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>(
    member.roles.map((r) => r.id),
  );
  const [pending, startTransition] = useTransition();

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!pending}
      title={`Roles for ${member.full_name ?? member.email}`}
      description="Someone with no role can sign in but cannot do anything."
      size="md"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const result = await setMemberRolesAction(member.user_id, selected);
            if (!result.ok) onError(result.error);
            else onDone();
          });
        }}
      >
        <RoleChecklist
          roles={roles}
          selected={selected}
          onChange={setSelected}
        />
        <ModalFormActions
          onCancel={onClose}
          submitLabel="Save roles"
          busy={pending}
        />
      </form>
    </Modal>
  );
}
