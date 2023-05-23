import { AnyIdentity, Query, QueryOptions, Repository, ResultSet } from '@akdasa-studios/framework'
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
  TAggregate extends SyncAggregate<AnyIdentity>
> implements Repository<TAggregate> {
  constructor(
    private readonly repo: Repository<TAggregate>
  ) { }

  /**
   * Get all entities.
   * @returns All entities.
   */
  async all(): Promise<ResultSet<TAggregate>> {
    return this.repo.all()
  }

  /**
   * Save entity.
   * @param entity Entity to save.
   * @param options Options for saving.
   */
  async save(
    entity: TAggregate,
    options?: Partial<SaveOptions>
  ): Promise<void> {
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
  async get(id: TAggregate['id']): Promise<TAggregate> {
    return this.repo.get(id)
  }

  /**
   * Check if entity exists.
   * @param id Identity of the entity to check.
   */
  async exists(id: TAggregate['id']): Promise<boolean> {
    return this.repo.exists(id)
  }

  /**
   * Find entities by query.
   * @param query Query to find entities by.
   *
   */
  async find(
    query: Query<TAggregate>,
    options?: QueryOptions
  ): Promise<ResultSet<TAggregate>> {
    return this.repo.find(query, options)
  }

  /**
   * Delete entity by identity.
   * @param id Identity of the entity to remove.
   */
  async delete(id: TAggregate['id']): Promise<void> {
    return this.repo.delete(id)
  }
}
