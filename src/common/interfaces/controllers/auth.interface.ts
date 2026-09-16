import { DeleteAccountDTO } from '../../../modules/auth/dtos/delete-account.dto';
import { ForgotPasswordDTO } from '../../../modules/auth/dtos/forgot-password.dto';
import { LoginDTO } from '../../../modules/auth/dtos/login.dto';
import { RefreshTokenDTO } from '../../../modules/auth/dtos/refresh-token.dto';
import { RegisterDTO } from '../../../modules/auth/dtos/register.dto';
import { ResetPasswordDTO } from '../../../modules/auth/dtos/reset-password.dto';
import { UpdateProfileDTO } from '../../../modules/auth/dtos/update-profile.dto';
import { IAuthUser } from '../jwt-payload';

export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface IForgotPasswordResponse {
  message: string;
  resetToken?: string;
}

export interface ISuccessResponse {
  success: boolean;
}

export interface IAuthController {
  register(dto: RegisterDTO): Promise<IAuthTokens>;
  login(dto: LoginDTO): Promise<IAuthTokens>;
  refresh(dto: RefreshTokenDTO): Promise<IAuthTokens>;
  logout(dto: RefreshTokenDTO): Promise<ISuccessResponse>;
  forgotPassword(dto: ForgotPasswordDTO): Promise<IForgotPasswordResponse>;
  resetPassword(dto: ResetPasswordDTO): Promise<ISuccessResponse>;
  me(user: IAuthUser): Promise<IAuthUser>;
  updateMe(user: IAuthUser, dto: UpdateProfileDTO): Promise<IAuthUser>;
  deleteMe(user: IAuthUser, dto: DeleteAccountDTO): Promise<ISuccessResponse>;
}
