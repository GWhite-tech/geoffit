# Geoffit Database Architecture — Future Considerations

## Workspaces & sharing

- `workspaces`, `workspace_members`, grants on selected fact types  
- Coach/clinician read scopes; never default-open clinical AI memory  
- Timeline filters by share grant  

## Wearables & Health Connect

- Background sync adapters into Ingestion (`sync_state` cursors)  
- Health Connect / Garmin / WHOOP / Oura as first-class `connected_sources`  
- Sample-rate thrashing → downsample into `metric_samples` aggregates  

## Analytics warehouse (optional)

- Facts remain in OLTP  
- Nightly ETL of facts → analytics warehouse for heavy scoring research  
- Still no Mission Control cards as OLTP SoT  

## Genomics / imaging / CGM

- New FACT tables under Labs/Physiology; never fold into AI conclusions tables  
- CGM streams → partitioned samples + timeline markers  

## Multi-person households

- Dependent profiles under workspace; RLS via membership  
- Supplies shared fridge location vs personal meds  

## Offline-first hardening

- CRDT-lite for journal/notes; LWW for scalar metrics with conflict_records  
- Offline queue durability across app restarts  

## Regulatory / export

- Full account export zip: facts + files + AI threads (user choice)  
- Right-to-erasure cascades; regenerate reports after delete  

## What not to premature-optimize

- Sharding by user before product-market fit  
- Persisting every AI token  
- Dual-writing scores “just in case”  

See also: `11-bounded-contexts.md`, `15-ai-architecture.md`, `18-connected-sources.md`.  
