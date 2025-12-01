import { Effect, pipe } from "effect";

import {
  decodeCreateInvitationResponse,
  decodeInvitationsResponse,
  decodeMe,
  decodeRevokeResponse,
  describeApiError,
} from "./admin-decoders.js";
import {
  type AdminElements,
  filterInvitations,
  renderInvitations,
  renderLatestInvite,
  renderUserBadge,
} from "./admin-render.js";
import type { AdminState, CreateInvitationResponse, Filters } from "./admin-types.js";
import { isString } from "./guards.js";
import { type ApiError, getJson, postJson } from "./http.js";
import type { InvitationStatus, JsonValue } from "./types.js";
import { requireElement, setInlineError, showToast } from "./ui.js";
import "./styles.css";

const DEFAULT_EXPIRES_HOURS = 72;

const state: AdminState = {
  invitations: [],
  filters: { status: "all", email: "" } satisfies Filters,
  latest: null,
  me: null,
};

const isButton = (element: Element): element is HTMLButtonElement => element instanceof HTMLButtonElement;
const isForm = (element: Element): element is HTMLFormElement => element instanceof HTMLFormElement;
const isDiv = (element: Element): element is HTMLDivElement => element instanceof HTMLDivElement;
const isInput = (element: Element): element is HTMLInputElement => element instanceof HTMLInputElement;
const isSelect = (element: Element): element is HTMLSelectElement => element instanceof HTMLSelectElement;
const isTbody = (element: Element): element is HTMLTableSectionElement => element instanceof HTMLTableSectionElement;

const elements: AdminElements = {
  inviteSuccess: requireElement("invite-success", isDiv),
  inviteSuccessToken: requireElement("invite-success-token", isDiv),
  inviteSuccessExpiry: requireElement("invite-success-expiry", isDiv),
  invitesBody: requireElement("invites-body", isTbody),
  invitesEmpty: requireElement("invites-empty", isDiv),
  userBadge: requireElement("user-badge", isDiv),
};

const inviteForm = requireElement("invite-form", isForm);
const inviteError = requireElement("invite-error", isDiv);
const copyCreatedToken = requireElement("copy-created-token", isButton);
const copyCreatedLink = requireElement("copy-created-link", isButton);
const filterStatus = requireElement("filter-status", isSelect);
const filterEmail = requireElement("filter-email", isInput);
const tableError = requireElement("table-error", isDiv);
const toastRoot = requireElement("toast-root", isDiv);

const isApiError = (
  error: ApiError | JsonValue | undefined,
): error is ApiError =>
  typeof error === "object"
  && error !== null
  && "_tag" in (error as Record<string, JsonValue>);

const handleLoadError = (
  error: ApiError | JsonValue | undefined,
  target: HTMLElement,
): void => {
  if (!isApiError(error)) {
    setInlineError(target, "Unexpected error");
    return;
  }
  const message = describeApiError(error);
  setInlineError(target, message);
  showToast(toastRoot, message, "error");
};

const renderLatest = (latest: CreateInvitationResponse | null): void => {
  renderLatestInvite(latest, elements);
  if (latest) {
    const tokenDataset = copyCreatedToken.dataset as { token?: string };
    const linkDataset = copyCreatedLink.dataset as { token?: string };
    tokenDataset.token = latest.token;
    linkDataset.token = latest.token;
    return;
  }
  delete (copyCreatedToken.dataset as { token?: string }).token;
  delete (copyCreatedLink.dataset as { token?: string }).token;
};

const loadInvitations = (): void => {
  void Effect.runPromise(getJson("/api/invitations", decodeInvitationsResponse))
    .then((response) => {
      state.invitations = response.invitations;
      setInlineError(tableError, null);
      renderInvitations(
        filterInvitations(state.invitations, state.filters),
        elements,
      );
    })
    .catch((error: ApiError | JsonValue | undefined) => {
      handleLoadError(error, tableError);
    });
};

const loadCurrentUser = (): void => {
  void Effect.runPromise(getJson("/api/auth/me", decodeMe))
    .then((profile) => {
      state.me = profile;
      renderUserBadge(state, elements);
    })
    .catch((error: ApiError | JsonValue | undefined) => {
      if (
        isApiError(error)
        && error._tag === "ApiError"
        && error.status === 401
      ) {
        state.me = null;
        renderUserBadge(state, elements);
        return;
      }
      handleLoadError(error, elements.userBadge);
    });
};

