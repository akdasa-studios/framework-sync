import { Aggregate, AnyIdentity } from '@akdasa-studios/framework'


export interface Syncable {
  /**
   * Version of the aggregate.
   */
  version: string

  /**
   * Timestamp of the last modification.
   */
  modifiedAt: number
}

/**
 * An aggregate that can be synced. It has a version and a timestamp of the last sync.
 * @typeparam TIdentity Type of the identity.
 */
export type SyncAggregate<TIdentity extends AnyIdentity> = Aggregate<TIdentity> & Syncable
