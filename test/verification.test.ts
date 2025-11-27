import { describe, expect, it } from "vitest";

import {
	computeExpiresAt,
	evaluateAttempt,
	hashVerificationToken,
	isRateLimited,
} from "../src/core/verification.js";

const fixedNow = new Date("2025-01-01T00:00:00Z");

const baseAttempt = {
	storedHash: "stored",
	providedHash: "stored",
	attempts: 0,
	maxAttempts: 2,
	expiresAt: new Date(fixedNow.getTime() + 60_000),
	usedAt: null as Date | null,
	now: fixedNow,
};

describe("evaluateAttempt", () => {
	it("marks codes as expired when past TTL", () => {
		const outcome = evaluateAttempt({
			...baseAttempt,
			expiresAt: new Date(fixedNow.getTime() - 1),
		});
		expect(outcome._tag).toBe("Expired");
	});

	it("caps invalid attempts at maxAttempts", () => {
		const outcome = evaluateAttempt({
			...baseAttempt,
			storedHash: "expected",
			providedHash: "wrong",
			attempts: 1,
		});
		expect(outcome._tag).toBe("Invalid");
		if (outcome._tag === "Invalid") {
			expect(outcome.nextAttempts).toBe(2);
			expect(outcome.maxAttempts).toBe(2);
		}
	});

	it("blocks when attempts already exhausted", () => {
		const outcome = evaluateAttempt({
			...baseAttempt,
			attempts: 3,
			maxAttempts: 3,
		});
		expect(outcome._tag).toBe("TooManyAttempts");
	});

	it("rejects already used tokens even if hashes match", () => {
		const outcome = evaluateAttempt({
			...baseAttempt,
			usedAt: fixedNow,
		});
		expect(outcome._tag).toBe("Invalid");
	});

	it("accepts valid tokens before expiry", () => {
		const outcome = evaluateAttempt(baseAttempt);
		expect(outcome._tag).toBe("Verified");
	});
});

describe("auxiliary verification helpers", () => {
	it("computes expiration from TTL minutes", () => {
		const expiresAt = computeExpiresAt(fixedNow.getTime(), 10);
		expect(expiresAt.getTime()).toBe(fixedNow.getTime() + 10 * 60_000);
	});

	it("detects rate limiting when count reaches threshold", () => {
		expect(isRateLimited(5, 5)).toBe(true);
		expect(isRateLimited(4, 5)).toBe(false);
	});

	it("hashes tokens deterministically", () => {
		const first = hashVerificationToken("sample");
		const second = hashVerificationToken("sample");
		expect(first).toBe(second);
		expect(first).toHaveLength(64);
	});
});
