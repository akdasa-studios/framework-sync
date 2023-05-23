import { AnyIdentity, Query, Logger, Logs, LogTransport, LogRecord } from '@akdasa-studios/framework'
import { SyncAggregate } from '@lib/SyncAggregate'
import { SyncRepository } from '@lib/SyncRepository'
import { SyncConflictSolver } from '@lib/SyncConflictSolver'
import { syncedAfter } from '@lib/queries/sync'

/**
 * The result of a synchronization.
 */
export interface SyncResult {
  // Number of aggregates synchronized.
  aggregatesSynced: number

  // Time when the synchronization was completed.
  completedAt: number
}

/**
 * The result of a replication.
 */
export type ReplicationResult = Pick<SyncResult, 'aggregatesSynced'>

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
  private logger = new Logger('sync::service')

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
    this.logger.startGroup('Syncronizing repositories')

    // Get default options
    const o = {
      currentTime:  options?.currentTime  || new Date().getTime(),
      lastSyncTime: options?.lastSyncTime || 0,
    }
    this.logger.debug(`Last sync time time: ${o.lastSyncTime}`)
    this.logger.debug(`Current time: ${o.currentTime}`)

    // Replicate A -> B
    this.logger.startGroup('Replicationg A -> B')
    const one = await this.replicate(repo1, repo2, o)
    this.logger.endGroup()

    // Replicate B -> A
    this.logger.startGroup('Replicationg B -> A')
    const two = await this.replicate(repo2, repo1, o)
    this.logger.endGroup()

    // Replication complete
    this.logger.endGroup()
    return {
      aggregatesSynced:  one.aggregatesSynced + two.aggregatesSynced,
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
    const repResult: ReplicationResult = { aggregatesSynced: 0 }
    const repOptions = { updateVersion: false, syncedAt: options.currentTime }

    const limit = 25
    let lastSkip = 0
    let continueFetching = true

    while (continueFetching) {
      this.logger.startGroup(`Batch ${lastSkip + 1} - ${lastSkip + limit}`)

      // Get all entities that were synced after the last sync time
      const findResult = await source.find(
        syncedAfter(options.lastSyncTime) as Query<TAggregate>,
        { skip: lastSkip, limit }
      )
      continueFetching = findResult.entities.length >= limit
      lastSkip += findResult.slice.count

      for (const sourceEntity of findResult.entities) {
        let targetEntity: TAggregate|undefined = undefined
        try { targetEntity = await target.get(sourceEntity.id) } catch { /** pass */}
        if (!targetEntity) {
          this.logger.debug(`${sourceEntity.id.value}: no at target`)
          repResult.aggregatesSynced++
          await target.save(this.makeCopy(sourceEntity), repOptions)
          await source.save(sourceEntity, repOptions)
        } else {
          if (sourceEntity.version !== targetEntity.version) {
            repResult.aggregatesSynced++
            const winner = this.conflictSolver.solve(sourceEntity, targetEntity)
            if (winner === sourceEntity) {
              this.logger.debug(`${sourceEntity.id}: source won`)
              await target.save(this.makeCopy(sourceEntity), repOptions)
              await source.save(sourceEntity, repOptions)
            } else {
              this.logger.debug(`${sourceEntity.id}: target won`)
              await source.save(this.makeCopy(targetEntity), repOptions)
              await target.save(targetEntity, repOptions)
            }
          }
        }
      }

      console.groupEnd()
    }
    return repResult
  }

  private makeCopy(entity: TAggregate): TAggregate {
    const copy = Object.create(entity)
    Object.assign(copy, entity)
    return copy
  }

}
