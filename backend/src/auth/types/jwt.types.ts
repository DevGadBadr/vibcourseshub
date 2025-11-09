// Minimal JWT payload shapes used by TokensService
// Extend as needed with additional claims

export type AccessJwtPayload = {
	sub: number;
	// Session id that issued this access token; used to invalidate when session is removed
	sid?: number;
	type?: 'access';
	[key: string]: unknown;
};

export type RefreshJwtPayload = {
	sub: number;
	// Session id
	sid?: number;
	// optional unique id for additional security/rotation
	jti?: string;
	type?: 'refresh';
	[key: string]: unknown;
};

export type JwtTokens = {
	accessToken: string;
	refreshToken: string;
};
