// Minimal JWT payload shapes used by TokensService
// Extend as needed with additional claims

export type AccessJwtPayload = {
	sub: number;
	type?: 'access';
	[key: string]: unknown;
};

export type RefreshJwtPayload = {
	sub: number;
	type?: 'refresh';
	[key: string]: unknown;
};

export type JwtTokens = {
	accessToken: string;
	refreshToken: string;
};
