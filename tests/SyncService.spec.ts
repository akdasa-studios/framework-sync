import { Aggregate, AnyIdentity, Identity, InMemoryRepository } from '@akdasa-studios/framework'
import { HasVersion, SyncRepository } from '@lib/SyncRepository'
import { ConflictSolver, SyncService } from '@lib/SyncService'


export class RowId extends Identity<string, 'Row'> {}
class Row extends Aggregate<RowId> implements HasVersion {
  constructor(id: RowId, text = 'default') {
    super(id)
    this.text = text
  }
  version: string
  text: string
}
class RowConflictSolwer implements ConflictSolver<Row> {
  solve(object1: Row, object2: Row): Aggregate<AnyIdentity> & HasVersion {
    return object1.text.length > object2.text.length ? object1 : object2
  }
}

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
    it('sync entity in one direction', async () => {
      await repoA.save(row1)
      await service.sync(repoA, repoB)

      const repoBEntities = (await repoB.all()).value
      expect(repoBEntities.length).toEqual(1)
      expect(repoBEntities[0].id.value).toEqual(row1.id.value)
      expect(repoBEntities[0].text).toEqual(row1.text)
      expect(repoBEntities[0].version).toEqual(row1.version)
      expect(spySolveConflict).not.toBeCalled()
    })

    it('sync entity in two directions', async () => {
      await repoA.save(row1)
      await repoB.save(row2)

      // act
      await service.sync(repoA, repoB)

      // assert
      const allA = (await repoA.all()).value
      const allB = (await repoB.all()).value
      expect(allA).toHaveLength(2)
      expect(allB).toHaveLength(2)

      expect(allB.map(x => x.id.value)).toIncludeAllMembers([row1.id.value, row2.id.value])
      expect(allB.map(x => x.text)).toIncludeAllMembers([row1.text, row2.text])
      expect(allB.map(x => x.version)).toIncludeAllMembers([row1.version, row2.version])

      expect(allA.map(x => x.id.value)).toIncludeAllMembers([row1.id.value, row2.id.value])
      expect(allA.map(x => x.text)).toIncludeAllMembers([row1.text, row2.text])
      expect(allA.map(x => x.version)).toIncludeAllMembers([row1.version, row2.version])

      expect(spySolveConflict).not.toBeCalled()
    })

    it('conflict', async () => {
      let row1 = new Row(new RowId('row1'), 'looser')
      let row2 = new Row(new RowId('row1'), '!winner!')

      // act
      await repoA.save(row1) // v1
      await repoA.save(row1) // v2
      await repoA.save(row1) // v3
      await repoB.save(row2) // v1
      await service.sync(repoA, repoB)

      // assert
      row1 = (await repoA.get(new RowId('row1'))).value
      row2 = (await repoB.get(new RowId('row1'))).value

      expect(row1.text).toEqual('!winner!')
      expect(row2.text).toEqual('!winner!')
      expect(row1.version).toEqual(row2.version)
      expect(spySolveConflict).toBeCalledTimes(1)
    })

    it('conflict 2', async () => {
      let row1 = new Row(new RowId('row1'), '!WINNER!')
      let row2 = new Row(new RowId('row1'), 'looser')

      // act
      await repoA.save(row1) // v1
      await repoB.save(row2) // v1
      await service.sync(repoA, repoB)

      // assert
      row1 = (await repoA.get(new RowId('row1'))).value
      row2 = (await repoB.get(new RowId('row1'))).value

      expect(row1.text).toEqual('!WINNER!')
      expect(row2.text).toEqual('!WINNER!')
      expect(row1.version).toEqual(row2.version)
      expect(spySolveConflict).toBeCalledTimes(1)
    })

    it('no conflict', async () => {
      await repoA.save(row1) // v1
      await service.sync(repoA, repoB)
      await service.sync(repoA, repoB)

      // assert
      expect(spySolveConflict).not.toBeCalled()
    })
  })
})