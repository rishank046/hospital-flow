const revokedTokens = new Map<string, number>();

export function revokeToken(token: string, expiresAt: number): void {
	revokedTokens.set(token, expiresAt);
}

export function isTokenRevoked(token: string): boolean {
	const expiresAt = revokedTokens.get(token);

	if (expiresAt === undefined) {
		return false;
	}

	if (expiresAt <= Date.now()) {
		revokedTokens.delete(token);
		return false;
	}

	return true;
}