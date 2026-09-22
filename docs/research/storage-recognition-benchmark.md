# Storage recognition benchmark MVP

## Decision

Proceed with an MVP for **native Switch screenshots**. Keep phone-camera import outside the first recognition release.

The native screenshot recognizer cleared the pre-agreed known-item gate while searching all 1,765 catalog images:

| Measure                             |         Result |                                 Gate |
| ----------------------------------- | -------------: | -----------------------------------: |
| Unique screenshots                  |              6 |                                    — |
| Exact duplicate screenshots         |     4 excluded |                                    — |
| Chests / pages per chest            |          2 / 3 |                                    — |
| Occupied slots                      |            106 |                                    — |
| Manually verified recognition slots |             30 |                                  ≥30 |
| Top-1 accuracy                      |  29/30 (96.7%) |                                 ≥90% |
| Top-3 accuracy                      | 30/30 (100.0%) |                                 ≥98% |
| Unknown-item rejection              |  Not evaluated | Required before automatic acceptance |

The one top-1 miss was **Tabletop mic**, which ranked second behind Nugget. The correct item still appeared in the review set.

This clears the MVP feasibility gate; it does not establish production accuracy. The labeled set contains only two chests from one game build and capture setup. The UI must show proposed matches for review, and low-confidence results must remain unresolved until an unknown-item dataset establishes a threshold.

## Recognition pipeline tested

1. Validate each screenshot as the expected 1920 x 1080 native frame.
2. Crop the fixed 2 x 10 storage grid.
3. Build a median storage-slot background from the 106 occupied slots.
4. Isolate each item's foreground shape from that background.
5. Retrieve 100 candidates using color, silhouette, and aspect similarity.
6. Retrieve 400 additional candidates using an eight-table ORB descriptor index.
7. Rerank the combined shortlist using exact ORB keypoint matching plus the color/shape score.
8. Return the best match and four alternatives for user review.

OCR is not the item recognizer. It can read the selected item's name, but most slots contain only an icon and quantity. The successful path matches icon appearance against the local catalog.

## Dataset construction

The ten supplied files contain six unique screenshots and four byte-identical duplicates. The unique pages represent two Big storage boxes:

- Chest A: 20 + 20 + 20 occupied slots
- Chest B: 20 + 20 + 6 occupied slots

Thirty labels were assigned by visually comparing screenshot slots with the bundled catalog images before the final gated run. Labels, page layout, duplicate declarations, retrieval limits, and gates are versioned in `benchmarks/storage-recognition/native-switch-manifest.json`.

The benchmark uses the six unique pages when estimating the shared slot background. Duplicate files are hash-checked and excluded from scoring.

## Camera-photo benchmark remains a no-go

The original three handheld camera photos produced:

| Measure            |      Result |
| ------------------ | ----------: |
| Labeled slots      |           3 |
| Catalog candidates |       1,765 |
| Top-1 accuracy     | 1/3 (33.3%) |
| Top-3 accuracy     | 2/3 (66.7%) |
| Top-30 recall      |  3/3 (100%) |

The known-item ranks were Fluff 1, Metal drum 26, and Asphalt road 2. Camera framing, perspective, blur, moire, status badges, and quantity text make this a separate recognition problem. The native result must not be used to claim phone-camera support.

## Remaining gate: unknown and new DLC items

The current dataset contains only catalog items, so it cannot measure false matches for items absent from the catalog. Before automatic acceptance:

1. Add at least 30 non-catalog or deliberately held-out item crops.
2. Measure how top score and top-two margin separate known from unknown items.
3. Select a threshold against a declared false-accept target.
4. Keep below-threshold items unresolved and let the user save a local custom item in IndexedDB.
5. Never add a user's correction to the shipped global catalog without a separate development review and catalog release.

Until that calibration exists, the product should treat every recognition result as a proposal that the user confirms or edits.

## Run both benchmarks

Native Switch screenshots in `docs/research/storage-samples`:

```bash
npm run benchmark:storage-native
```

Optional paths:

```bash
npm run benchmark:storage-native -- \
  --input-dir /path/to/native-screenshots \
  --output-dir /path/to/output
```

The command writes `results.json` and `report.html` to `.artifacts/storage-recognition-native` by default.

Original camera photos in `~/Downloads`:

```bash
npm run benchmark:storage-recognition
```

The camera command writes its outputs to `.artifacts/storage-recognition`.
