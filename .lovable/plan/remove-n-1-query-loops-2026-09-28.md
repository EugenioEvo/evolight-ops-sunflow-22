# Remove N+1 query loops

## Findings
Most data fetching already batches correctly (Activities, RDO detail, client portal, RME/RDO decision emails use `.in()` or nested relations). Real loops found:

1. **HSE certificate alerts (daily job)** — for each expiring certificate: 1 dedup insert + 1 notification insert for the owner + 1 insert **per manager**. With 10 managers and 20 certs that is ~240 round trips.
2. **Users page, role editing** — inserts/deletes each added/removed role one by one.
3. **Obra page and public obra view** — signed photo/video links are created one file at a time (and per bucket fallback), so a gallery of 50 items does 50+ calls.
4. **RME photo upload / ticket attachments / HSE attachments** — signed URL created per file after each upload.

Kept as-is (loop is intentional, not N+1): email retry queue (per-job status updates), pending geocoding (rate-limited external API per ticket), client sync (already chunked 200 per batch), bulk client import (already batched).

## Changes
1. `hse-check-certificacoes`: compute qualifying certs first, bulk-insert dedup rows with `upsert(..., { ignoreDuplicates: true }).select()` to learn which are new, then build all notification rows (owner + managers) and insert them in one call. Emails stay per cert.
2. `Usuarios.tsx`: one `insert([...rows])` for added roles and one `delete().eq('user_id').in('role', toRemove)`.
3. `ObraDetail.tsx` and `obra-public-view`: replace per-file `createSignedUrl` with `createSignedUrls(paths, ttl)` grouped per bucket; only fall back to the second bucket for paths missing in the first.
4. `rmeService.ts`, `StepEvidence.tsx`, `FileUpload.tsx`, `HSECertificationsPanel.tsx`: upload files in parallel, then sign all paths with a single `createSignedUrls` call.

## Verification
- Build clean; open an obra with many photos/videos and confirm the gallery loads and plays.
- Edit a user's roles (add + remove) and confirm result.
- Invoke the HSE check function and confirm notifications are created once, no duplicates on second run.
