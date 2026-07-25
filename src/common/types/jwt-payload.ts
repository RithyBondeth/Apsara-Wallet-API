export interface JwtPayload {
  sub: string; // user id
  email: string;
}

/** Shape attached to req.user by JwtStrategy.validate(). */
export interface AuthUser {
  id: string;
  email: string;
}
