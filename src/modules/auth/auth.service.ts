import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { and, eq, gt } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { refreshTokens, users } from '../../database/schema';
import type {
  IJwtPayload,
  IRefreshPayload,
} from '../../common/interfaces/jwt-payload';
import { LoginDTO } from './dtos/login.dto';
import { RegisterDTO } from './dtos/register.dto';
import { RefreshTokenDTO } from './dtos/refresh-token.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDTO) {
    const [existing] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, dto.email.toLowerCase()));
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const [user] = await this.db
      .insert(users)
      .values({
        email: dto.email.toLowerCase(),
        fullName: dto.fullName,
        phone: dto.phone,
        passwordHash,
      })
      .returning();

    return this.buildSession(user.id, user.email);
  }

  /** The signed-in user's profile (no secrets). */
  async profile(userId: string) {
    const [user] = await this.db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        phone: users.phone,
      })
      .from(users)
      .where(eq(users.id, userId));
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  async login(dto: LoginDTO) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, dto.email.toLowerCase()));
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.buildSession(user.id, user.email);
  }

  async refresh(refreshTokenDTO: RefreshTokenDTO) {
    let payload: IRefreshPayload;
    const rawToken = refreshTokenDTO.refreshToken;

    try {
      payload = await this.jwt.verifyAsync<IRefreshPayload>(rawToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const [row] = await this.db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.id, payload.jti),
          gt(refreshTokens.expiresAt, new Date()),
        ),
      );
    if (!row || !(await bcrypt.compare(rawToken, row.tokenHash))) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Rotate: the presented token can never be reused.
    await this.db.delete(refreshTokens).where(eq(refreshTokens.id, row.id));
    return this.buildSession(payload.sub, payload.email);
  }

  async logout(refreshTokenDTO: RefreshTokenDTO) {
    const rawToken = refreshTokenDTO.refreshToken;

    try {
      const payload = await this.jwt.verifyAsync<IRefreshPayload>(rawToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });
      await this.db
        .delete(refreshTokens)
        .where(eq(refreshTokens.id, payload.jti));
    } catch {
      // Already invalid/expired — nothing to revoke.
    }
    return { success: true };
  }

  /** Signs an access token and a stored, rotatable refresh token. */
  private async buildSession(userId: string, email: string) {
    const payload: IJwtPayload = { sub: userId, email };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      expiresIn: this.config.getOrThrow('JWT_ACCESS_TTL'),
    });

    // Reserve the row id first so it can be embedded as the token's jti.
    const [row] = await this.db
      .insert(refreshTokens)
      .values({
        userId,
        tokenHash: '',
        expiresAt: this.refreshExpiry(),
      })
      .returning({ id: refreshTokens.id });

    const refreshToken = await this.jwt.signAsync(
      { ...payload, jti: row.id },
      {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
        expiresIn: this.config.getOrThrow('JWT_REFRESH_TTL'),
      },
    );
    await this.db
      .update(refreshTokens)
      .set({ tokenHash: await bcrypt.hash(refreshToken, 10) })
      .where(eq(refreshTokens.id, row.id));

    return { accessToken, refreshToken };
  }

  private refreshExpiry(): Date {
    const ttl = this.config.getOrThrow<string>('JWT_REFRESH_TTL');
    const match = /^(\d+)([smhd])$/.exec(ttl.trim());
    const seconds = match
      ? Number(match[1]) *
        { s: 1, m: 60, h: 3600, d: 86400 }[match[2] as 's' | 'm' | 'h' | 'd']
      : 60 * 60 * 24 * 30;
    return new Date(Date.now() + seconds * 1000);
  }
}
