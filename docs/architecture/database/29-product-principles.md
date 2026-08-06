# Geoffit — Product Principles

These principles govern product, architecture, AI, sync, and data decisions.  
If a feature conflicts with them, the feature changes — not the principle.

---

## 1. Health data is factual

Geoffit permanently stores **what happened**: measurements, workouts, sleep, labs, medications, treatments, supplies, events, photos, journal entries, goals.

It does not treat scores, cards, narratives, or model opinions as clinical truth.

---

## 2. Analytics are reproducible

Health Score, Training Score, Recovery Score, Mission Control, Progress narratives, and Weekly Review insights are **computed from facts**.

They must be regenerable. They are never the source of truth.

---

## 3. AI explains

The AI Coach exists to help the user understand their data: patterns, trade-offs, questions for clinicians, and next steps — with clear language grounded in facts.

---

## 4. AI never invents

AI must not fabricate readings, lab values, doses, diagnoses, or history.

If evidence is missing, AI says so. Uncertainty is stated. Citations point at real facts.

---

## 5. AI never mutates clinical data

AI may write only to AI tables (threads, memory, recommendations, summaries, feedback).

Clinical changes require an explicit user action through domain commands.

---

## 6. Users own their data

The user’s health record belongs to the user.

Connectors may feed Geoffit; providers do not own the Geoffit record. Sharing (coach, family, clinician) is explicit, minimal, and revocable.

---

## 7. Every recommendation is explainable

Any suggestion — human-authored rules or AI — must be traceable to underlying facts (and optionally rules/models).

If it cannot be explained, it does not ship.

---

## 8. Everything can be exported

Users can export their facts, files, and (optionally) AI history in portable form.

Lock-in is a bug. Regeneration of derived views after export is acceptable; loss of facts is not.

---

## 9. Every action is auditable

Sensitive actions leave an audit trail: source connect/disconnect, clinical deletes, medication stops, supply voids, exports, erasures, share grants, break-glass access.

Quiet corruption is unacceptable.

---

## 10. Offline first

Core logging works without a network: doses, weight, journal, treatment notes, workouts where applicable.

Connectivity may be delayed; user intent is not discarded.

---

## 11. Cloud synced

When online, devices converge on the same factual record through sync, fingerprints, conflict rules, and tombstones.

Cloud is the durability and multi-device layer — not an excuse to block local capture.

---

## 12. Privacy by default

Access is deny-by-default. Data is private unless the user shares it.

No surprise secondary use. Tokens stay vaulted. Analytics and AI do not become a back door into clinical writes.

---

## How to use these principles

| Situation | Ask |
|-----------|-----|
| New table / field | Is this a fact, or regenerable derived data? |
| New AI feature | Can it invent? Can it write clinical rows? Are citations required? |
| New connector | Who is source of truth? What happens on conflict/delete? |
| New score / card | Can we delete the cache and rebuild from facts alone? |
| New share / portal | Is grant explicit, scoped, auditable, revocable? |
| New offline flow | Is user intent durable if the app is killed mid-flight? |

When principles collide in edge cases, prefer: **user ownership → factual integrity → explainability → convenience**.
