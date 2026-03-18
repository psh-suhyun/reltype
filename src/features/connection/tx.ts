import { PoolClient } from 'pg';
import { Logger } from '../../utils/logger';
import { DbError } from '../../utils/dbError';
import { withClient } from './pool';

const logger = Logger.fromEnv(
  process.env as Record<string, string | undefined>,
  { prefix: '[Tx]' },
);

/**
 * 트랜잭션 내에서 콜백을 실행합니다.
 *
 * - 성공 시 COMMIT, 실패 시 ROLLBACK됩니다.
 * - ROLLBACK 실패 시에도 원래 에러가 전파됩니다.
 * - 모든 에러는 DbError로 변환됩니다.
 */
export async function runInTx<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return withClient(async (client) => {
    await client.query('BEGIN');
    logger.debug('트랜잭션 시작');

    try {
      const result = await fn(client);
      await client.query('COMMIT');
      logger.debug('트랜잭션 커밋');
      return result;
    } catch (err) {
      const dbErr = DbError.from(err);

      try {
        await client.query('ROLLBACK');
        logger.warn('트랜잭션 롤백', dbErr.toLogContext());
      } catch (rollbackErr) {
        logger.error('롤백 실패', DbError.from(rollbackErr).toLogContext());
      }

      throw dbErr;
    }
  });
}
