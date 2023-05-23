import { AnyIdentity, Query, QueryBuilder } from '@akdasa-studios/framework'
import { SyncAggregate } from '@lib/SyncAggregate'


/**
 * Query that selects all entities that have been synced after the given timestamp.
 * @param from Timestamp to select entities from.
 * @returns A query.
 */
export function syncedAfter(
  from: number,
): Query<SyncAggregate<AnyIdentity>> {
  const queryBuilder = new QueryBuilder<SyncAggregate<AnyIdentity>>()
  return queryBuilder.or(
    queryBuilder.or(
      queryBuilder.eq('syncedAt', undefined),
      queryBuilder.eq('syncedAt', 0),
    ),
    queryBuilder.gt('syncedAt', from),
  )
}
