# Sector reference geometry

- gurugram_sectors_source.geojson: normalized snapshot of the public GMDA-derived sector geometry at https://github.com/XAE-A-Xii/expressway/blob/main/gurugram_sectors.geojson.
- sector_coordinates.json: 102 exact-label sector polygon centroids with source checksum and attribution.
- sector_fallback_geocodes.json: six reviewed OpenStreetMap locality/road references, lookup URLs, source URLs, retrieval timestamp and ODbL attribution. Wrong Sector 62/Manesar matches were rejected; Sector 9 uses verified OSM place node 2733423637.

app/analytics.py resolves the remaining labels through reviewed locality references, normalization of New Sector/phase/duplicate-road strings, parent Sector 17 for 17A/B, and a disclosed city-level anchor for the ambiguous name `new`.

All 115 original labels have map display positions; this is not a claim of 115 exact geocodes. `new` remains an unresolved location even though its city-reference icon can be displayed. Statistics retain each original label independently. Shared coordinates are never changed to avoid icon overlap; icons fan out in screen pixels only.

Raw/processed listing files and model artifacts are unchanged. See docs/ANALYTICS_MODULE.md for analytical definitions, attribution, limitations and offline sector-geometry reproduction.
