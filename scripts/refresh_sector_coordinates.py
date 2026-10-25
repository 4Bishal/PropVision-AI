"""Build approximate sector centroids from a public GMDA-derived GeoJSON.

No online geocoding at runtime. Use --source for an offline source snapshot.
"""
import argparse
import csv
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://raw.githubusercontent.com/XAE-A-Xii/expressway/main/gurugram_sectors.geojson'
PROVENANCE = 'https://github.com/XAE-A-Xii/expressway'


def ring_centroid(ring):
    cross = [(a[0] * b[1] - b[0] * a[1]) for a, b in zip(ring, ring[1:] + ring[:1])]
    area2 = sum(cross)
    if abs(area2) < 1e-12:
        raise ValueError('Degenerate sector polygon')
    x = sum((a[0] + b[0]) * c for a, b, c in zip(ring, ring[1:] + ring[:1], cross)) / (3 * area2)
    y = sum((a[1] + b[1]) * c for a, b, c in zip(ring, ring[1:] + ring[:1], cross)) / (3 * area2)
    return abs(area2), x, y


def geometry_centroid(geometry):
    # Sector-scale planar centroids are approximate reference locations only.
    polygons = [geometry['coordinates']] if geometry['type'] == 'Polygon' else geometry['coordinates']
    pieces = []
    for polygon in polygons:
        for i, ring in enumerate(polygon):
            weight, x, y = ring_centroid(ring)
            pieces.append((weight if i == 0 else -weight, x, y))
    total = sum(a for a, _, _ in pieces)
    return sum(a * y for a, _, y in pieces) / total, sum(a * x for a, x, _ in pieces) / total


def main(source=None):
    if source:
        content = source.read_bytes()
    else:
        req = urllib.request.Request(SOURCE, headers={'User-Agent': 'PropVisionAI-sector-reference/1.0'})
        with urllib.request.urlopen(req, timeout=30) as response:
            content = response.read()
    data = json.loads(content)
    with (ROOT / 'data/processed/gurgaon_properties_post_feature_selection_v2.csv').open() as handle:
        sectors = {row['sector'] for row in csv.DictReader(handle)}
    found = {}
    for feature in data['features']:
        properties = feature['properties']
        sector = 'sector ' + properties['sector'].lower()
        if properties.get('isGurugramNumbered') and sector in sectors:
            lat, lon = geometry_centroid(feature['geometry'])
            if not (28 < lat < 29 and 76 < lon < 78):
                raise ValueError('Unexpected sector coordinate')
            found[sector] = {'latitude': round(lat, 6), 'longitude': round(lon, 6),
                'source_url': PROVENANCE, 'method': 'approximate sector polygon centroid',
                'source_name': properties['displayName']}
    if not found:
        raise RuntimeError('No sector matches; existing lookup was not changed')
    output = ROOT / 'data/reference/sector_coordinates.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({'source': 'GMDA-derived sector boundaries via XAE-A-Xii/expressway',
        'source_url': SOURCE, 'provenance_url': PROVENANCE,
        'upstream_provider': 'Gurugram Metropolitan Development Authority (as attributed by source repository)',
        'source_sha256': hashlib.sha256(content).hexdigest(),
        'retrieved_at': datetime.now(timezone.utc).isoformat(),
        'coordinates': dict(sorted(found.items()))}, indent=2), encoding='utf-8')
    print(f'Saved {len(found)} of {len(sectors)} sector centroids to {output}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path)
    main(parser.parse_args().source)
