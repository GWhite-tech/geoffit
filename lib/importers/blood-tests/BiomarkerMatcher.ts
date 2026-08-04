/**
 * Canonical biomarker registry + fuzzy name matching for screenshot OCR.
 * Keys stay compatible with existing BloodMarker / Mission Control aliases.
 */

export interface CanonicalBiomarker {
  /** Registry id (documentation / future AI prompts). */
  registryId: string
  /** Existing Geoffit BloodMarker.key (lowercase snake). */
  key: string
  displayName: string
  aliases: string[]
  defaultUnit?: string
}

export interface BiomarkerMatch {
  biomarker: CanonicalBiomarker
  /** How the raw name matched (exact alias vs fuzzy). */
  matchKind: "exact" | "alias" | "contains"
  rawName: string
}

/**
 * Registry uses SCREAMING_SNAKE ids; keys match existing blood domain slugs.
 */
export const BIOMARKER_REGISTRY: CanonicalBiomarker[] = [
  {
    registryId: "HBA1C",
    key: "hba1c",
    displayName: "HbA1c",
    aliases: [
      "hba1c",
      "hbaic",
      "glycated haemoglobin",
      "glycated hemoglobin",
      "haemoglobin a1c",
      "hemoglobin a1c",
      "hb a1c",
      "glycohaemoglobin",
    ],
    defaultUnit: "mmol/mol",
  },
  {
    registryId: "TOTAL_TESTOSTERONE",
    key: "testosterone",
    displayName: "Testosterone",
    aliases: [
      "testosterone",
      "total testosterone",
      "serum testosterone",
      "testosterone total",
    ],
    defaultUnit: "nmol/L",
  },
  {
    registryId: "FREE_TESTOSTERONE",
    key: "free_testosterone",
    displayName: "Free Testosterone",
    aliases: ["free testosterone", "testosterone free"],
    defaultUnit: "nmol/L",
  },
  {
    registryId: "ESTRADIOL",
    key: "estradiol",
    displayName: "Oestradiol",
    aliases: ["oestradiol", "estradiol", "e2", "estrogen", "oestrogen"],
    defaultUnit: "pmol/L",
  },
  {
    registryId: "HDL",
    key: "hdl",
    displayName: "HDL",
    aliases: [
      "hdl",
      "hdl cholesterol",
      "hdl-c",
      "high density lipoprotein",
      "high-density lipoprotein",
    ],
    defaultUnit: "mmol/L",
  },
  {
    registryId: "LDL",
    key: "ldl",
    displayName: "LDL",
    aliases: [
      "ldl",
      "ldl cholesterol",
      "ldl-c",
      "low density lipoprotein",
      "low-density lipoprotein",
    ],
    defaultUnit: "mmol/L",
  },
  {
    registryId: "TOTAL_CHOLESTEROL",
    key: "cholesterol",
    displayName: "Cholesterol",
    aliases: [
      "cholesterol",
      "total cholesterol",
      "serum cholesterol",
      "chol",
    ],
    defaultUnit: "mmol/L",
  },
  {
    registryId: "TRIGLYCERIDES",
    key: "triglycerides",
    displayName: "Triglycerides",
    aliases: ["triglycerides", "triglyceride", "trigs", "tg"],
    defaultUnit: "mmol/L",
  },
  {
    registryId: "NON_HDL",
    key: "non_hdl_cholesterol",
    displayName: "Non HDL Cholesterol",
    aliases: ["non hdl cholesterol", "non-hdl cholesterol", "non hdl", "non-hdl"],
    defaultUnit: "mmol/L",
  },
  {
    registryId: "TSH",
    key: "tsh",
    displayName: "TSH",
    aliases: ["tsh", "thyroid stimulating hormone", "thyroid-stimulating hormone"],
    defaultUnit: "mU/L",
  },
  {
    registryId: "FREE_T4",
    key: "free_t4",
    displayName: "Free T4",
    aliases: ["free t4", "ft4", "free thyroxine"],
    defaultUnit: "pmol/L",
  },
  {
    registryId: "CREATININE",
    key: "creatinine",
    displayName: "Creatinine",
    aliases: ["creatinine", "creat"],
    defaultUnit: "umol/L",
  },
  {
    registryId: "EGFR",
    key: "egfr",
    displayName: "eGFR",
    aliases: ["egfr", "estimated gfr", "gfr"],
    defaultUnit: "mL/min/1.73m²",
  },
  {
    registryId: "HAEMOGLOBIN",
    key: "haemoglobin",
    displayName: "Haemoglobin",
    aliases: ["haemoglobin", "hemoglobin", "hb"],
    defaultUnit: "g/L",
  },
  {
    registryId: "FERRITIN",
    key: "ferritin",
    displayName: "Ferritin",
    aliases: ["ferritin"],
    defaultUnit: "ug/L",
  },
  {
    registryId: "VITAMIN_D",
    key: "vitamin_d",
    displayName: "Vitamin D",
    aliases: [
      "vitamin d",
      "vit d",
      "25-oh vitamin d",
      "25 hydroxy vitamin d",
      "25-hydroxyvitamin d",
    ],
    defaultUnit: "nmol/L",
  },
  {
    registryId: "B12",
    key: "vitamin_b12",
    displayName: "Vitamin B12",
    aliases: ["vitamin b12", "b12", "cobalamin", "serum b12"],
    defaultUnit: "ng/L",
  },
  {
    registryId: "FOLATE",
    key: "folate",
    displayName: "Folate",
    aliases: ["folate", "folic acid", "serum folate"],
    defaultUnit: "ug/L",
  },
  {
    registryId: "PSA",
    key: "psa",
    displayName: "PSA",
    aliases: ["psa", "prostate specific antigen", "prostate-specific antigen"],
    defaultUnit: "ug/L",
  },
  {
    registryId: "SHBG",
    key: "shbg",
    displayName: "SHBG",
    aliases: ["shbg", "sex hormone binding globulin"],
    defaultUnit: "nmol/L",
  },
  {
    registryId: "ALT",
    key: "alt",
    displayName: "ALT",
    aliases: ["alt", "alanine aminotransferase", "alanine transaminase"],
    defaultUnit: "U/L",
  },
  {
    registryId: "AST",
    key: "ast",
    displayName: "AST",
    aliases: ["ast", "aspartate aminotransferase", "aspartate transaminase"],
    defaultUnit: "U/L",
  },
  {
    registryId: "ALP",
    key: "alp",
    displayName: "ALP",
    aliases: ["alp", "alkaline phosphatase"],
    defaultUnit: "U/L",
  },
  {
    registryId: "GGT",
    key: "ggt",
    displayName: "GGT",
    aliases: ["ggt", "gamma gt", "gamma-gt", "gamma glutamyl transferase"],
    defaultUnit: "U/L",
  },
  {
    registryId: "ALBUMIN",
    key: "albumin",
    displayName: "Albumin",
    aliases: ["albumin"],
    defaultUnit: "g/L",
  },
  {
    registryId: "BILIRUBIN",
    key: "total_bilirubin",
    displayName: "Total Bilirubin",
    aliases: ["bilirubin", "total bilirubin", "serum bilirubin"],
    defaultUnit: "umol/L",
  },
  {
    registryId: "GLUCOSE",
    key: "glucose",
    displayName: "Glucose",
    aliases: ["glucose", "blood glucose", "fasting glucose", "plasma glucose"],
    defaultUnit: "mmol/L",
  },
  {
    registryId: "UREA",
    key: "urea",
    displayName: "Urea",
    aliases: ["urea", "blood urea", "bun"],
    defaultUnit: "mmol/L",
  },
  {
    registryId: "SODIUM",
    key: "sodium",
    displayName: "Sodium",
    aliases: ["sodium", "na"],
    defaultUnit: "mmol/L",
  },
  {
    registryId: "POTASSIUM",
    key: "potassium",
    displayName: "Potassium",
    aliases: ["potassium", "k"],
    defaultUnit: "mmol/L",
  },
  {
    registryId: "WCC",
    key: "wcc",
    displayName: "WCC",
    aliases: ["wcc", "white cell count", "white blood cell count", "wbc"],
    defaultUnit: "×10⁹/L",
  },
  {
    registryId: "PLATELETS",
    key: "platelets",
    displayName: "Platelets",
    aliases: ["platelets", "platelet count", "plt"],
    defaultUnit: "×10⁹/L",
  },
  {
    registryId: "RBC",
    key: "rbc",
    displayName: "RBC",
    aliases: ["rbc", "red cell count", "red blood cell count"],
    defaultUnit: "×10¹²/L",
  },
]

