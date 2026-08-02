import { plainToInstance, Type } from 'class-transformer';
import {
  IsBooleanString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

enum ENodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvVars {
  @IsEnum(ENodeEnv)
  NODE_ENV: ENodeEnv = ENodeEnv.Development;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_TTL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_TTL!: string;

  // Set to 'false' to disable the hourly recurring-materialization cron
  // (defaults to enabled). See RecurringSchedulerService.
  @IsOptional()
  @IsBooleanString()
  RECURRING_SCHEDULER_ENABLED?: string;

  // Resend transactional email (password reset). Unset = emails disabled;
  // in dev the reset token is returned in the response instead.
  @IsOptional()
  @IsString()
  RESEND_API_KEY?: string;

  @IsOptional()
  @IsString()
  RESEND_FROM?: string;

  @IsOptional()
  @IsString()
  PASSWORD_RESET_URL?: string;

  // Comma-separated browser origins allowed through CORS. Unset in production
  // means "no browser origin allowed" — native mobile clients are unaffected
  // because they send no Origin header.
  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  // Set to 'true' to serve /docs in production (off by default).
  @IsOptional()
  @IsBooleanString()
  SWAGGER_ENABLED?: string;

  // Set to 'true' to force TLS on the Postgres connection when the URL has no
  // sslmode parameter. Not needed on Railway's private network.
  @IsOptional()
  @IsBooleanString()
  DATABASE_SSL?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvVars, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n${errors
        .map((e) => `  - ${Object.values(e.constraints ?? {}).join(', ')}`)
        .join('\n')}`,
    );
  }
  return validated;
}
