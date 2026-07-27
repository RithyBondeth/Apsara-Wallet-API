import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
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
}
