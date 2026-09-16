import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { IAuthUser } from '../../common/interfaces/jwt-payload';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RegisterDTO } from './dtos/register.dto';
import { LoginDTO } from './dtos/login.dto';
import { RefreshTokenDTO } from './dtos/refresh-token.dto';
import { UpdateProfileDTO } from './dtos/update-profile.dto';
import { ForgotPasswordDTO } from './dtos/forgot-password.dto';
import { ResetPasswordDTO } from './dtos/reset-password.dto';
import { DeleteAccountDTO } from './dtos/delete-account.dto';
import {
  IAuthTokens,
  IForgotPasswordResponse,
  IAuthController,
  ISuccessResponse,
} from '../../common/interfaces/controllers/auth.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController implements IAuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('register')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create an account and return a token pair' })
  async register(@Body() registerDTO: RegisterDTO): Promise<IAuthTokens> {
    return this.authService.register(registerDTO);
  }

  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Authenticate and return a token pair' })
  async login(@Body() loginDTO: LoginDTO): Promise<IAuthTokens> {
    return this.authService.login(loginDTO);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate a refresh token for a new token pair' })
  refresh(@Body() refreshTokenDTO: RefreshTokenDTO): Promise<IAuthTokens> {
    return this.authService.refresh(refreshTokenDTO);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Revoke a refresh token' })
  logout(@Body() refreshTokenDTO: RefreshTokenDTO): Promise<ISuccessResponse> {
    return this.authService.logout(refreshTokenDTO);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request a password reset token' })
  forgotPassword(
    @Body() dto: ForgotPasswordDTO,
  ): Promise<IForgotPasswordResponse> {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Set a new password using a reset token' })
  resetPassword(@Body() dto: ResetPasswordDTO): Promise<ISuccessResponse> {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Return the signed-in user's profile" })
  me(@CurrentUser() user: IAuthUser): Promise<IAuthUser> {
    return this.authService.profile(user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update the signed-in user's name/phone" })
  updateMe(
    @CurrentUser() user: IAuthUser,
    @Body() dto: UpdateProfileDTO,
  ): Promise<IAuthUser> {
    return this.authService.updateProfile(user.id, dto);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Permanently delete the signed-in account and all its data',
  })
  deleteMe(
    @CurrentUser() user: IAuthUser,
    @Body() dto: DeleteAccountDTO,
  ): Promise<ISuccessResponse> {
    return this.authService.deleteAccount(user.id, dto.password);
  }
}
