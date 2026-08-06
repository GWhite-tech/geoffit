/** Copy bytes into a File for parsers that still expect File. */
export function bytesToFile(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string
): File {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new File([copy], fileName, { type: mimeType })
}
