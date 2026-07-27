import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { IAuthUser } from '../../common/interfaces/jwt-payload';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RegisterDTO } from './dtos/register.dto';
import { LoginDTO } from './dtos/login.dto';
import { RefreshTokenDTO } from './dtos/refresh-token.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Create an account and return a token pair' })
  register(@Body() registerDTO: RegisterDTO) {
    return this.auth.register(registerDTO);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Authenticate and return a token pair' })
  login(@Body() loginDTO: LoginDTO) {
    return this.auth.login(loginDTO);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate a refresh token for a new token pair' })
  refresh(@Body() refreshTokenDTO: RefreshTokenDTO) {
    return this.auth.refresh(refreshTokenDTO);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Revoke a refresh token' })
  logout(@Body() refreshTokenDTO: RefreshTokenDTO) {
    return this.auth.logout(refreshTokenDTO);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Return the signed-in user's profile" })
  me(@CurrentUser() user: IAuthUser) {
    return this.auth.profile(user.id);
  }
}
