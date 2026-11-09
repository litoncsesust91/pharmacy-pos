import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CreateBranchDto } from './dto/create-branch.dto.js';
import { TenantsService } from './tenants.service.js';

@ApiTags('tenants')
@Controller()
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get('tenant/me')
  @RequirePermissions('tenant.read')
  getCurrent(@CurrentUser() user: AuthenticatedUser) {
    return this.tenants.getCurrent(user);
  }

  @Get('branches')
  @RequirePermissions('branch.read')
  getBranches(@CurrentUser() user: AuthenticatedUser) {
    return this.tenants.getBranches(user);
  }

  @Post('branches')
  @RequirePermissions('branch.manage')
  createBranch(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateBranchDto) {
    return this.tenants.createBranch(user, input);
  }

  @Get('branches/:branchId')
  @RequirePermissions('branch.read')
  getBranch(@CurrentUser() user: AuthenticatedUser, @Param('branchId') branchId: string) {
    return this.tenants.getBranch(user, branchId);
  }
}
