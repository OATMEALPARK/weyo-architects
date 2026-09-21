# Image migration audit — 2026-09-21

Source: live Wix project detail galleries, cross-checked by full browser scrolling and ordered asset IDs. Works, category pages, pages-sitemap.xml and the public older listing were inspected; 18 project detail pages were found. Responsive variants are one asset. Header/footer/UI images are excluded.

| Project | Old detail images | Current new | Missing | Not in source detail | Duplicate | Order |
|---|---:|---:|---:|---:|---:|---|
| haengdang | 24 | 7 | 21 | 4 | 0 | FIX |
| geoyeo | 13 | 13 | 0 | 0 | 0 | OK |
| seongbuk | 14 | 14 | 0 | 0 | 0 | OK |
| gaegum | 24 | 7 | 17 | 0 | 0 | FIX |
| goun | 27 | 25 | 2 | 0 | 0 | FIX |
| hannam | 33 | 25 | 8 | 0 | 0 | FIX |
| sindang | 27 | 27 | 0 | 0 | 0 | OK |
| daechi | 6 | 6 | 0 | 0 | 0 | OK |
| nondhyeon | 7 | 6 | 2 | 1 | 0 | FIX |
| yanggeun | 4 | 4 | 0 | 0 | 0 | OK |
| pung | 5 | 3 | 2 | 0 | 0 | FIX |
| gangil | 9 | 3 | 6 | 0 | 0 | FIX |
| neung | 8 | 3 | 5 | 0 | 0 | FIX |
| ami | 21 | 12 | 11 | 2 | 0 | FIX |
| mokdong | 2 | 2 | 0 | 0 | 0 | OK |
| yangjae | 2 | 0 | 2 | 0 | 0 | FIX |
| dongseong | 4 | 0 | 4 | 0 | 0 | FIX |
| cheongdam | 6 | 0 | 6 | 0 | 0 | FIX |

## Evidence and scope

- source-manifest.json: original detail URL, ordered Wix IDs and final Storage paths. Original URL is https://static.wixstatic.com/media/{asset}; extension is the asset suffix. Array order is display order (one-based).
- before.json: original DB image arrays, retained for rollback.
- audit-before.json: exact missing and non-source references.
- restore-images.sql: guarded data-only changes; no schema/RLS/auth changes. Applied after all Storage uploads were verified; only the nine existing project arrays were updated.
- Existing identical Storage objects are reused without uploading them again. DB array order is authoritative; existing filenames are retained to avoid breaking references. New filenames use original display-order numbers.
- Seven existing references are absent from their source detail galleries. Their DB associations were removed; their original Storage files are retained as rollback evidence, not deleted based on an inferred project identity.
- User subsequently deferred all three missing projects (yangjae, dongseong, cheongdam). They were NOT inserted into the CMS. Their 12 original images are staged in Storage only. No metadata was invented.
- The existing detail hero repeats the first gallery image as part of the established layout. Gallery assets are counted independently from that unchanged hero presentation.

## Final scope and verification

- Existing 15 projects: 157 → 224 image references; 74 missing images added, 7 references absent from source details removed, 0 duplicate references.
- All 18 source details contain 236 images. Three user-deferred projects account for 12 staged images; full-site equality is intentionally deferred.
- Storage uploads: 86 originals (74 approved existing-project images + 12 staged for deferred projects), 86,338,628 bytes. All decoded dimensions checked. No existing image asset was reuploaded.
- Storage image objects without DB references: 19, consisting of 7 retained rollback images + 12 user-deferred project images. One Storage folder placeholder is not an image. DB orphans: 0.
- Desktop 1440px and mobile 390px: all 15 published project detail galleries loaded, no broken images, no horizontal overflow, exact original asset order. The initial pending loads for haengdang/goun/ami completed and were rechecked.
- Public HEAD checks: all 236 source-image Storage paths returned 200; the read-only verify.cjs passed for the 224 published gallery images.
- Original Wix discovery was repeated after recovery: 18 project URLs, no additional missed projects.
- Existing SSR smoke tests passed. No dedicated CMS test suite exists; CMS/UI/auth/RLS/schema code was not changed.
- Runtime source files, styling, routing, SEO, authentication, Vercel configuration and hero selections were not changed.

Run read-only validation from repository root: node migration-audit/verify.cjs
