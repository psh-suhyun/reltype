import { TableDef, Cols } from './interfaces/Table';
import { escapeSchemaIdentifier } from '../../utils/sqlGuard';

export interface TableOpts {
  /**
   * PostgreSQL 스키마 이름.
   * 지정하면 쿼리에서 `"schema"."table"` 형태로 사용됩니다.
   *
   * @example { schema: 'auth' }
   */
  schema?: string;
}

/**
 * PostgreSQL 테이블 정의를 생성합니다.
 *
 * ## 사용 방법 (세 가지 모두 동일하게 동작합니다)
 *
 * ### 1. 스키마 없이 테이블만 정의
 * ```ts
 * const usersTable = defineTable('users', {
 *   id:   col.serial().primaryKey(),
 *   name: col.varchar(255).notNull(),
 * });
 * // qualifiedName → "users"
 * ```
 *
 * ### 2. options 객체로 스키마 지정
 * ```ts
 * const usersTable = defineTable('users', {
 *   id:   col.serial().primaryKey(),
 *   name: col.varchar(255).notNull(),
 * }, { schema: 'auth' });
 * // qualifiedName → "auth"."users"
 * ```
 *
 * ### 3. 도트(.) 표기법으로 스키마.테이블 직접 지정
 * ```ts
 * const usersTable = defineTable('auth.users', {
 *   id:   col.serial().primaryKey(),
 *   name: col.varchar(255).notNull(),
 * });
 * // qualifiedName → "auth"."users"
 * ```
 */
export function defineTable<TName extends string, TCols extends Cols>(
  nameOrQualified: TName,
  cols: TCols,
  opts?: TableOpts,
): TableDef<string, TCols> {
  // 도트 표기법 파싱: "schema.table" → { schema, name }
  const dotIdx = nameOrQualified.indexOf('.');
  let resolvedSchema: string | undefined;
  let resolvedName: string;

  if (dotIdx !== -1) {
    resolvedSchema = nameOrQualified.slice(0, dotIdx);
    resolvedName   = nameOrQualified.slice(dotIdx + 1);
  } else {
    resolvedName   = nameOrQualified;
    resolvedSchema = opts?.schema;
  }

  // 쌍따옴표로 식별자 이스케이프 (예약어·대소문자 안전)
  // 내부의 " 문자는 "" 로 이중 이스케이프합니다 (PostgreSQL 표준).
  const qualifiedName = resolvedSchema
    ? `${escapeSchemaIdentifier(resolvedSchema)}.${escapeSchemaIdentifier(resolvedName)}`
    : escapeSchemaIdentifier(resolvedName);

  return {
    name:          resolvedName,
    schema:        resolvedSchema,
    qualifiedName,
    cols,
  };
}
