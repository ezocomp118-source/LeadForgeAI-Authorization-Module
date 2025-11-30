import * as JsonSchema from "@effect/schema/JSONSchema";
import * as Schema from "@effect/schema/Schema";

type HttpMethod = "get" | "post";
type ParameterLocation = "query" | "path";
type JsonShape = JsonSchema.JsonSchema7Root;

type ParameterContract = {
	readonly name: string;
	readonly in: ParameterLocation;
	readonly required: boolean;
	readonly schema: JsonShape;
	readonly description?: string;
};

type ResponseContract = {
	readonly description: string;
	readonly schema?: JsonShape;
	readonly contentType?: string;
};

type RequestBodyContract = {
	readonly schema: JsonShape;
	readonly required?: boolean;
	readonly description?: string;
	readonly contentType?: string;
};

type RouteContract = {
	readonly path: string;
	readonly method: HttpMethod;
	readonly summary: string;
	readonly parameters?: ReadonlyArray<ParameterContract>;
	readonly requestBody?: RequestBodyContract;
	readonly responses: Record<number, ResponseContract>;
};

type ParameterObject = {
	readonly name: string;
	readonly in: ParameterLocation;
	readonly required: boolean;
	readonly description?: string;
	readonly schema: JsonShape;
};

type ResponseObject = {
	readonly description: string;
	readonly content?: Record<string, { readonly schema: JsonShape }>;
};

type RequestBodyObject = {
	readonly required: boolean;
	readonly description?: string;
	readonly content: Record<string, { readonly schema: JsonShape }>;
};

type PathMethodObject = {
	readonly summary: string;
	readonly parameters?: ReadonlyArray<ParameterObject>;
	readonly requestBody?: RequestBodyObject;
	readonly responses: Record<string | number, ResponseObject>;
};
const jsonSchema = <A, I, R>(schema: Schema.Schema<A, I, R>): JsonShape =>
	JsonSchema.make(schema);

const emailSchema = Schema.String.annotations({
	jsonSchema: { format: "email" },
});
const passwordSchema = Schema.String.annotations({
	jsonSchema: { format: "password" },
});
const uuidSchema = Schema.UUID;
const nullableString = Schema.NullOr(Schema.String);

const invitationStatusSchema = Schema.Literal(
	"pending",
	"accepted",
	"expired",
	"revoked",
);

const invitationViewSchema = Schema.Struct({
	id: uuidSchema,
	email: emailSchema,
	firstName: Schema.String,
	lastName: Schema.String,
	department: nullableString,
	position: nullableString,
	status: invitationStatusSchema,
	expiresAt: nullableString,
	createdAt: nullableString,
	acceptedAt: nullableString,
	invitedBy: uuidSchema,
	token: nullableString,
});

const listInvitationsResponseSchema = Schema.Struct({
	invitations: Schema.Array(invitationViewSchema),
});

const createInvitationBodySchema = Schema.Struct({
	email: emailSchema,
	firstName: Schema.String,
	lastName: Schema.String,
	phone: Schema.String,
	departmentId: uuidSchema,
	positionId: uuidSchema,
	invitedBy: uuidSchema,
	expiresInHours: Schema.optional(
		Schema.Int.annotations({ jsonSchema: { minimum: 1 } }),
	),
});

const registerBodySchema = Schema.Struct({
	token: Schema.String,
	password: passwordSchema,
});
const loginBodySchema = Schema.Struct({
	email: emailSchema,
	password: passwordSchema,
});

const meResponseSchema = Schema.Struct({
	id: uuidSchema,
	email: emailSchema,
	firstName: Schema.String,
	lastName: Schema.String,
	emailVerified: Schema.Boolean,
	phoneVerified: Schema.Boolean,
});

const invitationStatusJson = jsonSchema(invitationStatusSchema),
	invitationViewJson = jsonSchema(invitationViewSchema),
	listInvitationsResponseJson = jsonSchema(listInvitationsResponseSchema),
	createInvitationBodyJson = jsonSchema(createInvitationBodySchema),
	registerBodyJson = jsonSchema(registerBodySchema),
	loginBodyJson = jsonSchema(loginBodySchema),
	meResponseJson = jsonSchema(meResponseSchema),
	uuidJson = jsonSchema(uuidSchema),
	stringJson = jsonSchema(Schema.String);

const toResponseObject = (response: ResponseContract): ResponseObject =>
	response.schema
		? {
				description: response.description,
				content: {
					[response.contentType ?? "application/json"]: {
						schema: response.schema,
					},
				},
			}
		: { description: response.description };

