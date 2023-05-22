import { AnyIdentity } from '@akdasa-studios/framework'
import { SyncAggregate } from '@lib/SyncAggregate'
import { SyncRepository } from '@lib/SyncRepository'
import { SyncConflictSolver } from '@lib/SyncConflictSolver'
import { syncedDuring } from '@lib/queries/sync'


export interface SyncResult {
  entitiesChecked: number
  syncedAt: number
}

export interface ReplicationResult {
  entitiesChecked: number
}

export interface SyncOptions {
  lastSyncTime: number
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


  async sync(
    repo1: SyncRepository<TAggregate>,
    repo2: SyncRepository<TAggregate>,
    options?: SyncOptions
  ): Promise<SyncResult> {
    const o = {
      currentTime:  options?.currentTime  || new Date().getTime(),
      lastSyncTime: options?.lastSyncTime || 0,
    }

    const one = await this.replicate(repo1, repo2, o)
    const two = await this.replicate(repo2, repo1, o)

    return {
      entitiesChecked: one.entitiesChecked + two.entitiesChecked,
      syncedAt: o.currentTime,
    }
  }

  async replicate(
    source: SyncRepository<TAggregate>,
    target: SyncRepository<TAggregate>,
    options: SyncOptions
  ): Promise<ReplicationResult> {
    // Stryker disable next-line all
    const syncOptions = { updateVersion: false, syncedAt: options.currentTime }
    const q = syncedDuring(options.lastSyncTime, options.currentTime)
    const result: ReplicationResult = { entitiesChecked: 0 }

    // @ts-ignore
    const entitiesToSync = await source.find(q)

    for (const sourceEntity of entitiesToSync) {
      result.entitiesChecked++

      let targetEntity: TAggregate|undefined = undefined
      try { targetEntity = await target.get(sourceEntity.id) } catch { /** pass */}
      if (!targetEntity) {
        await target.save(sourceEntity, syncOptions)
      } else {
        if (sourceEntity.version !== targetEntity.version) {
          const winner = this.conflictSolver.solve(sourceEntity, targetEntity)
          if (winner === sourceEntity) {
            await target.save(sourceEntity, syncOptions)
          } else {
            await source.save(targetEntity, syncOptions)
          }
        }
      }
    }
    return result
  }
}
