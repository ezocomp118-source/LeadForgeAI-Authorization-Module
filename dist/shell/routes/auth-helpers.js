const assertString = (value) => typeof value === "string" && value.trim().length > 0;
export const parseInvite = (body) => {
    if (body === null || body === undefined) {
        return null;
    }
    const { email, firstName, lastName, phone, departmentId, positionId, invitedBy, expiresInHours, } = body;
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
        email: email,
        firstName: firstName,
        lastName: lastName,
        phone: phone,
        departmentId: departmentId,
        positionId: positionId,
        invitedBy: invitedBy,
        ...(typeof expiresInHours === "number" ? { expiresInHours } : {}),
    };
};
export const validatePasswordPolicy = (password) => {
    const tooShort = password.length < 12;
    const missingLower = !/[a-z]/.test(password);
    const missingUpper = !/[A-Z]/.test(password);
    const missingDigit = !/[0-9]/.test(password);
    const missingSymbol = !/[^A-Za-z0-9]/.test(password);
    const failed = tooShort || missingLower || missingUpper || missingDigit || missingSymbol;
    return failed
        ? {
            ok: false,
            tooShort,
            missingLower,
            missingUpper,
            missingDigit,
            missingSymbol,
        }
        : { ok: true };
};
export const parseRegister = (body) => {
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
export const parseLogin = (body) => {
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
