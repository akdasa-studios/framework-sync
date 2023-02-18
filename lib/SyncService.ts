import { Aggregate, AnyIdentity } from '@akdasa-studios/framework'
import { HasVersion, SyncRepository } from '@lib/SyncRepository'


export interface ConflictSolver<TEntity extends Aggregate<AnyIdentity>> {
  solve(
    object1: TEntity,
    object2: TEntity,
  ): Aggregate<AnyIdentity>
}

export class SyncService<
  TEntity extends Aggregate<AnyIdentity> & HasVersion
> {
  constructor(
    private readonly conflictSolver: ConflictSolver<TEntity>
  ) {}

  async sync(
    repo1: SyncRepository<TEntity>,
    repo2: SyncRepository<TEntity>
  ) {
    // console.log('sync [-->]', replicated)
    await this.replicate(repo1, repo2)
    // console.log('sync [<--]', replicated)
    await this.replicate(repo2, repo1)
  }

  async replicate(
    source: SyncRepository<TEntity>,
    target: SyncRepository<TEntity>,
  ) {
    // TODO: get only changes entities
    // Stryker disable next-line all
    const syncOptions = { updateVersion: false }
    const entitiesToSync = (await source.all()).value

    for (const sourceEntity of entitiesToSync) {
      const targetEntity = await target.get(sourceEntity.id)
      if (targetEntity.isFailure) {
        target.save(sourceEntity, syncOptions)
      } else {
        if (sourceEntity.version !== targetEntity.value.version) {
          const winner = this.conflictSolver.solve(sourceEntity, targetEntity.value)
          if (winner === sourceEntity) {
            await target.save(sourceEntity, syncOptions)
          } else {
            await source.save(targetEntity.value, syncOptions)
          }
        }
      }
    }
  }
}
