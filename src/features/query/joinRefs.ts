import { TableDef, Cols } from '../schema/interfaces/Table';
import { toSnake } from '../transform/case';
import { quoteIdentifier } from '../../utils/sqlGuard';

/**
 * `JOIN` 의 `table` 인자나 `schema.table.column` 접두로 쓰는 **따옴표 없는** 참조 문자열.
 *
 * @example
 * ```ts
 * defineTable('account.users', cols) → `account.users`
 * defineTable('users', cols, { schema: 'public' }) → `public.users`
 * ```
 */
export function sqlTableRef(def: TableDef<string, Cols>): string {
  return def.schema ? `${def.schema}.${def.name}` : def.name;
}

/**
 * SELECT 목록용 조각: `schema.table.*` 또는 `schema.table.col_snake` 배열.
 * 컬럼 키는 **테이블 정의의 camelCase 프로퍼티명**을 넘기면 snake_case 로 변환됩니다.
 *
 * @example
 * ```ts
 * .columns([
 *   ...sqlCols(usersTable, '*'),
 *   ...sqlCols(profileTable, ['image', 'userName']),
 * ])
 * ```
 */
export function sqlCols<T extends TableDef<string, Cols>>(
  def: T,
  cols: '*' | ReadonlyArray<keyof T['cols'] & string>,
): string[] {
  const t = sqlTableRef(def);
  if (cols === '*') return [`${t}.*`];
  return cols.map((c) => `${t}.${toSnake(String(c))}`);
}

/**
 * SELECT 목록용: `schema.table.col AS alias_snake` (별칭은 DB snake_case 권장 → mapRows 가 camelCase 로 변환).
 *
 * @example
 * ```ts
 * sqlColsAs(profileTable, [
 *   ['id', 'profile_id'],
 *   ['createdAt', 'profile_created_at'],
 * ])
 * ```
 */
export function sqlColsAs<T extends TableDef<string, Cols>>(
  def: T,
  pairs: ReadonlyArray<readonly [keyof T['cols'] & string, string]>,
): string[] {
  const t = sqlTableRef(def);
  return pairs.map(([col, aliasSnake]) => `${t}.${toSnake(String(col))} as ${aliasSnake}`);
}

/**
 * `JOIN ... ON` 절 한 쌍 (등호). `TableDef.qualifiedName` 과 컬럼 `quoteIdentifier` 를 사용합니다.
 *
 * @example
 * ```ts
 * .join({
 *   type: 'LEFT',
 *   table: sqlTableRef(profileTable),
 *   on: joinOnEq(usersTable, 'id', profileTable, 'userId'),
 * })
 * ```
 */
export function joinOnEq(
  left: TableDef<string, Cols>,
  leftCol: string,
  right: TableDef<string, Cols>,
  rightCol: string,
): string {
  const lc = quoteIdentifier(toSnake(leftCol));
  const rc = quoteIdentifier(toSnake(rightCol));
  return `${left.qualifiedName}.${lc} = ${right.qualifiedName}.${rc}`;
}

/**
 * `ORDER BY` 등에 넣을 **한정 컬럼** 문자열 (`schema.table.column`).
 * `orderBy([{ column: orderCol(usersTable, 'id'), direction: 'DESC' }])`
 */
export function orderCol<T extends TableDef<string, Cols>>(
  def: T,
  col: keyof T['cols'] & string,
): string {
  return `${sqlTableRef(def)}.${toSnake(String(col))}`;
}
