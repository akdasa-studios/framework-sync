import { InMemoryRepository } from '@akdasa-studios/framework'
import { SyncRepository } from '@lib/SyncRepository'
import { SyncService } from '@lib/SyncService'
import { Row, RowConflictSolwer, RowId } from './fixtures'


describe('SyncService', () => {
  let row1: Row
  let row2: Row
  let repoA: SyncRepository<Row>
  let repoB: SyncRepository<Row>
  let solver: RowConflictSolwer
  let service: SyncService<Row>
  let spySolveConflict

  beforeEach(async () => {
    repoA = new SyncRepository(new InMemoryRepository<Row>())
    repoB = new SyncRepository(new InMemoryRepository<Row>())
    solver = new RowConflictSolwer()
    service = new SyncService(solver)
    row1 = new Row(new RowId('row1'), 'row1')
    row2 = new Row(new RowId('row2'), 'row2')
    spySolveConflict = jest.spyOn(solver, 'solve')
  })

  /* -------------------------------------------------------------------------- */
  /*                                    sync                                    */
  /* -------------------------------------------------------------------------- */

  describe('.sync', () => {
    /**
     * Entity from repository A should be synced to repository B
     */
    it('sync entity in one direction', async () => {
      // arrange:
      await repoA.save(row1)

      // act:
      const result = await service.sync(repoA, repoB)

      // assert:
      const repoBEntities = await repoB.all()
      expect(repoBEntities.length).toEqual(1)
      expect(repoBEntities[0].id.value).toEqual(row1.id.value)
      expect(repoBEntities[0].text).toEqual(row1.text)
      expect(repoBEntities[0].version).toEqual(row1.version)
      expect(spySolveConflict).not.toBeCalled()
      expect(result.aggregatesSynced).toEqual(1)
    })

    /**
     * Entities from both repositories should be synced to each other
     */
    it('sync entity in two directions', async () => {
      // arrange:
      await repoA.save(row1)
      await repoB.save(row2)

      // act:
      const result = await service.sync(repoA, repoB)

      // assert:
      const allA = await repoA.all()
      const allB = await repoB.all()
      expect(allA).toHaveLength(2)
      expect(allB).toHaveLength(2)

      expect(allB.map(x => x.id.value)).toIncludeAllMembers([row1.id.value, row2.id.value])
      expect(allB.map(x => x.text)).toIncludeAllMembers([row1.text, row2.text])
      expect(allB.map(x => x.version)).toIncludeAllMembers([row1.version, row2.version])

      expect(allA.map(x => x.id.value)).toIncludeAllMembers([row1.id.value, row2.id.value])
      expect(allA.map(x => x.text)).toIncludeAllMembers([row1.text, row2.text])
      expect(allA.map(x => x.version)).toIncludeAllMembers([row1.version, row2.version])

      expect(spySolveConflict).not.toBeCalled()
      expect(result.aggregatesSynced).toEqual(2)
    })

    it('do not sync if versons are equal', async () => {
      // arrange:
      await repoA.save(row1, { version: 'v1' })
      await repoB.save(row1, { version: 'v1' })

      // act:
      const result = await service.sync(repoA, repoB)

      // assert:
      expect(spySolveConflict).not.toBeCalled()
      expect(result.aggregatesChecked).toEqual(2)
      expect(result.aggregatesSynced).toEqual(0)
    })

    /**
     * Conflict should be resolved by conflict solver and synced to both repositories
     */
    it('resove conflicts (one direction)', async () => {
      let row1 = new Row(new RowId('row1'), 'looser')
      let row2 = new Row(new RowId('row1'), '!winner!')

      // arrange:
      await repoA.save(row1) // v1
      await repoA.save(row1) // v2
      await repoA.save(row1) // v3
      await repoB.save(row2) // v1

      // act:
      const result = await service.sync(repoA, repoB)

      // assert:
      row1 = await repoA.get(new RowId('row1'))
      row2 = await repoB.get(new RowId('row1'))

      expect(row1.text).toEqual('!winner!')
      expect(row2.text).toEqual('!winner!')
      expect(row1.version).toEqual(row2.version)
      expect(spySolveConflict).toBeCalledTimes(1)
      expect(result.aggregatesSynced).toEqual(1)
    })

    /**
     * Conflict should be resolved by conflict solver and synced to both repositories
     */
    it('resolve conflict (other direction)', async () => {
      let row1 = new Row(new RowId('row1'), '!WINNER!')
      let row2 = new Row(new RowId('row1'), 'looser')

      // act
      await repoA.save(row1) // v1
      await repoB.save(row2) // v1
      const result = await service.sync(repoA, repoB)

      // assert
      row1 = await repoA.get(new RowId('row1'))
      row2 = await repoB.get(new RowId('row1'))

      expect(row1.text).toEqual('!WINNER!')
      expect(row2.text).toEqual('!WINNER!')
      expect(row1.version).toEqual(row2.version)
      expect(spySolveConflict).toBeCalledTimes(1)
      expect(result.aggregatesSynced).toEqual(1)
    })

    /**
     * syncedAt for both entities from repository A and B should be equal
     * after sync
     */
    it('syncedAt are equal for both entities', async () => {
      // act:
      await repoA.save(row1)
      await service.sync(repoA, repoB)

      // assert:
      const row1FromA = await repoA.get(row1.id)
      const row1FromB = await repoB.get(row1.id)
      expect(row1FromA.syncedAt === row1FromB.syncedAt).toBeTrue()
    })

    /**
     * version for both entities from repository A and B should be equal
     * after sync
     */
    it('version are equal for both entities', async () => {
      // After sync, both entities from repository A and B
      // should have the same version

      // act:
      await repoA.save(row1)
      await service.sync(repoA, repoB)

      // assert:
      const row1FromA = await repoA.get(row1.id)
      const row1FromB = await repoB.get(row1.id)
      expect(row1FromA.version === row1FromB.version).toBeTrue()
    })

    /**
     * Should not sync entities that were not changed since last sync
     */
    it('should not sync entities with no changes', async () => {
      // arrange:
      await repoA.save(row1)
      const state = await service.sync(repoA, repoB)

      // act:
      const result = await service.sync(repoA, repoB, {
        lastSyncTime: state.completedAt,
        currentTime: state.completedAt + 1000
      })

      // assert:
      expect(result.aggregatesChecked).toEqual(0)
      expect(result.aggregatesSynced).toEqual(0)
    })

    /**
     * Should sync entities that were changed since last sync
     */
    it('sync changed entities', async () => {
      // arrange:
      await repoA.save(row1)
      const state = await service.sync(repoA, repoB)

      // act:
      row1 = await repoA.get(row1.id)
      await repoA.save(row1)
      const result = await service.sync(repoA, repoB, {
        lastSyncTime: state.completedAt,
        currentTime: state.completedAt + 1000
      })

      // assert:
      expect(result.aggregatesChecked).toEqual(1)
      expect(result.aggregatesSynced).toEqual(1)
    })

    /**
     * Conflicting entities should be synced only once
     */
    it('conflicting entities sync once', async () => {
      // arrange:
      await repoA.save(row1)
      await repoB.save(row1)

      // act:
      const state = await service.sync(repoA, repoB)

      // assert:
      expect(spySolveConflict).toBeCalled()
      expect(state.aggregatesChecked).toEqual(1)
      expect(state.aggregatesSynced).toEqual(1)
    })

    /**
     * Should sync entities in both directions
     */
    it('sync entities in both directions', async () => {
      // arrange:
      await repoA.save(row1)
      await repoB.save(row2)

      // act:
      const state = await service.sync(repoA, repoB)

      // assert:
      expect(spySolveConflict).not.toBeCalled()
      expect(state.aggregatesChecked).toEqual(2)
      expect(state.aggregatesSynced).toEqual(2)
    })


    /**
     * Should not sync entities that were not changed since last sync
     */
    it('full sync', async () => {
      // arrange:
      await repoA.save(row1)
      await service.sync(repoA, repoB)

      // act:
      const result = await service.sync(repoA, repoB, {
        lastSyncTime: 0,
        currentTime: new Date().getTime() + 10
      })

      // assert:
      expect(result.aggregatesChecked).toEqual(2)
      expect(result.aggregatesSynced).toEqual(0) // objects didn't change
    })
  })
})