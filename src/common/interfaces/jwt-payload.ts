export interface IJwtPayload {
  sub: string;
  email: string;
}

export interface IRefreshPayload extends IJwtPayload {
  jti: string;
}

export interface IAuthUser {
  id: string;
  email: string;
}
