type VerificationResponseBody = {
    readonly description: string;
    readonly content?: {
        readonly "application/json": {
            readonly schema: {
                readonly $ref: string;
            };
        };
    };
};
type ConfirmationRequestBody = {
    readonly required: true;
    readonly content: {
        readonly "application/json": {
            readonly schema: {
                readonly type: "object";
                readonly required: readonly string[];
                readonly properties: Record<string, {
                    readonly type: "string";
                }>;
            };
        };
    };
};
declare const verificationRequestResponses: {
    readonly 200: VerificationResponseBody;
    readonly 401: VerificationResponseBody;
    readonly 429: VerificationResponseBody;
};
export declare const verificationPaths: {
    "/api/auth/email/verify/request": {
        readonly post: {
            readonly summary: string;
            readonly responses: typeof verificationRequestResponses;
        };
    };
    "/api/auth/email/verify/confirm": {
        readonly post: {
            readonly summary: string;
            readonly requestBody: ConfirmationRequestBody;
            readonly responses: {
                readonly 200: VerificationResponseBody;
                readonly 400: VerificationResponseBody;
            };
        };
    };
    "/api/auth/phone/verify/request": {
        readonly post: {
            readonly summary: string;
            readonly responses: typeof verificationRequestResponses;
        };
    };
    "/api/auth/phone/verify/confirm": {
        readonly post: {
            readonly summary: string;
            readonly requestBody: ConfirmationRequestBody;
            readonly responses: {
                readonly 200: VerificationResponseBody;
                readonly 400: VerificationResponseBody;
            };
        };
    };
};
export declare const verificationSchemas: {
    VerificationRequestResponse: {
        type: string;
        properties: {
            status: {
                type: string;
                enum: string[];
            };
            alreadyVerified: {
                type: string;
            };
            emailVerified: {
                type: string;
            };
            phoneVerified: {
                type: string;
            };
            devVerifyUrl: {
                type: string;
                format: string;
            };
            devCode: {
                type: string;
            };
        };
    };
    VerificationConfirmResponse: {
        type: string;
        properties: {
            status: {
                type: string;
                enum: string[];
            };
            emailVerified: {
                type: string;
            };
            phoneVerified: {
                type: string;
            };
        };
    };
    VerificationError: {
        type: string;
        properties: {
            error: {
                type: string;
                required: string[];
                properties: {
                    code: {
                        type: string;
                        enum: string[];
                    };
                    message: {
                        type: string;
                    };
                };
            };
        };
    };
};
export {};
