# PropVision AI: inspected model and production contract

## Inspection findings

Source of truth: code and persisted outputs in notebooks 02, 04, 05, 06, 07, 08 and 09; CSV contents were checked directly. The final training source is `data/processed/gurgaon_properties_post_feature_selection_v2.csv`: **3,554 rows, 12 predictors plus price, no missing values**. `price` is in INR crores. The non-v2 feature-selection CSV contains already encoded categories and must not be substituted.

| Final predictor | JSON type | Meaning / observed vocabulary |
|---|---|---|
| property_type | string | flat, house |
| sector | string | 115 observed location labels; exact vocabulary in bundle metadata |
| bedRoom | integer | Bedroom count |
| bathroom | integer | Bathroom count |
| balcony | string | "0", "1", "2", "3", "3+" |
| agePossession | string | Moderately Old, New Property, Old Property, Relatively New, Under Construction |
| built_up_area | number | Square feet |
| servant room | integer | Binary presence, 0 or 1 |
| store room | integer | Binary presence, 0 or 1 |
| furnishing_type | string | furnished, semifurnished, unfurnished |
| floor_category | string | High-Rise, Low-Rise, Mid-Rise |
| luxury_category | string | Luxury, Premium, Standard |

Raw CSV order ends with `furnishing_type, floor_category, luxury_category`. Notebook 09's manually written validation column list swaps the last two; named ColumnTransformer selection makes this harmless. The exporter fixes CSV order as the canonical contract.

The attached `dataset_schema_inventory.json` records every processed CSV's shape, types, and missing counts, including earlier cleaned schema. In particular, `gurgaon_properties_cleaned_v2.csv` has 3,803 rows and 23 columns:

* Numeric: price, price_per_sqft, area, bedRoom, bathroom, floorNum, super_built_up_area, built_up_area, carpet_area, study room, servant room, store room, pooja room, others, furnishing_type, luxury_score.
* Text/category: property_type, society, sector, areaWithType, balcony, facing, agePossession.

`location`, `bhk`, `bath`, `furnishing_status`, `Super_Built_Up_Area` and `Carpet_Area` are not final notebook column names. The first four are aliases introduced by the existing seven-feature API baseline; actual extracted area names are lowercase.

## Feature engineering and missing data

Notebook 02 extracts super built-up area using `Super Built up area (\d+\.?\d*)`; built-up/carpet use the requested area label followed by `\s*:\s*(\d+\.?\d*)`. It checks parenthesized square metres and converts with 10.7639; plot-only fallbacks use `Plot area (\d+\.?\d*)`, with area-ratio heuristics multiplying by 9 or 10.7. These are historical notebook rules, not a general unit parser.

Additional-room flags come from text containment. Furnishing counts use `(\d+) <furnishing>` and explicit `No <furnishing>` handling, then StandardScaler and KMeans(n_clusters=3, random_state=42). The notebook comments map cluster IDs 0/1/2 to unfurnished/semifurnished/furnished; these are cluster assignments, not guaranteed semantic labels. The final CSV already has text labels; exporter consumes those directly. No fitted furnishing clusterer was found among the root artifacts.

Age strings become New Property, Relatively New, Moderately Old, Old Property or Under Construction; unresolved values become Undefined. Luxury score is a weighted amenity sum (weight dictionary in notebook 02 cell 69). Notebook 06 bins score [0,50) as Standard, [50,100) as Premium and [100,175] as Luxury. Floor 0–4 is Low-Rise, 5–15 Mid-Rise, 16–51 High-Rise.

Notebook 05 fills built-up area from super built-up / 1.105 and carpet / 0.9, averaging the two estimates when both exist and rounding. It also replaces built-up area with `area` for the historical anomaly rule built-up < 2000 and price > 2.5 crore. It fills floorNum with 2.0, drops facing and one missing-society row, and imputes Undefined age by modes grouped first by sector/property type, then sector, then property type. It drops area, areaWithType, super_built_up_area, carpet_area and area_room_ratio. Feature selection drops society, price_per_sqft, study room, pooja room and others, replacing floorNum/luxury_score with categories.

These transformations happened offline before splitting. The fitted export preprocessor starts with the final CSV; it does not contain the regex parser, KMeans, outlier treatment or these imputation rules. Serving should require the 12 completed features initially. Deriving built-up area for new listings requires a separately validated rule set; the historical price-dependent anomaly correction cannot be applied to an unknown-price prediction request.

## Exact champion preprocessing and model

Notebook 09 cells 6 and 14 define this ordered ColumnTransformer, with remainder='passthrough':

1. StandardScaler on bedRoom, bathroom, built_up_area, servant room, store room: 5 outputs.
2. OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1) on property_type, sector, balcony, agePossession, furnishing_type, luxury_category, floor_category: 7 outputs. Categories follow fitted encoder ordering, not a manually assigned ordinal scale.
3. OneHotEncoder(drop='first', sparse_output=False, handle_unknown='ignore') on agePossession: 4 outputs.
4. category_encoders.TargetEncoder() on sector: 1 output. Defaults are preserved and package versions recorded. Its training y is **raw crores**, since target transformation is inside the downstream regressor.

