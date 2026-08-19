# Photo Catalog Manager

The Photo Catalog Manager is a local developer CLI for the Work portfolio. It reads and writes structured JSON manifests, optimizes new images, and validates catalog and file integrity. It is not a browser CMS.

## Commands

```sh
npm run photo:manage
npm run photo:add -- ~/Desktop/photo.jpg
npm run photo:add -- ~/Desktop/photo.jpg --dry-run
npm run photo:edit -- IMG_1234
npm run photo:edit -- IMG_1234 --dry-run
npm run photo:audit
npm run photo:validate
npm run photo:verify-migration
npm run photo:test
```

`photo:validate` is non-interactive and exits non-zero when the catalog is invalid. Add and Edit always validate the proposed state before an atomic write. The production build is optional after an individual change.

## Add

Add inspects the source before asking curatorial questions. The questionnaire explains the taxonomy, supports Back navigation, requires useful alt text, asks for an explicit location/year decision, supports curated insertion order, and ends with a review screen. Nothing is written before confirmation.

The source file is read-only: it is never modified, moved, or deleted. The output is a new JPEG in the canonical category folder. Filename collisions and duplicate `src` values are rejected rather than overwritten.

Use `--dry-run` to complete inspection, classification, processing in memory, review, and validation without writing any file.

## Image defaults

Settings live in `scripts/photo-manager/config.mjs`:

- long edge: at most 2200px; smaller images are never enlarged
- output: progressive JPEG, quality 82, mozjpeg optimization
- color: converted to sRGB
- orientation: EXIF orientation is normalized
- metadata: GPS and other private EXIF are stripped from output
- large-file warning: 900 KB
- input: JPEG, PNG, and WebP

Transparent PNG/WebP input requires explicit approval before transparent pixels are flattened onto white. RAW, CR3, and HEIC are intentionally unsupported.

Existing portfolio images are not automatically reprocessed.

## Taxonomy

Primary Work placement is deterministic:

- People / Portraits: `portraits.json`; `session` slug plus `theme: bright | moody`
- People / Events: `events.json`; `category` slug
- Places / Street: `places.json`; `theme: street`
- Places / Landscape: `places.json`; `theme: green | water`, without `habitat: true`
- Places / Light: `places.json`; `theme: night`
- Wildlife / Animals: `places.json`; `theme: wildlife`, without `habitat: true`
- Wildlife / Habitat: `places.json`; `habitat: true` and `theme: green | water | wildlife`
- Objects / Product or Still Life: `objects.json`; explicit `section`
- Spaces / Real Estate or Interiors: `spaces.json`; explicit `section`

Landscape means the environment remains fundamentally the same photograph without incidental wildlife. Habitat means wildlife and environment are both essential. Habitat routing uses the explicit flag; it never depends on array slicing or record order.

New photos use canonical folders under `public/images/portraits`, `events`, `places`, `objects`, or `spaces`. Reclassification preserves an existing physical path. This avoids breaking references and is safe because runtime taxonomy does not depend on folder names.

## Metadata and audit semantics

The shared schema is `src/data/photoSchema.js`.

Required fields:

- `src`
- `alt`
- `width`
- `height`

Recommended fields:

- `location`
- `year`

For recommended metadata, an absent property means “not reviewed” and remains in future audits. `null` means “intentionally no value” and is not asked again. A string or year is the reviewed visible value. GPS is never used to populate location.

Audit distinguishes manual metadata from intrinsic image facts. Missing or incorrect dimensions are read from the actual image and offered as an automatic repair. File review reports missing, corrupt, oversized, unusually large, and orphaned files; it never deletes an orphan automatically. Each accepted correction is saved transactionally, so quitting midway keeps earlier saves.

To introduce a future field such as `camera`, add its definition and tier to `photoFields` in `src/data/photoSchema.js`. Generic audit discovery will then flag records where a recommended field is absent. Add a specialized prompt only if the field needs more than ordinary text/null review.

## Edit and secondary placements

Edit searches case-insensitively by filename, `src`, alt text, location, major category, and subsection. Classification uses the same guided questionnaire as Add. Review shows a before/after diff. Existing files are not recompressed or physically moved.

Secondary image pointers live in `src/data/photos/sitePlacements.json`:

- Work index hover previews are available for all five major categories.
- Homepage Featured is available for People, Places, and Wildlife; existing editorial title/footer copy stays hand-authored, while alt text comes from the selected catalog record.
- Legacy category covers are available for Portraits, Events, and Places.

All optional placements default off on Add. Validation ensures every secondary pointer resolves to a managed catalog record and file.

## Storage and transactions

Mutable catalogs live in `src/data/photos/*.json`; `src/data/galleries.js` preserves the public exports consumed by the site. Array order remains display order.

For a write, every changed JSON document and image is first staged beside its destination. Existing files are moved to temporary backups, staged files are renamed atomically, and backups remain until all commits succeed. Any failure restores prior files and removes staged artifacts. A new image target is marked `mustNotExist`, closing the final overwrite race.

Hero layers in `public/images/hero`, About images, and Book images are outside this manager. The tool does not audit or process them.
