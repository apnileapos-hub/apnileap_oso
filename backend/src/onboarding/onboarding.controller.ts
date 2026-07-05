import { Controller, Get, Post, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('api/onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('register')
  async register(
    @Body()
    body: {
      companyName: string;
      email: string;
      subdomain: string;
      domain?: string;
      logoUrl?: string;
    },
  ) {
    return this.onboardingService.register(body);
  }

  @Get('requests')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('Super Admin')
  async getRequests(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search: string = '',
    @Query('status') status?: string,
  ) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    return this.onboardingService.getRequests(pageNum, limitNum, search, status);
  }

  @Post('requests/:id/approve')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('Super Admin')
  async approve(@Param('id', ParseIntPipe) id: number) {
    return this.onboardingService.approve(id);
  }

  @Post('requests/:id/reject')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('Super Admin')
  async reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { comments?: string },
  ) {
    return this.onboardingService.reject(id, body.comments || '');
  }
}
