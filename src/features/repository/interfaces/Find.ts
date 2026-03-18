import { WhereInput } from '../../query/interfaces/Where';
import { OrderByInput } from '../../query/interfaces/Order';

export interface FindOpts<T extends Record<string, unknown>> {
  where?: WhereInput<T>;
  orderBy?: OrderByInput<T>[];
  limit?: number;
  offset?: number;
}
