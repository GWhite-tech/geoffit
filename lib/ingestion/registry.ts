import type { DocumentKind, DocumentParser } from "./types"

const parsers = new Map<DocumentKind, DocumentParser>()
const byId = new Map<string, DocumentParser>()

export function registerDocumentParser(parser: DocumentParser): void {
  if (parsers.has(parser.kind)) {
    throw new Error(
      `Document parser already registered for kind "${parser.kind}" (existing: ${parsers.get(parser.kind)!.id}, new: ${parser.id})`
    )
  }
  if (byId.has(parser.id)) {
    throw new Error(`Document parser id already registered: ${parser.id}`)
  }
  parsers.set(parser.kind, parser)
  byId.set(parser.id, parser)
}

export function getDocumentParser(kind: DocumentKind): DocumentParser {
  const parser = parsers.get(kind)
  if (!parser) {
    throw new Error(`No document parser registered for kind "${kind}"`)
  }
  return parser
}

export function getDocumentParserById(id: string): DocumentParser | null {
  return byId.get(id) ?? null
}

export function listDocumentParsers(): DocumentParser[] {
  return [...parsers.values()]
}

export function hasDocumentParser(kind: DocumentKind): boolean {
  return parsers.has(kind)
}
