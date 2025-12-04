import * as JsonSchema from "@effect/schema/JSONSchema";
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
    readonly content?: Record<string, {
        readonly schema: JsonShape;
    }>;
};
type RequestBodyObject = {
    readonly required: boolean;
    readonly description?: string;
    readonly content: Record<string, {
        readonly schema: JsonShape;
    }>;
};
type PathMethodObject = {
    readonly summary: string;
    readonly parameters?: ReadonlyArray<ParameterObject>;
    readonly requestBody?: RequestBodyObject;
    readonly responses: Record<string | number, ResponseObject>;
};
export declare const buildPaths: (routes: ReadonlyArray<RouteContract>) => Record<string, Record<HttpMethod, PathMethodObject>>;
export declare const routes: ReadonlyArray<RouteContract>;
export declare const componentsSchemas: {
    Invitation: JsonSchema.JsonSchema7Root;
    RegisterBody: JsonSchema.JsonSchema7Root;
    LoginBody: JsonSchema.JsonSchema7Root;
    Me: JsonSchema.JsonSchema7Root;
};
export {};
