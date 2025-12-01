import { Effect } from "effect";

import {
  decodeCreateInvitationResponse,
  decodeInvitationsResponse,
  decodeMe,
  describeApiError,
} from "./admin-decoders.js";
import type { CreateInvitationResponse, Filters } from "./admin-types.js";
import type { ApiError } from "./http.js";
import { getJson, postJson } from "./http.js";
import type { InvitationView, MeProfile } from "./types.js";

export type ApiResult<T> =
  | { readonly _tag: "Success"; readonly data: T }
  | { readonly _tag: "Failure"; readonly error: string };

export const toApiResult = <T>(
  effect: Effect.Effect<T, ApiError>,
  describeError: (error: ApiError) => string = describeApiError,
): Effect.Effect<ApiResult<T>> =>
  Effect.match(effect, {
    onFailure: (error) => ({
      _tag: "Failure",
      error: describeError(error),
    }),
    onSuccess: (data) => ({ _tag: "Success", data }),
  });

const buildStatusQuery = (status: Filters["status"]): string => status === "all" ? "" : `status=${status}`;

const buildEmailQuery = (email: string): string =>
  email.trim().length > 0 ? `email=${encodeURIComponent(email.trim())}` : "";

const joinQueries = (parts: ReadonlyArray<string>): string => parts.filter((part) => part.length > 0).join("&");

export const loadMe = (): Effect.Effect<ApiResult<MeProfile>> => toApiResult(getJson("/api/auth/me", decodeMe));

export const loadInvitations = (
  filters: Filters,
): Effect.Effect<ApiResult<{ readonly invitations: ReadonlyArray<InvitationView> }>> => {
  const qs = joinQueries([
    buildStatusQuery(filters.status),
    buildEmailQuery(filters.email),
  ]);
  const path = qs.length > 0 ? `/api/invitations?${qs}` : "/api/invitations";
  return toApiResult(getJson(path, decodeInvitationsResponse));
};

export type CreateInviteParams = {
  readonly form: {
    readonly email: string;
    readonly phone: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly departmentId: string;
    readonly positionId: string;
    readonly expiresInHours: string;
  };
  readonly invitedBy: string;
};

export const createInvitation = ({
  form,
  invitedBy,
}: CreateInviteParams): Effect.Effect<ApiResult<CreateInvitationResponse>> =>
  toApiResult(
    postJson(
      "/api/invitations",
      {
        email: form.email,
        phone: form.phone,
        firstName: form.firstName,
        lastName: form.lastName,
        departmentId: form.departmentId,
        positionId: form.positionId,
        expiresInHours: Number.parseInt(form.expiresInHours, 10),
        invitedBy,
      },
      decodeCreateInvitationResponse,
    ),
  );

export type DataLoaders = {
  readonly loadMe: () => Effect.Effect<ApiResult<MeProfile>>;
  readonly loadInvitations: (
    filters: Filters,
  ) => Effect.Effect<
    ApiResult<{ readonly invitations: ReadonlyArray<InvitationView> }>
  >;
  readonly createInvitation: (
    params: CreateInviteParams,
  ) => Effect.Effect<ApiResult<CreateInvitationResponse>>;
};

export const defaultDataLoaders: DataLoaders = {
  loadMe,
  loadInvitations,
  createInvitation,
};
