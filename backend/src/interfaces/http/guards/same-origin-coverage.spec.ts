import { RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { AnalysisController } from '../controllers/analysis.controller';
import { AuthController } from '../controllers/auth.controller';
import { ExecutionController } from '../controllers/execution.controller';
import { ExerciseController } from '../controllers/exercise.controller';
import { PlanningController } from '../controllers/planning.controller';
import { ProfileController } from '../controllers/profile.controller';
import { SameOriginGuard } from './same-origin.guard';

type Handler = (...args: never[]) => unknown;

// Server-to-server: authenticated by a shared secret, carries no cookie.
const SERVER_TO_SERVER = new Set(['AuthController.disconnect']);

const controllers = [
  AnalysisController,
  AuthController,
  ExecutionController,
  ExerciseController,
  PlanningController,
  ProfileController,
];

function guardsOf(target: object): unknown[] {
  return (Reflect.getMetadata(GUARDS_METADATA, target) as unknown[]) ?? [];
}

describe('SameOriginGuard coverage', () => {
  const mutatingRoutes = controllers.flatMap((controller) =>
    Object.getOwnPropertyNames(controller.prototype)
      .filter((name) => name !== 'constructor')
      .map((name) => ({
        id: `${controller.name}.${name}`,
        controller,
        handler: controller.prototype[
          name as keyof typeof controller.prototype
        ] as Handler,
      }))
      .filter(({ handler }) => {
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as
          | RequestMethod
          | undefined;
        return (
          method !== undefined &&
          method !== RequestMethod.GET &&
          method !== RequestMethod.OPTIONS &&
          method !== RequestMethod.HEAD
        );
      }),
  );

  it('finds the mutating routes', () => {
    expect(mutatingRoutes.length).toBeGreaterThan(10);
    for (const { handler } of mutatingRoutes) {
      expect(Reflect.hasMetadata(PATH_METADATA, handler)).toBe(true);
    }
  });

  it.each(mutatingRoutes.map((route) => [route.id, route] as const))(
    '%s is behind SameOriginGuard unless server-to-server',
    (id, { controller, handler }) => {
      const guarded =
        guardsOf(controller).includes(SameOriginGuard) ||
        guardsOf(handler).includes(SameOriginGuard);
      expect(guarded).toBe(!SERVER_TO_SERVER.has(id));
    },
  );
});
