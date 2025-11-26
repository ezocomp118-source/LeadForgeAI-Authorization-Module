const { API_PREFIX: apiPrefix = "" } = process.env;

export const swaggerDocument = {
	openapi: "3.0.0",
	info: {
		title: "LeadForge Authorization API",
		version: "0.1.0",
	},
	servers: [{ url: apiPrefix }],
	paths: {
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
				},
			},
		},
		"/api/register": {
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
		},
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
					200: { description: "Current user info" },
					401: { description: "Unauthorized" },
				},
			},
		},
	},
};
