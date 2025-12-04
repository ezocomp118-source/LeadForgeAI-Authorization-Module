const verificationRequestResponses = {
    200: {
        description: "Issued verification token",
        content: {
            "application/json": {
                schema: {
                    $ref: "#/components/schemas/VerificationRequestResponse",
                },
            },
        },
    },
    401: { description: "Unauthorized" },
    429: {
        description: "Rate limited",
        content: {
            "application/json": {
                schema: { $ref: "#/components/schemas/VerificationError" },
            },
        },
    },
};
const requestPath = (summary) => ({
    post: {
        summary,
        responses: verificationRequestResponses,
    },
});
const confirmRequestBody = (field) => ({
    required: true,
    content: {
        "application/json": {
            schema: {
                type: "object",
                required: [field],
                properties: {
                    [field]: { type: "string" },
                },
            },
        },
    },
});
const confirmResponses = (successDescription, invalidDescription) => ({
    200: {
        description: successDescription,
        content: {
            "application/json": {
                schema: {
                    $ref: "#/components/schemas/VerificationConfirmResponse",
                },
            },
        },
    },
    400: {
        description: invalidDescription,
        content: {
            "application/json": {
                schema: { $ref: "#/components/schemas/VerificationError" },
            },
        },
    },
});
const confirmPath = (summary, field, successDescription, invalidDescription) => ({
    post: {
        summary,
        requestBody: confirmRequestBody(field),
        responses: confirmResponses(successDescription, invalidDescription),
    },
});
export const verificationPaths = {
    "/api/auth/email/verify/request": requestPath("Request email verification token"),
    "/api/auth/email/verify/confirm": confirmPath("Confirm email verification token", "token", "Email verified", "Invalid or expired token"),
    "/api/auth/phone/verify/request": requestPath("Request phone verification code"),
    "/api/auth/phone/verify/confirm": confirmPath("Confirm phone verification code", "code", "Phone verified", "Invalid, expired or exhausted attempts"),
};
export const verificationSchemas = {
    VerificationRequestResponse: {
        type: "object",
        properties: {
            status: { type: "string", enum: ["ok"] },
            alreadyVerified: { type: "boolean" },
            emailVerified: { type: "boolean" },
            phoneVerified: { type: "boolean" },
            devVerifyUrl: { type: "string", format: "uri" },
            devCode: { type: "string" },
        },
    },
    VerificationConfirmResponse: {
        type: "object",
        properties: {
            status: { type: "string", enum: ["ok"] },
            emailVerified: { type: "boolean" },
            phoneVerified: { type: "boolean" },
        },
    },
    VerificationError: {
        type: "object",
        properties: {
            error: {
                type: "object",
                required: ["code"],
                properties: {
                    code: {
                        type: "string",
                        enum: [
                            "code_invalid",
                            "code_expired",
                            "too_many_attempts",
                            "rate_limited",
                            "verification_required",
                        ],
                    },
                    message: { type: "string" },
                },
            },
        },
    },
};
