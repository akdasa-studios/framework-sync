import { AnyIdentity, Query } from '@akdasa-studios/framework'
import { SyncAggregate } from '@lib/SyncAggregate'
import { SyncRepository } from '@lib/SyncRepository'
import { SyncConflictSolver } from '@lib/SyncConflictSolver'
import { syncedDuring } from '@lib/queries/sync'


/**
 * The result of a synchronization.
 */
export interface SyncResult {
  // Number of aggregates checked for synchronization.
  aggregatesChecked: number

  // Number of aggregates synchronized.
  aggregatesSynced: number

  // Time when the synchronization was completed.
  completedAt: number
}

/**
 * The result of a replication.
 */
export type ReplicationResult = Pick<SyncResult, 'aggregatesChecked' | 'aggregatesSynced'>

/**
 * Options for synchronization.
 */
export interface SyncOptions {
  // The time of the last synchronization.
  lastSyncTime: number

  // Current time
  currentTime: number
}

/**
 * A service to synchronize two repositories.
 * @param TAggregate The type of the aggregate to synchronize.
 */
export class SyncService<
  TAggregate extends SyncAggregate<AnyIdentity>
> {
  /**
   * Initialazes a new instance of the SyncService class.
   * @param conflictSolver The conflict solver to use.
   */
  constructor(
    private readonly conflictSolver: SyncConflictSolver<TAggregate>
  ) {}

  /**
   * Synchronizes two repositories.
   * @param repo1 The first repository.
   * @param repo2 The second repository.
   * @param options The options for synchronization.
   * @returns The result of the synchronization.
   */
  async sync(
    repo1: SyncRepository<TAggregate>,
    repo2: SyncRepository<TAggregate>,
    options?: SyncOptions
  ): Promise<SyncResult> {
    // Get default options
    const o = {
      currentTime:  options?.currentTime  || new Date().getTime(),
      lastSyncTime: options?.lastSyncTime || 0,
    }

    // Replicate repositories in both directions
    const one = await this.replicate(repo1, repo2, o)
    const two = await this.replicate(repo2, repo1, o)

    return {
      aggregatesChecked: one.aggregatesChecked + two.aggregatesChecked,
      aggregatesSynced:  one.aggregatesSynced  + two.aggregatesSynced,
      completedAt: o.currentTime,
    }
  }

  /**
   * Replicates the source repository to the target repository.
   * @param source Source repository
   * @param target Target repository
   * @param options The options for synchronization.
   * @returns The result of the replication.
   */
  async replicate(
    source: SyncRepository<TAggregate>,
    target: SyncRepository<TAggregate>,
    options: SyncOptions
  ): Promise<ReplicationResult> {
    const repResult: ReplicationResult = { aggregatesChecked: 0, aggregatesSynced: 0 }
    const repOptions = { updateVersion: false, syncedAt: options.currentTime }
    const entitiesToSync = await source.find(
      syncedDuring(options.lastSyncTime, options.currentTime) as Query<TAggregate>
    )

    for (const sourceEntity of entitiesToSync) {
      repResult.aggregatesChecked++

      let targetEntity: TAggregate|undefined = undefined
      try { targetEntity = await target.get(sourceEntity.id) } catch { /** pass */}
      if (!targetEntity) {
        repResult.aggregatesSynced++
        await target.save(this.makeCopy(sourceEntity), repOptions)
        await source.save(sourceEntity, repOptions)
      } else {
        if (sourceEntity.version !== targetEntity.version) {
          repResult.aggregatesSynced++
          const winner = this.conflictSolver.solve(sourceEntity, targetEntity)
          if (winner === sourceEntity) {
            await target.save(this.makeCopy(sourceEntity), repOptions)
            await source.save(sourceEntity, repOptions)
          } else {
            await source.save(this.makeCopy(targetEntity), repOptions)
            await target.save(targetEntity, repOptions)
          }
        }
      }
    }
    return repResult
  }

  private makeCopy(entity: TAggregate): TAggregate {
    const copy = Object.create(entity)
    Object.assign(copy, entity)
    return copy
  }

}
