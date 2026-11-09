import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { SettingsService } from './settings.service.js';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @RequirePermissions('settings.read')
  getSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.settings.getSettings(user);
  }

  @Get('country-profiles')
  @RequirePermissions('settings.read')
  getCountryProfiles() {
    return this.settings.getCountryProfiles();
  }

  @Patch()
  @RequirePermissions('settings.manage')
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: UpdateSettingsDto,
  ) {
    return this.settings.updateSettings(user, input);
  }
}
