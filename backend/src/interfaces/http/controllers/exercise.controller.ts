import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { GetExerciseByIdUseCase } from '../../../application/exercise/get-exercise-by-id.use-case';
import { GetExercisesUseCase } from '../../../application/exercise/get-exercises.use-case';
import { SetPreferenceUseCase } from '../../../application/exercise/set-preference.use-case';
import { ToggleFavoriteUseCase } from '../../../application/exercise/toggle-favorite.use-case';
import { ExerciseWithPreference } from '../../../domain/exercise/exercise-with-preference';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../decorators/current-user.decorator';
import { ListExercisesDto } from '../dto/list-exercises.dto';
import { SetPreferenceDto } from '../dto/set-preference.dto';

@Controller('exercises')
export class ExerciseController {
  constructor(
    private readonly getExercises: GetExercisesUseCase,
    private readonly getExerciseById: GetExerciseByIdUseCase,
    private readonly toggleFavorite: ToggleFavoriteUseCase,
    private readonly setPreference: SetPreferenceUseCase,
  ) {}

  @Get()
  async list(
    @Query() query: ListExercisesDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.getExercises.execute({
      muscleGroup: query.muscleGroup,
      equipment: query.equipment,
      page: query.page,
      limit: query.limit,
      userId: user.id,
    });
  }

  @Get(':id')
  async detail(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ExerciseWithPreference> {
    const exercise = await this.getExerciseById.execute(id, user.id);
    if (!exercise) throw new NotFoundException('Exercise not found');
    return exercise;
  }

  @Post(':id/favorite')
  async markFavorite(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ isFavorite: boolean }> {
    const isFavorite = await this.toggleFavorite.execute(user.id, id, true);
    return { isFavorite };
  }

  @Delete(':id/favorite')
  @HttpCode(HttpStatus.OK)
  async removeFavorite(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ isFavorite: boolean }> {
    const isFavorite = await this.toggleFavorite.execute(user.id, id, false);
    return { isFavorite };
  }

  @Patch(':id/preference')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setExercisePreference(
    @Param('id') id: string,
    @Body() dto: SetPreferenceDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<void> {
    await this.setPreference.execute(user.id, id, dto.weight);
  }
}
