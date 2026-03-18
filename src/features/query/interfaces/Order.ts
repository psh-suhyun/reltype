export type OrderDir = 'ASC' | 'DESC';

export interface OrderByInput<T> {
  col: keyof T;
  dir?: OrderDir;
}
