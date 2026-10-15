import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
export type AuthRequest = Request & { user: { id: string }; requestId: string };
export const Public = () => SetMetadata('public', true);
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride('public', [context.getHandler(), context.getClass()]))
      return true;
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new UnauthorizedException('Authentication required');
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; type: string }>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
        algorithms: ['HS256'],
        issuer: 'growthos',
        audience: 'growthos-web',
      });
      if (payload.type !== 'access') throw new Error();
      req.user = { id: payload.sub };
      return true;
    } catch {
      throw new UnauthorizedException('Authentication required');
    }
  }
}
