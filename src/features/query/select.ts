import { toSnake } from '../transform/case';
import { quoteIdentifier, validateOrderDir } from '../../utils/sqlGuard';
import { buildWhere } from './where';
import { BuiltQuery } from './interfaces/Query';
import { WhereInput } from './interfaces/Where';
import { OrderByInput } from './interfaces/Order';

export interface SelectOpts<T extends Record<string, unknown>> {
  where?: WhereInput<T>;
  orderBy?: OrderByInput<T>[];
  limit?: number;
  offset?: number;
}

/**
 * SELECT 쿼리를 생성합니다.
 * camelCase → snake_case 자동 변환 및 `quoteIdentifier` 검증이 적용됩니다.
 */
export function buildSelect<T extends Record<string, unknown>>(
  table: string,
  opts: SelectOpts<T> = {},
): BuiltQuery {
  const parts: string[] = [`SELECT * FROM ${table}`];
  const params: unknown[] = [];

  if (opts.where && Object.keys(opts.where).length > 0) {
    const { sql: w, params: wp } = buildWhere(opts.where, params.length + 1);
    if (w) {
      parts.push(w);
      params.push(...wp);
    }
  }

  if (opts.orderBy && opts.orderBy.length > 0) {
    const clauses = opts.orderBy.map(({ col, dir }) => {
      const safeCol = quoteIdentifier(toSnake(String(col)));
      const safeDir = validateOrderDir(dir ?? 'ASC');
      return `${safeCol} ${safeDir}`;
    });
    parts.push(`ORDER BY ${clauses.join(', ')}`);
  }

  if (opts.limit !== undefined) {
    params.push(opts.limit);
    parts.push(`LIMIT $${params.length}`);
  }

  if (opts.offset !== undefined) {
    params.push(opts.offset);
    parts.push(`OFFSET $${params.length}`);
  }

  return { sql: parts.join(' '), params };
}
