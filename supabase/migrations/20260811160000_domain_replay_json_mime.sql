-- Allow domain-replay JSON artefacts (Blood/Hevy bootstrap) in existing ingest buckets.
-- Blood replay → lab-pdfs; Hevy replay → raw-ingest.
-- contentType remains application/json; do not replace existing MIME allowlists.

update storage.buckets
set allowed_mime_types = array_append(allowed_mime_types, 'application/json')
where id = 'lab-pdfs'
  and allowed_mime_types is not null
  and not ('application/json' = any (allowed_mime_types));

update storage.buckets
set allowed_mime_types = array_append(allowed_mime_types, 'application/json')
where id = 'raw-ingest'
  and allowed_mime_types is not null
  and not ('application/json' = any (allowed_mime_types));
