import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, isNull, or, SQL } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { categories } from '../../database/schema';
import {
  CreateCategoryDto,
  ListCategoriesQuery,
  UpdateCategoryDto,
} from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /** System categories (userId is null) plus the user's own. */
  list(userId: string, query: ListCategoriesQuery) {
    const ownership = or(
      isNull(categories.userId),
      eq(categories.userId, userId),
    );
    const where: SQL | undefined = query.type
      ? and(ownership, eq(categories.type, query.type))
      : ownership;
    return this.db.select().from(categories).where(where);
  }

  async create(userId: string, dto: CreateCategoryDto) {
    const [row] = await this.db
      .insert(categories)
      .values({ ...dto, userId, isSystem: false })
      .returning();
    return row;
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto) {
    const existing = await this.findOwned(userId, id);
    if (existing.isSystem) {
      throw new ForbiddenException('System categories cannot be modified');
    }
    const [row] = await this.db
      .update(categories)
      .set(dto)
      .where(eq(categories.id, id))
      .returning();
    return row;
  }

  async remove(userId: string, id: string) {
    const existing = await this.findOwned(userId, id);
    if (existing.isSystem) {
      throw new ForbiddenException('System categories cannot be deleted');
    }
    await this.db.delete(categories).where(eq(categories.id, id));
    return { success: true };
  }

  private async findOwned(userId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(categories)
      .where(eq(categories.id, id));
    if (!row) throw new NotFoundException('Category not found');
    if (row.userId && row.userId !== userId) {
      throw new NotFoundException('Category not found');
    }
    return row;
  }
}
