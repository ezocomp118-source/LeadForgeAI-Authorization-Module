export declare const swaggerDocument: {
    openapi: string;
    info: {
        title: string;
        version: string;
    };
    servers: {
        url: string;
    }[];
    paths: {
        "/api/auth/email/verify/request": {
            readonly post: {
                readonly summary: string;
                readonly responses: {
                    readonly 200: {
                        readonly description: string;
                        readonly content?: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: string;
                                };
                            };
                        };
                    };
                    readonly 401: {
                        readonly description: string;
                        readonly content?: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: string;
                                };
                            };
                        };
                    };
                    readonly 429: {
                        readonly description: string;
                        readonly content?: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        "/api/auth/email/verify/confirm": {
            readonly post: {
                readonly summary: string;
                readonly requestBody: {
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
                readonly responses: {
                    readonly 200: {
                        readonly description: string;
                        readonly content?: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: string;
                                };
                            };
                        };
                    };
                    readonly 400: {
                        readonly description: string;
                        readonly content?: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        "/api/auth/phone/verify/request": {
            readonly post: {
                readonly summary: string;
                readonly responses: {
                    readonly 200: {
                        readonly description: string;
                        readonly content?: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: string;
                                };
                            };
                        };
                    };
                    readonly 401: {
                        readonly description: string;
                        readonly content?: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: string;
                                };
                            };
                        };
                    };
                    readonly 429: {
                        readonly description: string;
                        readonly content?: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        "/api/auth/phone/verify/confirm": {
            readonly post: {
                readonly summary: string;
                readonly requestBody: {
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
                readonly responses: {
                    readonly 200: {
                        readonly description: string;
                        readonly content?: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: string;
                                };
                            };
                        };
                    };
                    readonly 400: {
                        readonly description: string;
                        readonly content?: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: string;
                                };
                            };
                        };
                    };
                };
            };
        };
    };
    components: {
        schemas: {
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
            Invitation: import("@effect/schema/JSONSchema").JsonSchema7Root;
            RegisterBody: import("@effect/schema/JSONSchema").JsonSchema7Root;
            LoginBody: import("@effect/schema/JSONSchema").JsonSchema7Root;
            Me: import("@effect/schema/JSONSchema").JsonSchema7Root;
        };
    };
};
