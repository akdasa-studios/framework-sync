import { Repository, Aggregate, AnyIdentity, Result, Query } from '@akdasa-studios/framework'


export interface HasVersion {
  version: string
}

export interface SaveOptions {
  updateVersion: boolean
  versionGenerator: VersionGenerator
}

export type VersionGenerator = (aggregate: Aggregate<AnyIdentity> & HasVersion) => string

const DEFAULT_SAVE_OPTIONS: SaveOptions = {
  updateVersion: true,
  versionGenerator: function() { return Math.random().toString(36) }
}

/**
 * Interface for a repository.
 */
export class SyncRepository<
  TEntity extends (Aggregate<AnyIdentity> & HasVersion)
> implements Repository<TEntity> {
  constructor(
    private readonly repo: Repository<TEntity>
  ) { }

  /**
   * Get all entities.
   * @returns All entities.
   */
  async all(): Promise<Result<readonly TEntity[]>> {
    return this.repo.all()
  }

  /**
   * Save entity.
   * @param entity Entity to save.
   */
  async save(entity: TEntity, options?: Partial<SaveOptions>): Promise<Result<void, string>> {
    const saveOptions: SaveOptions = {
      ...DEFAULT_SAVE_OPTIONS,
      ...options
    }
    if (saveOptions.updateVersion) {
      entity.version = saveOptions.versionGenerator(entity)
    }
    return this.repo.save(entity)
  }

  /**
   * Get entity by identity.
   * @param id Identity of the entity to load.
   */
  async get(id: TEntity['id']): Promise<Result<TEntity, string>> {
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
  async find(query: Query<TEntity>): Promise<Result<readonly TEntity[]>> {
    return this.repo.find(query)
  }

  /**
   * Delete entity by identity.
   * @param id Identity of the entity to remove.
   */
  async delete(id: TEntity['id']): Promise<Result<void, string>> {
    return this.repo.delete(id)
  }
}
