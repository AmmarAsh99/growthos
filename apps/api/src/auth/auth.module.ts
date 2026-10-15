import {
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Module,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { randomUUID, createHash } from 'node:crypto';
import * as argon2 from 'argon2';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.module.js';
import { LoginDto, RegisterDto } from '../common/dto.js';
import { Public, type AuthRequest } from '../common/auth.guard.js';
import { logger } from '../telemetry/logging.js';
export const safeUser = { id: true, email: true, displayName: true, settings: true } as const;
export const defaults = [
  'DevOps & Cloud',
  'Programming',
  'Reading',
  'Fitness',
  'Career',
  'Personal',
].map((name, i) => ({
  name,
  slug: ['devops-cloud', 'programming', 'reading', 'fitness', 'career', 'personal'][i]!,
  color: ['#8B5CF6', '#22D3EE', '#FBBF24', '#34D399', '#FB7185', '#A78BFA'][i]!,
  icon: ['cloud', 'code', 'book', 'fitness', 'briefcase', 'star'][i]!,
  sortOrder: i,
}));
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === 'true',
  sameSite: 'lax' as const,
  path: '/api/v1/auth',
  maxAge: 7 * 86400000,
});
@Injectable()
export class AuthService {
  constructor(
    private readonly db: PrismaService,
    private readonly jwt: JwtService,
  ) {}
  private async tokens(userId: string) {
    const id = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, jti: id, type: 'refresh' },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
        issuer: 'growthos',
        audience: 'growthos-refresh',
      },
    );
    const accessToken = await this.jwt.signAsync(
      { sub: userId, type: 'access' },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '15m',
        issuer: 'growthos',
        audience: 'growthos-web',
      },
    );
    return {
      accessToken,
      refreshToken,
      session: {
        id,
        userId,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    };
  }
  async register(dto: RegisterDto) {
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const id = randomUUID();
    const tokens = await this.tokens(id);
    const user = await this.db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          id,
          email: dto.email,
          displayName: dto.displayName,
          passwordHash,
          settings: { create: {} },
          categories: { create: defaults },
        },
        select: safeUser,
      });
      await tx.refreshSession.create({ data: tokens.session });
      return user;
    });
    logger.info({ event: 'auth.register.succeeded', userId: id });
    return { ...tokens, user };
  }
  async login(dto: LoginDto) {
    const user = await this.db.user.findUnique({ where: { email: dto.email } });
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      logger.info({ event: 'auth.login.failed' });
      throw new UnauthorizedException('Invalid email or password');
    }
    const tokens = await this.tokens(user.id);
    await this.db.refreshSession.create({ data: tokens.session });
    logger.info({ event: 'auth.login.succeeded', userId: user.id });
    return {
      ...tokens,
      user: await this.db.user.findUniqueOrThrow({ where: { id: user.id }, select: safeUser }),
    };
  }
  async refresh(token?: string) {
    try {
      if (!token) throw new Error();
      const payload = await this.jwt.verifyAsync<{ sub: string; jti: string; type: string }>(
        token,
        {
          secret: process.env.JWT_REFRESH_SECRET,
          algorithms: ['HS256'],
          issuer: 'growthos',
          audience: 'growthos-refresh',
        },
      );
      if (payload.type !== 'refresh') throw new Error();
      const tokens = await this.tokens(payload.sub);
      await this.db.$transaction(async (tx) => {
        const changed = await tx.refreshSession.updateMany({
          where: {
            id: payload.jti,
            userId: payload.sub,
            refreshTokenHash: hashToken(token),
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { revokedAt: new Date() },
        });
        if (changed.count !== 1) throw new UnauthorizedException('Session expired');
        await tx.refreshSession.create({ data: tokens.session });
        await tx.refreshSession.deleteMany({
          where: { userId: payload.sub, expiresAt: { lt: new Date() } },
        });
      });
      return {
        ...tokens,
        user: await this.db.user.findUniqueOrThrow({
          where: { id: payload.sub },
          select: safeUser,
        }),
      };
    } catch {
      logger.info({ event: 'auth.refresh.failed' });
      throw new UnauthorizedException('Session expired');
    }
  }
  async logout(token?: string) {
    if (token)
      await this.db.refreshSession.updateMany({
        where: { refreshTokenHash: hashToken(token), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    logger.info({ event: 'auth.logout' });
  }
}
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly db: PrismaService,
  ) {}
  private respond(result: Awaited<ReturnType<AuthService['login']>>, res: Response) {
    res.cookie('growthos_refresh', result.refreshToken, cookieOptions());
    return { user: result.user, accessToken: result.accessToken };
  }
  @Public() @Throttle({ default: { limit: 10, ttl: 60000 } }) @Post('register') async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(await this.auth.register(dto), res);
  }
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.respond(await this.auth.login(dto), res);
  }
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) {
    return this.respond(await this.auth.refresh(req.cookies?.growthos_refresh), res);
  }
  @Public() @Post('logout') @HttpCode(200) async logout(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(req.cookies?.growthos_refresh);
    res.clearCookie('growthos_refresh', cookieOptions());
    return { loggedOut: true };
  }
  @Get('me') me(@Req() req: AuthRequest) {
    return this.db.user.findUniqueOrThrow({ where: { id: req.user.id }, select: safeUser });
  }
}
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [JwtModule],
})
export class AuthModule {}
