import { AnyIdentity } from '@akdasa-studios/framework'
import { SyncAggregate } from '@lib/SyncAggregate'


/**
 * A conflict solver is used to solve conflicts between two aggregates during syncrionization.
 */
export interface SyncConflictSolver<TAggergate extends SyncAggregate<AnyIdentity>> {
  /**
   * Solve a conflict between two aggregates.
   * @param object1 First aggregate to compare.
   * @param object2 Second aggregate to compare.
   * @returns The aggregate that should be used.
   */
  solve(
    object1: TAggergate,
    object2: TAggergate,
  ): SyncAggregate<AnyIdentity>
}