import { FindOpts } from './Find';
import { QueryBuilder } from '../../query/builder';
import { AdvancedWhere, ExecHooks } from '../../query/interfaces/Advanced';

/**
 * 기본 CRUD + 확장 레포지토리 인터페이스.
 *
 * @typeParam TRow    - SELECT 결과 타입
 * @typeParam TInsert - INSERT 입력 타입
 * @typeParam TUpdate - UPDATE 입력 타입
 */
export interface IRepo<
  TRow extends Record<string, unknown>,
  TInsert = Partial<TRow>,
  TUpdate = Partial<TRow>,
> {
  // ── 정적 CRUD ────────────────────────────────────────────────────────────
  findAll(opts?: FindOpts<TRow>): Promise<TRow[]>;
  findById(id: number | string): Promise<TRow | null>;
  findOne(where: Partial<TRow>): Promise<TRow | null>;
  create(data: TInsert): Promise<TRow>;
  update(id: number | string, data: TUpdate): Promise<TRow | null>;
  delete(id: number | string): Promise<boolean>;
  upsert(data: TInsert, conflictCol?: string): Promise<TRow>;
  bulkCreate(rows: TInsert[]): Promise<TRow[]>;

  // ── 플루언트 빌더 ────────────────────────────────────────────────────────
  /** 유연한 쿼리 빌더 반환 (WHERE / OR / JOIN / GROUP BY / paginate / calculate 지원) */
  select(where?: AdvancedWhere<TRow>): QueryBuilder<TRow>;
  /** 단건 조회 (없으면 null) */
  selectOne(where: AdvancedWhere<TRow>): Promise<TRow | null>;
  /** Raw SQL 실행 (camelCase 변환 자동 적용) */
  raw<R extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<R[]>;
  /** 이 레포지토리의 모든 select() 빌더에 적용될 글로벌 훅 등록 */
  useHooks(h: ExecHooks<TRow>): this;
}
