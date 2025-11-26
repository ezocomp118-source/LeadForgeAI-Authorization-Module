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

const assertString = (value: string | undefined | null): value is string =>
	typeof value === "string" && value.trim().length > 0;

export type InviteCandidate = Partial<InvitePayload>;

export const parseInvite = (
	body: InviteCandidate | null | undefined,
): InvitePayload | null => {
	if (body === null || body === undefined) {
		return null;
	}
	const {
		email,
		firstName,
		lastName,
		phone,
		departmentId,
		positionId,
		invitedBy,
		expiresInHours,
	} = body;
	const required = [
		email,
		firstName,
		lastName,
		phone,
		departmentId,
		positionId,
		invitedBy,
	];
	if (!required.every(assertString)) {
		return null;
	}
	return {
		email: email as string,
		firstName: firstName as string,
		lastName: lastName as string,
		phone: phone as string,
		departmentId: departmentId as string,
		positionId: positionId as string,
		invitedBy: invitedBy as string,
		...(typeof expiresInHours === "number" ? { expiresInHours } : {}),
	};
};

export type RegisterCandidate = Partial<{
	token: string;
	password: string;
}>;

export type PasswordPolicyResult =
	| { readonly ok: true }
	| { readonly ok: false; readonly reasons: readonly string[] };

export const validatePasswordPolicy = (
	password: string,
): PasswordPolicyResult => {
	const reasons: string[] = [];
	if (password.length < 12) {
		reasons.push("Пароль короче 12 символов");
	}
	if (!/[a-z]/.test(password)) {
		reasons.push("Нет строчных букв");
	}
	if (!/[A-Z]/.test(password)) {
		reasons.push("Нет заглавных букв");
	}
	if (!/[0-9]/.test(password)) {
		reasons.push("Нет цифр");
	}
	if (!/[^A-Za-z0-9]/.test(password)) {
		reasons.push("Нет спецсимволов");
	}
	return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
};

export const parseRegister = (
	body: RegisterCandidate | null | undefined,
): RegisterPayload | null => {
	if (body === null || body === undefined) {
		return null;
	}
	if (!assertString(body.token) || !assertString(body.password)) {
		return null;
	}
	return {
		token: body.token,
		password: body.password,
	};
};

export type LoginCandidate = Partial<{
	email: string;
	password: string;
}>;

export const parseLogin = (
	body: LoginCandidate | null | undefined,
): LoginPayload | null => {
	if (body === null || body === undefined) {
		return null;
	}
	if (!assertString(body.email) || !assertString(body.password)) {
		return null;
	}
	return {
		email: body.email,
		password: body.password,
	};
};
