import { Effect } from "effect";

import {
	decodeCreateInvitationResponse,
	decodeInvitationsResponse,
	decodeMe,
	describeApiError,
} from "../../src/web/admin-decoders.js";
import type {
	CreateInvitationResponse,
	Filters,
} from "../../src/web/admin-types.js";
import type { ApiError } from "../../src/web/http.js";
import { getJson, postJson } from "../../src/web/http.js";
import type { InvitationView, MeProfile } from "../../src/web/types.js";

export type ApiResult<T> =
	| { readonly _tag: "Success"; readonly data: T }
	| { readonly _tag: "Failure"; readonly error: string };

const toApiResult = <T>(
	effect: Effect.Effect<T, ApiError>,
): Effect.Effect<ApiResult<T>> =>
	Effect.match(effect, {
		onFailure: (error) => ({
			_tag: "Failure",
			error: describeApiError(error),
		}),
		onSuccess: (data) => ({ _tag: "Success", data }),
	});

const buildStatusQuery = (status: Filters["status"]): string =>
	status === "all" ? "" : `status=${status}`;

const buildEmailQuery = (email: string): string =>
	email.trim().length > 0 ? `email=${encodeURIComponent(email.trim())}` : "";

const joinQueries = (parts: ReadonlyArray<string>): string =>
	parts.filter((part) => part.length > 0).join("&");

export const loadMe = () => toApiResult(getJson("/api/auth/me", decodeMe));

export const loadInvitations = (filters: Filters) => {
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

export const createInvitation = ({ form, invitedBy }: CreateInviteParams) =>
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
	loadInvitations: (filters) => {
		const status = filters.status === "all" ? "" : `status=${filters.status}`;
		const email =
			filters.email.trim().length > 0
				? `email=${encodeURIComponent(filters.email.trim())}`
				: "";
		const qs = [status, email].filter((part) => part.length > 0).join("&");
		const path = qs.length > 0 ? `/api/invitations?${qs}` : "/api/invitations";
		return toApiResult(getJson(path, decodeInvitationsResponse));
	},
	createInvitation,
};
