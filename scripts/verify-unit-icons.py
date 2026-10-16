"""Verify extracted icons against their game archive bytes and recorded hashes."""
import hashlib
import json
from pathlib import Path
from PIL import Image
from cnc_assets import Mix

ROOT = Path(__file__).resolve().parents[1]
archives = {}


def source(path):
    if path not in archives:
        parts = path.split('::')
        archive = Mix.open(parts[0])
        for part in parts[1:]:
            archive = Mix(archive.get(part), archive.source + '::' + part)
        archives[path] = archive
    return archives[path]


for version in ['ra2', 'yr']:
    manifest = json.loads((ROOT / 'assets/unit-icons' / version / 'manifest.json').read_text(encoding='utf-8'))
    for cameo in manifest['cameos']:
        raw = (ROOT / cameo['rawPath']).read_bytes()
        assert raw == source(cameo['sourceArchive']).get(cameo['filename']), cameo['filename']
        assert hashlib.sha256(raw).hexdigest() == cameo['shpSha256']
        data = (ROOT / cameo['path']).read_bytes()
        assert hashlib.sha256(data).hexdigest() == cameo['pngSha256']
        for path in cameo.get('framePaths', [cameo['path']]):
            with Image.open(ROOT / path) as image:
                assert image.size == (cameo['width'], cameo['height']), path
                assert image.mode == 'RGB', path
                image.verify()
    for unit in manifest['units'] + manifest['buildings']:
        for kind in ['normal', 'elite']:
            if unit[kind]:
                assert hashlib.sha256((ROOT / unit[kind]['path']).read_bytes()).hexdigest() == unit[kind]['pngSha256']
    missing_normal_units = [r for r in manifest['missingReferences'] if r['category'] != 'building' and r['kind'] == 'normal']
    assert not missing_normal_units, missing_normal_units
    print(version, 'archive bytes, hashes, PNG dimensions, unit mappings verified:', len(manifest['cameos']), 'cameos')
