import {
  Body,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module.js';
import { CategoryDto, CategoryQuery, UpdateCategoryDto } from '../common/dto.js';
import type { AuthRequest } from '../common/auth.guard.js';
export const slug = (name: string) =>
  name
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '') || 'category';
@Controller('categories')
export class CategoriesController {
  constructor(private readonly db: PrismaService) {}
  @Get() list(@Req() req: AuthRequest, @Query() q: CategoryQuery) {
    return this.db.category.findMany({
      where: {
        userId: req.user.id,
        ...(q.includeArchived === 'true' ? {} : { isArchived: false }),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }
  @Post() create(@Req() req: AuthRequest, @Body() dto: CategoryDto) {
    return this.db.category.create({ data: { ...dto, userId: req.user.id, slug: slug(dto.name) } });
  }
  @Patch(':id') async update(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    const result = await this.db.category.updateMany({
      where: { id, userId: req.user.id },
      data: { ...dto, ...(dto.name ? { slug: slug(dto.name) } : {}) },
    });
    if (!result.count) throw new NotFoundException('Category not found');
    return this.db.category.findFirstOrThrow({ where: { id, userId: req.user.id } });
  }
}
@Module({ controllers: [CategoriesController] })
export class CategoriesModule {}
