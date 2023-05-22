import { Repository, AnyIdentity, Query } from '@akdasa-studios/framework'
import { SyncAggregate } from './SyncAggregate'



export interface SaveOptions {
  updateVersion: boolean
  versionGenerator: VersionGenerator
  version?: string
  syncedAt: number
}

export type VersionGenerator = (aggregate: SyncAggregate<AnyIdentity>) => string

const DEFAULT_SAVE_OPTIONS: SaveOptions = {
  updateVersion: true,
  versionGenerator: function() {
    // Stryker disable next-line all
    return (Math.random() + 1).toString(36).substring(7)
  },
  syncedAt: 0
}

/**
 * Interface for a repository.
 */
export class SyncRepository<
  TEntity extends SyncAggregate<AnyIdentity>
> implements Repository<TEntity> {
  constructor(
    private readonly repo: Repository<TEntity>
  ) { }

  /**
   * Get all entities.
   * @returns All entities.
   */
  async all(): Promise<readonly TEntity[]> {
    return this.repo.all()
  }

  /**
   * Save entity.
   * @param entity Entity to save.
   */
  async save(entity: TEntity, options?: Partial<SaveOptions>): Promise<void> {
    const saveOptions: SaveOptions = {
      ...DEFAULT_SAVE_OPTIONS,
      ...options
    }
    if (saveOptions.updateVersion) {
      entity.version = options?.version || saveOptions.versionGenerator(entity)
    }
    entity.syncedAt = saveOptions.syncedAt
    return this.repo.save(entity)
  }

  /**
   * Get entity by identity.
   * @param id Identity of the entity to load.
   */
  async get(id: TEntity['id']): Promise<TEntity> {
    return this.repo.get(id)
  }

  /**
   * Check if entity exists.
   * @param id Identity of the entity to check.
   */
  async exists(id: TEntity['id']): Promise<boolean> {
    return this.repo.exists(id)
  }

  /**
   * Find entities by query.
   * @param query Query to find entities by.
   */
  async find(query: Query<TEntity>): Promise<readonly TEntity[]> {
    return this.repo.find(query)
  }

  /**
   * Delete entity by identity.
   * @param id Identity of the entity to remove.
   */
  async delete(id: TEntity['id']): Promise<void> {
    return this.repo.delete(id)
  }
}
