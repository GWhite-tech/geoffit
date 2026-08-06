/**
 * Regenerates fixtures/numan-blood-report.pdf (selectable digital Numan-like report).
 * Run: node scripts/generate-numan-blood-fixture.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")

function esc(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
}

const markers = [
  ["Albumin", "45", "35 - 50", "NORMAL", "g/L"],
  ["ALP", "62", "30 - 130", "NORMAL", "U/L"],
  ["ALT", "28", "0 - 41", "NORMAL", "U/L"],
  ["AST", "24", "0 - 40", "NORMAL", "U/L"],
  ["Basophils", "0.04", "0.00 - 0.10", "NORMAL", "x10^9/L"],
  ["Cholesterol", "4.8", "<5.0", "NORMAL", "mmol/L"],
  ["Cholesterol:HDL Ratio", "3.5", "<4.0", "NORMAL", "ratio"],
  ["Creatinine", "88", "59 - 104", "NORMAL", "umol/L"],
  ["eGFR", "92", ">60", "NORMAL", "mL/min/1.73m2"],
  ["Eosinophils", "0.15", "0.00 - 0.50", "NORMAL", "x10^9/L"],
  ["Ferritin", "120", "30 - 400", "NORMAL", "ug/L"],
  ["Free T4", "16", "12 - 22", "NORMAL", "pmol/L"],
  ["Free Testosterone", "0.28", "0.20 - 0.62", "NORMAL", "nmol/L"],
  ["FSH", "4.2", "1.5 - 12.4", "NORMAL", "U/L"],
  ["GGT", "22", "0 - 60", "NORMAL", "U/L"],
  ["Globulin", "28", "20 - 35", "NORMAL", "g/L"],
  ["Haemoglobin", "148", "130 - 170", "NORMAL", "g/L"],
  ["HbA1c", "45", "20 - 42", "HIGH", "mmol/mol"],
  ["HCT", "0.44", "0.40 - 0.50", "NORMAL", "L/L"],
  ["HDL", "1.4", ">1.0", "NORMAL", "mmol/L"],
  ["LDL", "2.9", "<3.0", "NORMAL", "mmol/L"],
  ["LH", "5.1", "1.7 - 8.6", "NORMAL", "U/L"],
  ["Lymphocytes", "2.1", "1.0 - 3.5", "NORMAL", "x10^9/L"],
  ["MCH", "30", "27 - 32", "NORMAL", "pg"],
  ["MCHC", "340", "320 - 360", "NORMAL", "g/L"],
  ["MCV", "90", "83 - 101", "NORMAL", "fL"],
  ["Monocytes", "0.5", "0.2 - 1.0", "NORMAL", "x10^9/L"],
  ["Neutrophils", "3.2", "2.0 - 7.0", "NORMAL", "x10^9/L"],
  ["Non HDL Cholesterol", "3.4", "<3.9", "NORMAL", "mmol/L"],
  ["Platelets", "240", "150 - 400", "NORMAL", "x10^9/L"],
  ["Prolactin", "180", "86 - 324", "NORMAL", "mU/L"],
  ["PSA", "0.8", "<2.5", "NORMAL", "ug/L"],
  ["RBC", "5.0", "4.5 - 5.5", "NORMAL", "x10^12/L"],
  ["SHBG", "42", "18 - 54", "NORMAL", "nmol/L"],
  ["Testosterone", "11.3", "8.64 - 29", "NORMAL", "nmol/L"],
  ["Total Bilirubin", "12", "0 - 21", "NORMAL", "umol/L"],
  ["Total Protein", "72", "60 - 80", "NORMAL", "g/L"],
  ["Triglycerides", "1.1", "<1.7", "NORMAL", "mmol/L"],
  ["TSH", "1.8", "0.27 - 4.20", "NORMAL", "mU/L"],
  ["Urea", "5.4", "2.5 - 7.8", "NORMAL", "mmol/L"],
  ["WCC", "6.2", "4.0 - 11.0", "NORMAL", "x10^9/L"],
]

const clinical = Array.from(
  { length: 40 },
  (_, i) =>
    `Clinical narrative padding line ${i + 1}: review lipids glucose hormones and blood counts carefully with your clinician.`
)

const page1 = [
  "Numan",
  "Blood Test Results Venous Panel",
  "Geoff Example Male 15 March 2026 16 March 2026",
  "PATIENT NAME Geoff Example",
  "TEST TAKEN 15 March 2026",
  "Clinical review",
  ...clinical.slice(0, 20),
  "Identifier Observation",
]

const pageChunks = []
let current = [...page1]
for (const [name, value, range, status, unit] of markers) {
  current.push(`${name} ${value} ${range} ${status}`)
  current.push(unit)
  if (current.length > 45) {
    pageChunks.push(current)
    current = ["Numan Blood Test Results continued", "Identifier Observation"]
  }
}
current.push(...clinical.slice(20))
current.push("Learn more about each biomarker")
current.push("Best wishes")
pageChunks.push(current)

while (pageChunks.length < 5) {
  pageChunks.push([
    "Numan supplementary page " + (pageChunks.length + 1),
    ...clinical,
    "Identifier Observation reference page",
  ])
}

function makePageStream(lines) {
  let content = "BT /F1 10 Tf 40 800 Td 12 TL\n"
  for (const line of lines) {
    content += `(${esc(line)}) Tj T*\n`
  }
  content += "ET\n"
  return content
}

const objs = []
const push = (body) => {
  objs.push(body)
  return objs.length
}

const font = push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
const contentIds = pageChunks.map((lines) => {
  const stream = makePageStream(lines)
  return push(
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`
  )
})
const pageIds = []
const pagesId = objs.length + pageChunks.length + 1
for (let i = 0; i < pageChunks.length; i++) {
  pageIds.push(
    push(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 842] /Contents ${contentIds[i]} 0 R /Resources << /Font << /F1 ${font} 0 R >> >> >>`
    )
  )
}
const pages = push(
  `<< /Type /Pages /Kids [${pageIds.map((id) => id + " 0 R").join(" ")}] /Count ${pageIds.length} >>`
)
if (pages !== pagesId) throw new Error(`pages id mismatch ${pages} vs ${pagesId}`)
const catalog = push(`<< /Type /Catalog /Pages ${pages} 0 R >>`)

let pdf = "%PDF-1.4\n"
const offsets = [0]
for (let i = 0; i < objs.length; i++) {
  offsets.push(Buffer.byteLength(pdf))
  pdf += `${i + 1} 0 obj\n${objs[i]}\nendobj\n`
}
const xrefPos = Buffer.byteLength(pdf)
pdf += `xref\n0 ${objs.length + 1}\n`
pdf += "0000000000 65535 f \n"
for (let i = 1; i <= objs.length; i++) {
  pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n"
}
pdf += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`

const out = path.join(root, "fixtures", "blood-lab-pdfs", "numan", "report.pdf")
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, pdf)
console.log("wrote", out, "pages", pageChunks.length, "bytes", Buffer.byteLength(pdf))
console.log(
  "NOTE: Replace this stand-in with the real anonymised Numan PDF when available."
)
