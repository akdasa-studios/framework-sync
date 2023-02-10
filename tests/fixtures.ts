import { Aggregate, AnyIdentity, Identity } from '@akdasa-studios/framework'
import { HasVersion } from '@lib/SyncRepository'
import { ConflictSolver } from '@lib/SyncService'


export class RowId extends Identity<string, 'Row'> {}

export class Row extends Aggregate<RowId> implements HasVersion {
  constructor(id: RowId, text = 'default') {
    super(id)
    this.text = text
  }
  version: string
  text: string
}

export class RowConflictSolwer implements ConflictSolver<Row> {
  solve(object1: Row, object2: Row): Aggregate<AnyIdentity> & HasVersion {
    return object1.text.length > object2.text.length ? object1 : object2
  }
}