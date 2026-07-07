import { Body, Controller, Get, NotFoundException, Post } from '@nestjs/common';
import { AssessFitnessUseCase } from '../../../application/profile/assess-fitness.use-case';
import { GetProfileUseCase } from '../../../application/profile/get-profile.use-case';
import { SaveProfileUseCase } from '../../../application/profile/save-profile.use-case';
import type {
  FitnessProfileDraft,
  UserFitnessProfile,
} from '../../../domain/profile/user-fitness-profile';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../decorators/current-user.decorator';
import { AssessFitnessDto } from '../dto/assess-fitness.dto';
import { ConfirmProfileDto } from '../dto/confirm-profile.dto';

@Controller('profile')
export class ProfileController {
  constructor(
    private readonly assessFitnessUseCase: AssessFitnessUseCase,
    private readonly saveProfileUseCase: SaveProfileUseCase,
    private readonly getProfileUseCase: GetProfileUseCase,
  ) {}

  @Post('assess')
  async assess(
    @Body() dto: AssessFitnessDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<FitnessProfileDraft> {
    void user;
    return this.assessFitnessUseCase.execute(dto);
  }

  @Post()
  async save(
    @Body() dto: ConfirmProfileDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<UserFitnessProfile> {
    return this.saveProfileUseCase.execute(user.id, dto);
  }

  @Get()
  async get(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<UserFitnessProfile> {
    const profile = await this.getProfileUseCase.execute(user.id);
    if (!profile) throw new NotFoundException('No fitness profile found');
    return profile;
  }
}
