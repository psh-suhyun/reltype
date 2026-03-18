import { keysToCamel } from './case';

/**
 * DB raw row를 camelCase TypeScript 객체로 변환합니다.
 */
export function mapRow<T>(raw: Record<string, unknown>): T {
  return keysToCamel(raw) as T;
}

/**
 * DB raw rows 배열을 camelCase TypeScript 객체 배열로 변환합니다.
 */
export function mapRows<T>(raws: Record<string, unknown>[]): T[] {
  return raws.map((r) => mapRow<T>(r));
}
