import type { AdminState, CreateInvitationResponse } from "./admin-types.js";
import type { InvitationStatus, InvitationView } from "./types.js";
import { formatDate } from "./ui.js";

export type AdminElements = {
  readonly inviteSuccess: HTMLDivElement;
  readonly inviteSuccessToken: HTMLElement;
  readonly inviteSuccessExpiry: HTMLElement;
  readonly invitesBody: HTMLTableSectionElement;
  readonly invitesEmpty: HTMLDivElement;
  readonly userBadge: HTMLDivElement;
};

const createStatusBadge = (status: InvitationStatus): HTMLSpanElement => {
  const badge = document.createElement("span");
  badge.className = `status ${status}`;
  badge.textContent = status;
  return badge;
};

const createActionButton = (
  label: string,
  className: string,
  action: string,
  value: string,
): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  const dataset = button.dataset as {
    action?: string;
    token?: string | undefined;
    id?: string | undefined;
  };
  dataset.action = action;
  dataset.token = action.includes("token") ? value : undefined;
  dataset.id = action === "revoke" ? value : undefined;
  return button;
};

const createActionsCell = (invite: InvitationView): HTMLTableCellElement => {
  const cell = document.createElement("td");
  if (invite.status !== "pending") {
    cell.textContent = "—";
    return cell;
  }
  const stack = document.createElement("div");
  stack.className = "stack";
  if (invite.token) {
    stack.append(
      createActionButton(
        "Copy token",
        "btn-primary",
        "copy-token",
        invite.token,
      ),
      createActionButton("Copy link", "btn-ghost", "copy-link", invite.token),
    );
  }
  stack.append(createActionButton("Revoke", "btn-danger", "revoke", invite.id));
  cell.append(stack);
  return cell;
};

const createStatusCell = (status: InvitationStatus): HTMLTableCellElement => {
  const td = document.createElement("td");
  td.append(createStatusBadge(status));
  return td;
};

export const renderLatestInvite = (
  latest: CreateInvitationResponse | null,
  elements: AdminElements,
): void => {
  if (!latest) {
    elements.inviteSuccess.classList.add("hidden");
    return;
  }
  elements.inviteSuccessToken.textContent = latest.token;
  elements.inviteSuccessExpiry.textContent = `Expires at ${formatDate(latest.expiresAt)}`;
  elements.inviteSuccess.classList.remove("hidden");
};

export const renderUserBadge = (
  state: AdminState,
  elements: AdminElements,
): void => {
  elements.userBadge.textContent = state.me
    ? `${state.me.firstName} ${state.me.lastName}`
    : "Not authenticated";
};

export const renderInvitations = (
  invitations: ReadonlyArray<InvitationView>,
  elements: AdminElements,
): void => {
  if (invitations.length === 0) {
    elements.invitesEmpty.classList.remove("hidden");
    elements.invitesBody.replaceChildren();
    return;
  }
  elements.invitesEmpty.classList.add("hidden");
  const rows = invitations.map((invite) => {
    const row = document.createElement("tr");
    row.append(
      Object.assign(document.createElement("td"), {
        textContent: invite.email,
      }),
      Object.assign(document.createElement("td"), {
        textContent: `${invite.firstName} ${invite.lastName}`,
      }),
      Object.assign(document.createElement("td"), {
        textContent: invite.department ?? "—",
      }),
      Object.assign(document.createElement("td"), {
        textContent: invite.position ?? "—",
      }),
      createStatusCell(invite.status),
      Object.assign(document.createElement("td"), {
        textContent: formatDate(invite.expiresAt),
      }),
      Object.assign(document.createElement("td"), {
        textContent: formatDate(invite.createdAt),
      }),
      Object.assign(document.createElement("td"), {
        textContent: formatDate(invite.acceptedAt),
      }),
      createActionsCell(invite),
    );
    return row;
  });
  elements.invitesBody.replaceChildren(...rows);
};

export const filterInvitations = (
  invitations: ReadonlyArray<InvitationView>,
  filters: { status: InvitationStatus | "all"; email: string },
): ReadonlyArray<InvitationView> =>
  invitations.filter((invite) => {
    const matchesStatus = filters.status === "all" ? true : invite.status === filters.status;
    const matchesEmail = filters.email.trim().length === 0
      ? true
      : invite.email.toLowerCase().includes(filters.email.toLowerCase());
    return matchesStatus && matchesEmail;
  });
