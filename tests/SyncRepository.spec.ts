import { InMemoryRepository } from '@akdasa-studios/framework'
import { SyncRepository } from '@lib/SyncRepository'
import { Row, RowId } from './fixtures'


describe('SyncRepository', () => {
  let row1: Row
  let repo: SyncRepository<Row>

  beforeEach(async () => {
    repo = new SyncRepository(new InMemoryRepository())
    row1 = new Row(new RowId('row1'))
  })

  /* -------------------------------------------------------------------------- */
  /*                                    save                                    */
  /* -------------------------------------------------------------------------- */

  describe('.save', () => {
    it('sets version', async () => {
      await repo.save(row1)

      // assert
      const result = await repo.get(row1.id)
      expect(result.version).toBeDefined()
    })

    it('do not set version', async () => {
      await repo.save(row1, { updateVersion: false })

      // assert
      const result = await repo.get(row1.id)
      expect(result.version).toBeUndefined()
    })

    it('do not update version', async () => {
      await repo.save(row1)
      const oldVersion = row1.version
      await repo.save(row1, { updateVersion: false })

      // assert
      const result = await repo.get(row1.id)
      expect(result.version).toEqual(oldVersion)
      expect(result.version).toBeDefined()
    })
  })

  describe('.delete', () => {
    it('should delete', async () => {
      await repo.save(row1)
      await repo.delete(row1.id)

      // assert
      const result = () => repo.get(row1.id)
      await expect(result).rejects.toThrowError()
    })
  })
})