All 12 inputs are selected, so no remainder columns are emitted. Total: **17 model inputs**, with exact names in `model_metadata.json`. Sector and age deliberately appear in multiple representations; removing this duplication would change the tuned pipeline. Unknown sectors receive ordinal -1 and the fitted target encoder's fallback; unknown ages receive ordinal -1 and all-zero one-hot indicators. Prefer validated category dropdowns and explicit unsupported-location handling over silent fallback.

| XGBoost parameter | Tuned value |
|---|---:|
| n_estimators | 500 |
| learning_rate | 0.04012240724057226 |
| max_depth | 7 |
| subsample | 0.7448228969369078 |
| colsample_bytree | 0.8027275970188548 |
| reg_alpha | 0.10847831041061963 |
| reg_lambda | 0.01840970025222743 |
| random_state | 42 |
| n_jobs | -1 |

Other settings remain installed XGBRegressor defaults (resolved values are recorded in metadata). The regressor trains on log1p(price in crores), using TransformedTargetRegressor with expm1 inverse. Export saves its fitted inner XGBRegressor, so **JSON predictions require expm1 before conversion to rupees**.

Optuna: 50 trials across XGBoost, RandomForest and ExtraTrees; KFold(5, shuffle=True, random_state=42), minimizing price-space MAE. Recorded winner CV MAE: 0.4725 crore. The 80/20 split with random_state=42 gives 2,843 train / 711 test rows, MAE 0.4181702854 crore and price-space R² 0.8307404958 on this rerun, matching notebook output. The exporter then refits on all 3,554 rows.

The split was drawn after tuning on all rows, and upstream preprocessing includes data-wide and target-dependent decisions. These numbers are useful reproduction checks, not independent deployment accuracy estimates. Reserve fresh temporal/geographic data for final validation. Target encoding is fitted within each CV training fold but is not internally cross-fitted for training rows.

## Retained research baselines

Notebook 07 records SVR(kernel='rbf') with ten-fold log-target R-squared 0.887093 and holdout MAE 0.495489 crore. Notebook 08 records target-encoded RandomForest, ExtraTrees and XGBoost baseline holdout MAEs of 0.435123, 0.446647 and 0.470663 crore respectively. These use different evaluation/target-encoding setups and are research references, not serving artifacts. The obsolete seven-feature API baseline and its root-level model copies have been removed.

## Prediction artifact contract

The preserved serving bundle is artifacts/tuned_v1/. FastAPI loads model_metadata.json, preprocessor.pkl and xgboost_model.json. It validates checksums, ordered raw/transformed feature names, category vocabularies, model dimensions and a sample prediction at startup. The original property_embeddings.pkl remains untouched for bundle provenance but is inactive; no recommendation code or endpoint depends on it.

Run `python scripts/export_artifacts.py --output-dir artifacts/tuned_v2` only when intentionally training a new version. The script exports prediction artifacts and dependency metadata to a NEW directory and refuses to overwrite any existing directory. It fits the preprocessor within the evaluation training split, evaluates in price space, then refits on all rows. Existing tuned_v1 files are never modified by this workflow.

Exact POST /predict-price (FastAPI) or POST /api/predict (Express) JSON:

```json
{
  "property_type": "house",
  "sector": "sector 5",
  "bedRoom": 2,
  "bathroom": 2,
  "balcony": "1",
  "agePossession": "Old Property",
  "built_up_area": 900.0,
  "servant room": 0,
  "store room": 0,
  "furnishing_type": "semifurnished",
  "floor_category": "Low-Rise",
  "luxury_category": "Standard"
}
```

Alignment: require all 12 keys, reject extras/nulls/nonfinite values, require positive integral bedrooms/bathrooms, positive square-foot area and binary room flags. Use category spellings from metadata. Construct the DataFrame in metadata.feature_columns order and call the saved transformer's transform only. JSON key order is irrelevant; Node must not fit encoders or scale inputs.

Prediction arithmetic: `expm1(model.predict(preprocessor.transform(frame))) * 10_000_000`. Check finite/nonnegative output and round only at the response boundary. Training in rupees before log1p would change the model; preserve crore training units.

Response fields: predicted_price_inr (number), formatted_price (string) and log_prediction (number). Express forwards that response without a second inverse transform. GET /health exposes JSON-safe model metadata. GET /api/schema-options exposes its dynamic categories through Express, cached for 60 seconds.

## Current application scope

React -> Express -> FastAPI is the supported price prediction path. MongoDB connection setup and a general Property schema remain in Express, but inference does not depend on listing hydration or query logging. Recommendation routes/components, placeholder listing cards and recommendation generation have been removed. Analytics and Market Insights now use the processed dataset via the separately documented Analytics Module; see ANALYTICS_MODULE.md. See ARCHITECTURE.md for component ownership and the root README for setup commands.