function normaliseLookup(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[©®@●•·:_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const aliasIndex = (() => {
  const map = new Map<string, CanonicalBiomarker>()
  for (const biomarker of BIOMARKER_REGISTRY) {
    map.set(normaliseLookup(biomarker.displayName), biomarker)
    for (const alias of biomarker.aliases) {
      map.set(normaliseLookup(alias), biomarker)
    }
  }
  return map
})()

/**
 * Map an OCR'd biomarker name into the Geoffit registry.
 * Prefer exact / alias hits; fall back to longest contains match.
 */
export function matchBiomarker(rawName: string): BiomarkerMatch | null {
  const cleaned = normaliseLookup(rawName)
  if (!cleaned || cleaned.length < 2) return null

  const exact = aliasIndex.get(cleaned)
  if (exact) {
    return { biomarker: exact, matchKind: "exact", rawName }
  }

  // Alias containment: prefer longer alias keys to avoid "HDL" stealing "Non HDL".
  let best: { biomarker: CanonicalBiomarker; aliasLen: number } | null = null
  for (const [alias, biomarker] of aliasIndex) {
    if (alias.length < 3) continue
    if (cleaned === alias) {
      return { biomarker, matchKind: "alias", rawName }
    }
    if (cleaned.includes(alias) || alias.includes(cleaned)) {
      if (!best || alias.length > best.aliasLen) {
        best = { biomarker, aliasLen: alias.length }
      }
    }
  }

  if (best && best.aliasLen >= 3) {
    return {
      biomarker: best.biomarker,
      matchKind: "contains",
      rawName,
    }
  }

  return null
}

/** Find the first registry biomarker mentioned in a line of OCR text. */
export function findBiomarkerInLine(line: string): BiomarkerMatch | null {
  const cleaned = normaliseLookup(line)
  let best: BiomarkerMatch | null = null
  let bestLen = 0

  for (const [alias, biomarker] of aliasIndex) {
    if (alias.length < 3) continue
    if (!cleaned.includes(alias)) continue
    if (alias.length > bestLen) {
      bestLen = alias.length
      best = {
        biomarker,
        matchKind: alias === cleaned ? "exact" : "contains",
        rawName: alias,
      }
    }
  }

  return best
}

export function slugifyUnknownBiomarker(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
}
