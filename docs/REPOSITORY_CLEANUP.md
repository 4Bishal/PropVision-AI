# Repository cleanup audit

Scope: retain the working price predictor and research lineage; remove obsolete serving baselines, scratch outputs and the recommendation application feature. No Analytics module was created. MongoDB contents, local credentials, installed environments and dependency locks were preserved.

## Removed files and directories

- Root legacy API/trainer: main.py and train_api_model.py. They served a separate seven-feature baseline, incompatible with the canonical 12-feature model.
- Root duplicate baseline artifacts: model_metadata.json, preprocessor.pkl, xgboost_model.json and property_embeddings.pkl. The authoritative tuned_v1 bundle is untouched.
- folder_structure.txt: stale generated folder inventory.
- docs/GIT_COMMIT_CONTEXT.md: generated commit-writing notes, superseded by actual Git history and current docs.
- client/src/components/Recommendations.jsx and its exclusive CSS/helpers.
- Recommendation schemas/routes/runtime matrix loading in app/; recommendation service/controller/routes and ML-ID join field in server/. Recommendation-specific tests were removed and replaced with 404/scope regression checks.
- testfolder/: unreferenced compressed_data.csv.gz, compressed_data.csv/compressed_data.csv, gurgaon_10.7k.csv, output_file.xlsx and gemini-code-1784440619768.csv. The two CSVs actually referenced by the tuning notebook were moved before removing this folder.
- Root/docs/notebooks .ipynb_checkpoints, Python __pycache__, pytest cache and generated client build/test caches. Installed .venv and node_modules were kept and ignored.

## Moved and retained

- export_artifacts.py -> scripts/export_artifacts.py. Repository-relative data/output paths were updated; exporter now writes prediction artifacts only and refuses to overwrite existing directories.
- testfolder/gemini-code-1784438764358.csv -> data/validation/historical_prices_01.csv.
- testfolder/gemini-code-1784440780951.csv -> data/validation/historical_prices_02.csv.
- Notebook references were updated to the moved CSVs. The stale commented scratch-workbook export was removed. All numbered notebooks and all raw/processed data remain.
- The general server/models/Property.js and MongoDB connection remain available, with no recommendation-specific ID mapping.
- Existing artifacts/tuned_v1/property_embeddings.pkl remains preserved but inactive: no service requires it.

## Integrity verification

All five authoritative bundle files matched their pre-cleanup SHA-256 checksums byte-for-byte. No bundle file was regenerated, renamed or edited.

| File | Verified SHA-256 |
| --- | --- |
| model_metadata.json | `1070c774a09a1376015a34383d7870bb6d10b7274acf88440bcf3640742f4c0b` |
| preprocessor.pkl | `1b1c65adb0a7e77e8581c7b6b738a52178d32959278014c1bf3a8436db6488fe` |
| property_embeddings.pkl | `50dde980cca7809e323828a6bcad62b13b0113c7f9c8965627e2d062e583cb15` |
| requirements-lock.txt | `bc12f43e7a767a71a24990c883e8977d0f19feb6f03bf41377cf7f22b1306c27` |
| xgboost_model.json | `0cf90e4dd808d7a3c0cf50c943e5142d6a5ca106d36341b7bbca048fb006c6a8` |

## Verification performed

- Python: 25 tests passed, including category/numeric validation, log-to-INR conversion, integrity failure checks, new export/reload roundtrip, and prediction without a recommendation artifact.
- Express: 16 tests passed, including upstream error/timeout mapping and absence of /api/recommend.
- React: 8 tests passed, including dynamic options, exact payloads, outage/retry and predictor-only UI.
- Vite production build passed.
- Offline export --help resolved from scripts/ without broken root paths; a temporary prediction-only export loaded and predicted successfully.
- Live FastAPI startup succeeded on temporary port 18000; /health returned 200.
- Live Express npm run dev connected to the configured MongoDB and started on temporary port 15000. /api/schema-options returned 200.
- Live React npm run dev served HTTP 200 on temporary port 15173.
- Express -> FastAPI POST /api/predict returned predicted_price_inr 7778479.76 and formatted_price INR 77.78 Lakhs for the saved example payload.
- Retired /api/recommend and /recommend-properties returned 404.
- Git check-ignore confirmed server/.env, client/.env.local, .venv, node_modules, __pycache__ and dist exclusions. git ls-files --cached --ignored --exclude-standard returned no tracked ignored files. Example environment files and lockfiles remain eligible for Git.

Python tests still emit third-party deprecation warnings from category_encoders/pandas and the Starlette test client. There were no failed tests or application startup errors. Test services ran on temporary ports to avoid changing the user's standard-port services; owned temporary processes were stopped after verification.

No Git commit, history rewrite, model replacement or database mutation was performed.
