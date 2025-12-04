export type InvitePayload = {
    readonly email: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly phone: string;
    readonly departmentId: string;
    readonly positionId: string;
    readonly invitedBy: string;
    readonly expiresInHours?: number;
};
export type RegisterPayload = {
    readonly token: string;
    readonly password: string;
};
export type LoginPayload = {
    readonly email: string;
    readonly password: string;
};
export type InviteCandidate = Partial<InvitePayload>;
export declare const parseInvite: (body: InviteCandidate | null | undefined) => InvitePayload | null;
export type RegisterCandidate = Partial<{
    token: string;
    password: string;
}>;
export type PasswordPolicyResult = {
    readonly ok: true;
} | {
    readonly ok: false;
    readonly tooShort: boolean;
    readonly missingLower: boolean;
    readonly missingUpper: boolean;
    readonly missingDigit: boolean;
    readonly missingSymbol: boolean;
};
export declare const validatePasswordPolicy: (password: string) => PasswordPolicyResult;
export declare const parseRegister: (body: RegisterCandidate | null | undefined) => RegisterPayload | null;
export type LoginCandidate = Partial<{
    email: string;
    password: string;
}>;
export declare const parseLogin: (body: LoginCandidate | null | undefined) => LoginPayload | null;
