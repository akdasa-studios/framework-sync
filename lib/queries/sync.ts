import { AnyIdentity, Query, QueryBuilder } from '@akdasa-studios/framework'
import { SyncAggregate } from '@lib/SyncAggregate'


/**
 * Get all entities that have been synced in the given period. Edges are not included.
 * Includes entities that have not been synced yet.
 * @param from Timestamp of the start of the period.
 * @param to Timestamp of the end of the period.
 * @returns A query that selects all entities that have been synced in the given period.
 */
export function syncedDuring(
  from: number,
  to: number
): Query<SyncAggregate<AnyIdentity>> {
  const queryBuilder = new QueryBuilder<SyncAggregate<AnyIdentity>>()
  return queryBuilder.and(
    queryBuilder.or(
      queryBuilder.gt('syncedAt', from),
      queryBuilder.eq('syncedAt', undefined),
      queryBuilder.eq('syncedAt', 0),
    ),
    queryBuilder.or(
      queryBuilder.lt('syncedAt', to),
      queryBuilder.eq('syncedAt', undefined),
      queryBuilder.eq('syncedAt', 0),
    )
  )
}
