import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('api')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: any) {
    return this.authService.login(body.email, body.password);
  }

  @Post('register')
  async register(@Body() body: any) {
    return this.authService.register(
      body.email,
      body.password,
      body.displayName,
      body.role || 'Student',
    );
  }

  @Post('refresh')
  async refresh(@Body() body: any) {
    return this.authService.refreshToken(body.refresh_token);
  }
}