const toParametersObject = (
	parameters: ReadonlyArray<ParameterContract> | undefined,
): ReadonlyArray<ParameterObject> | undefined =>
	parameters?.map((parameter) => {
		const base: ParameterObject = {
			name: parameter.name,
			in: parameter.in,
			required: parameter.required,
			schema: parameter.schema,
		};
		return parameter.description
			? { ...base, description: parameter.description }
			: base;
	});

const toRequestBody = (
	requestBody: RequestBodyContract | undefined,
): RequestBodyObject | undefined =>
	requestBody
		? {
				required: requestBody.required ?? true,
				content: {
					[requestBody.contentType ?? "application/json"]: {
						schema: requestBody.schema,
					},
				},
				...(requestBody.description
					? { description: requestBody.description }
					: {}),
			}
		: undefined;

export const buildPaths = (routes: ReadonlyArray<RouteContract>) => {
	const paths: Record<
		string,
		Partial<Record<HttpMethod, PathMethodObject>>
	> = {};
	routes.forEach((route) => {
		const existing = paths[route.path] ?? {};
		const parameters = toParametersObject(route.parameters);
		const requestBody = toRequestBody(route.requestBody);
		existing[route.method] = {
			summary: route.summary,
			...(parameters ? { parameters } : {}),
			...(requestBody ? { requestBody } : {}),
			responses: Object.fromEntries(
				Object.entries(route.responses).map(([status, response]) => [
					status,
					toResponseObject(response),
				]),
			),
		};
		paths[route.path] = existing;
	});
	return paths as Record<string, Record<HttpMethod, PathMethodObject>>;
};

const registerRouteBase: Omit<RouteContract, "path"> = {
	method: "post",
	summary: "Accept invitation and register",
	requestBody: { schema: registerBodyJson },
	responses: {
		201: { description: "User registered and session created" },
		400: { description: "Invalid payload" },
		404: { description: "Invitation not found or expired" },
	},
};

export const routes: ReadonlyArray<RouteContract> = [
	{
		path: "/health",
		method: "get",
		summary: "Health check",
		responses: { 200: { description: "Service is healthy" } },
	},
	{
		path: "/api/invitations",
		method: "post",
		summary: "Create invitation (admin)",
		requestBody: { schema: createInvitationBodyJson },
		responses: {
			201: { description: "Invitation created" },
			400: { description: "Invalid payload" },
			401: { description: "Unauthorized" },
			403: { description: "Forbidden" },
		},
	},
	{
		path: "/api/invitations",
		method: "get",
		summary: "List invitations (admin/HR)",
		parameters: [
			{
				name: "status",
				in: "query",
				required: false,
				schema: invitationStatusJson,
			},
			{ name: "email", in: "query", required: false, schema: stringJson },
		],
		responses: {
			200: {
				description: "List of invitations",
				schema: listInvitationsResponseJson,
			},
			401: { description: "Unauthorized" },
			403: { description: "Forbidden" },
		},
	},
	{
		path: "/api/invitations/{id}/revoke",
		method: "post",
		summary: "Revoke pending invitation",
		parameters: [{ name: "id", in: "path", required: true, schema: uuidJson }],
		responses: {
			200: { description: "Invitation revoked" },
			400: { description: "Invalid invitation id" },
			401: { description: "Unauthorized" },
			403: { description: "Forbidden" },
			404: { description: "Invitation not found or not pending" },
		},
	},
	{ path: "/api/register", ...registerRouteBase },
	{ path: "/api/auth/register", ...registerRouteBase },
	{
		path: "/api/auth/login",
		method: "post",
		summary: "Login with email/password",
		requestBody: { schema: loginBodyJson },
		responses: {
			200: { description: "Logged in" },
			401: { description: "Invalid credentials" },
		},
	},
	{
		path: "/api/auth/logout",
		method: "post",
		summary: "Logout current session",
		responses: {
			204: { description: "Logged out" },
		},
	},
	{
		path: "/api/auth/me",
		method: "get",
		summary: "Get current user",
		responses: {
			200: { description: "Current user info", schema: meResponseJson },
			401: { description: "Unauthorized" },
		},
	},
];

export const componentsSchemas = {
	Invitation: invitationViewJson,
	RegisterBody: registerBodyJson,
	LoginBody: loginBodyJson,
	Me: meResponseJson,
};
