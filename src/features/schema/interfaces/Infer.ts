import { TableDef, Cols } from './Table';

/** SELECT 결과 타입: 모든 컬럼 포함 */
export type InferRow<TDef extends TableDef<string, Cols>> = {
  [K in keyof TDef['cols']]: TDef['cols'][K]['_type'];
};

/**
 * INSERT 입력 타입:
 * - _isOpt = false → required
 * - _isOpt = true  → optional
 */
export type InferInsert<TDef extends TableDef<string, Cols>> =
  { [K in keyof TDef['cols'] as TDef['cols'][K]['_isOpt'] extends true ? never : K]: TDef['cols'][K]['_type'] } &
  { [K in keyof TDef['cols'] as TDef['cols'][K]['_isOpt'] extends true ? K : never]?: TDef['cols'][K]['_type'] };

/**
 * UPDATE 입력 타입: primary key 제외, 모두 optional.
 *
 * 빈 객체(`{}`) 방지는 `buildUpdate`의 런타임 가드가 담당합니다.
 *
 * @example
 * const update: InferUpdate<typeof usersTable> = { name: 'Alice' };
 */
export type InferUpdate<TDef extends TableDef<string, Cols>> = {
  [K in keyof TDef['cols'] as TDef['cols'][K]['_isPrimary'] extends true ? never : K]?: TDef['cols'][K]['_type'];
};
