import { TableDef, Cols } from '../schema/interfaces/Table';
import { BaseRepo } from './base';

/**
 * TableDef로부터 BaseRepo 인스턴스를 생성합니다.
 *
 * @example
 * ```ts
 * const userRepo = createRepo(usersTable);
 * const users = await userRepo.findAll();
 * ```
 */
export function createRepo<TDef extends TableDef<string, Cols>>(
  def: TDef,
): BaseRepo<TDef> {
  return new BaseRepo(def);
}
