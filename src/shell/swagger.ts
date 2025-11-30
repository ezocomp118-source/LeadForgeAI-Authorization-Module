import {
	verificationPaths,
	verificationSchemas,
} from "./swagger-verification.js";

const { API_PREFIX: apiPrefix = "" } = process.env;

const registerPath = {
	post: {
		summary: "Accept invitation and register",
		requestBody: {
			required: true,
			content: {
				"application/json": {
					schema: {
						type: "object",
						required: ["token", "password"],
						properties: {
							token: { type: "string" },
							password: { type: "string", format: "password" },
						},
					},
				},
			},
		},
		responses: {
			201: { description: "User registered and session created" },
			400: { description: "Invalid payload" },
			404: { description: "Invitation not found or expired" },
		},
	},
};

const basePaths = {
	"/health": {
		get: {
			summary: "Health check",
			responses: {
				200: {
					description: "Service is healthy",
				},
			},
		},
	},
	"/api/invitations": {
		post: {
			summary: "Create invitation (admin)",
			requestBody: {
				required: true,
				content: {
					"application/json": {
						schema: {
							type: "object",
							required: [
								"email",
								"firstName",
								"lastName",
								"phone",
								"departmentId",
								"positionId",
								"invitedBy",
							],
							properties: {
								email: { type: "string", format: "email" },
								firstName: { type: "string" },
								lastName: { type: "string" },
								phone: { type: "string" },
								departmentId: { type: "string", format: "uuid" },
								positionId: { type: "string", format: "uuid" },
								invitedBy: { type: "string", format: "uuid" },
								expiresInHours: { type: "integer", minimum: 1 },
							},
						},
					},
				},
			},
			responses: {
				201: { description: "Invitation created" },
				400: { description: "Invalid payload" },
				401: { description: "Unauthorized" },
				403: { description: "Forbidden" },
			},
		},
		get: {
			summary: "List invitations (admin/HR)",
			parameters: [
				{
					in: "query",
					name: "status",
					schema: {
						type: "string",
						enum: ["pending", "accepted", "expired", "revoked"],
					},
				},
				{
					in: "query",
					name: "email",
					schema: { type: "string" },
				},
			],
			responses: {
				200: {
					description: "List of invitations",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									invitations: {
										type: "array",
										items: {
											type: "object",
											properties: {
												id: { type: "string", format: "uuid" },
												email: { type: "string", format: "email" },
												firstName: { type: "string" },
												lastName: { type: "string" },
												department: { type: "string", nullable: true },
												position: { type: "string", nullable: true },
												status: {
													type: "string",
													enum: ["pending", "accepted", "expired", "revoked"],
												},
												expiresAt: {
													type: "string",
													format: "date-time",
													nullable: true,
												},
												createdAt: {
													type: "string",
													format: "date-time",
													nullable: true,
												},
												acceptedAt: {
													type: "string",
													format: "date-time",
													nullable: true,
												},
												invitedBy: { type: "string", format: "uuid" },
												token: { type: "string", nullable: true },
											},
										},
									},
								},
							},
						},
					},
				},
				401: { description: "Unauthorized" },
				403: { description: "Forbidden" },
			},
		},
	},
	"/api/invitations/{id}/revoke": {
		post: {
			summary: "Revoke pending invitation",
			parameters: [
				{
					in: "path",
					name: "id",
					required: true,
					schema: { type: "string", format: "uuid" },
				},
			],
			responses: {
				200: { description: "Invitation revoked" },
				400: { description: "Invalid invitation id" },
				401: { description: "Unauthorized" },
				403: { description: "Forbidden" },
				404: { description: "Invitation not found or not pending" },
			},
		},
	},
	"/api/register": registerPath,
	"/api/auth/register": registerPath,
	"/api/auth/login": {
		post: {
			summary: "Login with email/password",
			requestBody: {
				required: true,
				content: {
					"application/json": {
						schema: {
							type: "object",
							required: ["email", "password"],
							properties: {
								email: { type: "string", format: "email" },
								password: { type: "string", format: "password" },
							},
						},
					},
				},
			},
			responses: {
				200: { description: "Logged in" },
				401: { description: "Invalid credentials" },
			},
		},
	},
	"/api/auth/logout": {
		post: {
			summary: "Logout current session",
			responses: {
				204: { description: "Logged out" },
			},
		},
	},
	"/api/auth/me": {
		get: {
			summary: "Get current user",
			responses: {
				200: {
					description: "Current user info",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									id: { type: "string", format: "uuid" },
									email: { type: "string", format: "email" },
									firstName: { type: "string" },
									lastName: { type: "string" },
									emailVerified: { type: "boolean" },
									phoneVerified: { type: "boolean" },
								},
							},
						},
					},
				},
				401: { description: "Unauthorized" },
			},
		},
	},
};

export const swaggerDocument = {
	openapi: "3.0.0",
	info: {
		title: "LeadForge Authorization API",
		version: "0.1.0",
	},
	servers: [{ url: apiPrefix }],
	paths: {
		...basePaths,
		...verificationPaths,
	},
	components: {
		schemas: {
			...verificationSchemas,
		},
	},
};
