import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface CurrentUserPayload {
  id: string;
  email: string;
  name: string;
}

interface AuthenticatedRequest extends Request {
  user?: CurrentUserPayload;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw new Error('User not attached to request');
    return request.user;
  },
);