const buildInvitePayload = (
  formData: FormData,
):
  | { readonly ok: true; readonly payload: Record<string, string | number> }
  | { readonly ok: false; readonly message: string } =>
{
  const email = formData.get("email");
  const phone = formData.get("phone");
  const firstName = formData.get("firstName");
  const lastName = formData.get("lastName");
  const departmentId = formData.get("departmentId");
  const positionId = formData.get("positionId");
  const expiresInHoursRaw = formData.get("expiresInHours");
  const requiredFields = [
    email,
    phone,
    firstName,
    lastName,
    departmentId,
    positionId,
  ];
  if (!requiredFields.every((field) => isString(field))) {
    return { ok: false, message: "Please fill every required field." };
  }
  const expires = isString(expiresInHoursRaw)
    ? Number.parseInt(expiresInHoursRaw, 10)
    : DEFAULT_EXPIRES_HOURS;
  const expiresInHours = Number.isFinite(expires) && expires > 0 ? expires : DEFAULT_EXPIRES_HOURS;
  return {
    ok: true,
    payload: {
      email: (email as string).trim().toLowerCase(),
      phone: (phone as string).trim(),
      firstName: (firstName as string).trim(),
      lastName: (lastName as string).trim(),
      departmentId: (departmentId as string).trim(),
      positionId: (positionId as string).trim(),
      expiresInHours,
    },
  };
};

const submitInvitation = (payload: Record<string, string | number>): void => {
  void Effect.runPromise(
    postJson("/api/invitations", payload, decodeCreateInvitationResponse),
  )
    .then((response) => {
      state.latest = response;
      renderLatest(state.latest);
      setInlineError(inviteError, null);
      showToast(toastRoot, "Invitation issued", "success");
      loadInvitations();
    })
    .catch((error: ApiError | JsonValue | undefined) => {
      if (isApiError(error)) {
        const message = describeApiError(error);
        setInlineError(inviteError, message);
        showToast(toastRoot, message, "error");
        return;
      }
      setInlineError(inviteError, "Unexpected error");
    });
};

const revokeInvitation = (invitationId: string): void => {
  void Effect.runPromise(
    postJson(
      `/api/invitations/${invitationId}/revoke`,
      {},
      decodeRevokeResponse,
    ),
  )
    .then(() => {
      showToast(toastRoot, "Invitation revoked", "success");
      loadInvitations();
    })
    .catch((error: ApiError | JsonValue | undefined) => {
      handleLoadError(error, tableError);
    });
};

const copyText = (value: string, label: string): void => {
  const copyEffect = pipe(
    Effect.tryPromise(() => navigator.clipboard.writeText(value)),
    Effect.mapError((error) => error instanceof Error ? error : new Error("copy_failed")),
  );
  void Effect.runPromise(copyEffect)
    .then(() => {
      showToast(toastRoot, `${label} copied`, "success");
    })
    .catch(() => {
      window.prompt(`Copy ${label}`, value);
    });
};

const handleCopyAction = (
  action: string | undefined,
  token: string | undefined,
): boolean => {
  if (!isString(action) || !isString(token)) {
    return false;
  }
  if (action !== "copy-token" && action !== "copy-link") {
    return false;
  }
  const value = action === "copy-link"
    ? `${window.location.origin}/register?token=${encodeURIComponent(token)}`
    : token;
  copyText(value, action === "copy-link" ? "Share link" : "Token");
  return true;
};

const handleInviteSubmit = (event: SubmitEvent): void => {
  event.preventDefault();
  const formData = new FormData(inviteForm);
  const prepared = buildInvitePayload(formData);
  if (!prepared.ok) {
    setInlineError(inviteError, prepared.message);
    return;
  }
  submitInvitation(prepared.payload);
};

const handleActionClick = (event: MouseEvent): void => {
  const target = event.target;
  if (!(target instanceof Element) || !isButton(target)) {
    return;
  }
  const { action, token, id } = target.dataset;
  if (handleCopyAction(action, token)) {
    return;
  }
  if (action === "revoke" && isString(id)) {
    revokeInvitation(id);
  }
};

const handleFilterChange = (): void => {
  const statusValue = filterStatus.value;
  const nextStatus: InvitationStatus | "all" = statusValue === "all" ? "all" : (statusValue as InvitationStatus);
  state.filters = {
    status: nextStatus,
    email: filterEmail.value.trim(),
  };
  renderInvitations(
    filterInvitations(state.invitations, state.filters),
    elements,
  );
};

const bootstrap = (): void => {
  inviteForm.addEventListener("submit", handleInviteSubmit);
  elements.invitesBody.addEventListener("click", handleActionClick);
  filterStatus.addEventListener("change", handleFilterChange);
  filterEmail.addEventListener("input", handleFilterChange);
  copyCreatedToken.addEventListener("click", () => {
    if (state.latest) {
      copyText(state.latest.token, "Token");
    }
  });
  copyCreatedLink.addEventListener("click", () => {
    if (state.latest) {
      copyText(
        `${window.location.origin}/register?token=${encodeURIComponent(state.latest.token)}`,
        "Share link",
      );
    }
  });

  loadCurrentUser();
  loadInvitations();
  renderLatest(state.latest);
  renderUserBadge(state, elements);
  renderInvitations(
    filterInvitations(state.invitations, state.filters),
    elements,
  );
};

bootstrap();
