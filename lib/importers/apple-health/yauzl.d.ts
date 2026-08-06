declare module "yauzl" {
  import type { Readable } from "node:stream"

  export interface Entry {
    fileName: string
    compressedSize: number
    uncompressedSize: number
  }

  export interface ZipFile {
    readEntry(): void
    openReadStream(
      entry: Entry,
      callback: (err: Error | null, stream?: Readable) => void
    ): void
    close(): void
    on(event: "entry", cb: (entry: Entry) => void): this
    on(event: "end", cb: () => void): this
    on(event: "error", cb: (err: Error) => void): this
    removeListener(event: string, cb: (...args: never[]) => void): this
  }

  export function fromBuffer(
    buffer: Buffer,
    options: { lazyEntries?: boolean },
    callback: (err: Error | null, zipfile?: ZipFile) => void
  ): void
}
