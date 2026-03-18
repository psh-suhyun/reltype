import { toSnake } from '../transform/case';
import { BuiltQuery } from './interfaces/Query';
import { WhereInput } from './interfaces/Where';

/**
 * WhereInput 객체로부터 WHERE 절 SQL과 params를 생성합니다.
 * camelCase key → snake_case 컬럼명으로 자동 변환됩니다.
 *
 * @param where     - camelCase key 기반 조건 객체
 * @param startIdx  - param placeholder 시작 번호 ($1, $2 ...)
 */
export function buildWhere<T extends Record<string, unknown>>(
  where: WhereInput<T>,
  startIdx: number = 1,
): BuiltQuery {
  const entries = Object.entries(where).filter(([, v]) => v !== undefined);

  if (entries.length === 0) {
    return { sql: '', params: [] };
  }

  const params: unknown[] = [];
  const conditions: string[] = [];

  for (const [key, val] of entries) {
    const col = toSnake(key);
    if (val === null) {
      conditions.push(`${col} IS NULL`);
    } else {
      conditions.push(`${col} = $${startIdx + params.length}`);
      params.push(val);
    }
  }

  return { sql: `WHERE ${conditions.join(' AND ')}`, params };
}
