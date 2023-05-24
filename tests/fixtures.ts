import { Aggregate, Identity } from '@akdasa-studios/framework'
import { SyncConflictSolver } from '@lib/SyncConflictSolver'
import { Syncable } from '@lib/SyncAggregate'


export class RowId extends Identity<string, 'Row'> {}

export class Row extends Aggregate<RowId> implements Syncable {
  constructor(id: RowId, text = 'default') {
    super(id)
    this.text = text
  }
  version: string
  modifiedAt: number
  text: string
}

export class RowConflictSolwer implements SyncConflictSolver<Row> {
  solve(object1: Row, object2: Row): Row {
    return object1.text.length > object2.text.length ? object1 : object2
  }
}