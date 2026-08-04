import type { ImportBatch, ImportPersistence } from "./Importer"

/** In-memory persistence for development — swap for Supabase later. */
export class MockImportPersistence implements ImportPersistence {
  private batches = new Map<string, ImportBatch>()

  async saveBatch(batch: ImportBatch): Promise<{ batchId: string }> {
    // Avoid structuredClone on tens of thousands of health rows — that can
    // OOM / hang and block Health Store ingest on the confirm path.
    this.batches.set(batch.id, {
      id: batch.id,
      importerId: batch.importerId,
      fileName: batch.fileName,
      importedAt: batch.importedAt,
      records: batch.records,
    })
    return { batchId: batch.id }
  }

  async deleteBatch(batchId: string): Promise<void> {
    this.batches.delete(batchId)
  }

  async getBatch(batchId: string): Promise<ImportBatch | null> {
    const batch = this.batches.get(batchId)
    if (!batch) return null
    return {
      id: batch.id,
      importerId: batch.importerId,
      fileName: batch.fileName,
      importedAt: batch.importedAt,
      records: batch.records,
    }
  }

  /** Test helper */
  listBatches(): ImportBatch[] {
    return [...this.batches.values()]
  }
}

let sharedPersistence: MockImportPersistence | null = null

export function getImportPersistence(): MockImportPersistence {
  if (!sharedPersistence) {
    sharedPersistence = new MockImportPersistence()
  }
  return sharedPersistence
}
