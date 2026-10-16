"""Collect RA2/YR build-menu icons and unit mappings from a local installation."""
import argparse
import csv
import hashlib
import html
import json
import math
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from cnc_assets import Mix, database, decode_shp, mix_hash, parse_csf, parse_ini

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets/unit-icons'
ALLIED = {'Americans', 'British', 'French', 'Germans', 'Alliance'}
SOVIET = {'Russians', 'Arabs', 'Africans', 'Confederation'}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def children(archive, names):
    return [Mix(archive.get(name), archive.source + '::' + name) for name in names]


def fetch(archives, name):
    for archive in reversed(archives):
        data = archive.get(name)
        if data is not None:
            return data, archive.source
    return None, None


def collect_version(version, resources, cameo_archives, names, rules_name, art_name, text_name):
    folder = DEST / version
    rules_data, rules_source = fetch(resources, rules_name)
    art_data, art_source = fetch(resources, art_name)
    text_data, text_source = fetch(resources, text_name)
    palette, palette_source = fetch(resources, 'cameo.pal')
    if not all([rules_data, art_data, text_data, palette]):
        raise ValueError('Required game metadata or palette missing: ' + version)
    rules, art, labels = parse_ini(rules_data), parse_ini(art_data), parse_csf(text_data)
    all_names = set(names)
    for section in art.values():
        for key in ['CAMEO', 'ALTCAMEO', 'ELITECAMEO']:
            if key in section and section[key].lower() != 'none':
                all_names.add(section[key].lower().removesuffix('.shp') + '.shp')
    (folder / 'raw').mkdir(parents=True, exist_ok=True)
    (folder / 'raw/cameo.pal').write_bytes(palette)
    # Local database names augment the XCC global database when present.
    for archive in cameo_archives:
        local = archive.get('local mix database.dat')
        if local:
            count = int.from_bytes(local[48:52], 'little')
            all_names.update(s.decode('ascii').lower() for s in local[52:].split(b'\0')[:count])
    icon_records = {}
    for name in sorted(all_names):
        if not re.fullmatch(r'[a-z0-9_-]+\.shp', name):
            continue
        data, source = fetch(cameo_archives, name)
        if data is None:
            continue
        image, meta = decode_shp(data, palette)
        out = folder / 'cameos' / (name[:-4] + '.png')
        out.parent.mkdir(parents=True, exist_ok=True)
        image.save(out, optimize=True)
        raw = folder / 'raw' / name
        raw.write_bytes(data)
        frames = [out.relative_to(ROOT).as_posix()]
        for frame in range(1, meta['frames']):
            extra, _ = decode_shp(data, palette, frame)
            path = out.with_name(name[:-4] + '-frame-' + str(frame + 1) + '.png')
            extra.save(path, optimize=True)
            frames.append(path.relative_to(ROOT).as_posix())
        icon_records[name] = dict(filename=name, path=frames[0], framePaths=frames,
            rawPath=raw.relative_to(ROOT).as_posix(), sourceArchive=source,
            sourceHash='%08X' % mix_hash(name), shpSha256=sha(data), pngSha256=sha(out.read_bytes()),
            paletteSource=palette_source, paletteSha256=sha(palette), **meta)
    # Verify every entry in both cameo banks has a resolved filename and decoded PNG.
    unresolved = []
    for archive in cameo_archives:
        known = {mix_hash(name) for name in icon_records}
        for key in archive.entries:
            if key not in known and key != mix_hash('local mix database.dat'):
                unresolved.append({'archive': archive.source, 'hash': '%08X' % key})
    if unresolved:
        raise ValueError('Unresolved cameo entries: ' + str(unresolved))
    units, buildings, missing = [], [], []
    for registry, category in [('INFANTRYTYPES', 'infantry'), ('VEHICLETYPES', 'vehicle'),
                               ('AIRCRAFTTYPES', 'aircraft'), ('BUILDINGTYPES', 'building')]:
        for unit_id in rules.get(registry, {}).values():
            values = rules.get(unit_id.upper(), {})
            image_id = values.get('IMAGE', unit_id)
            visual = art.get(image_id.upper(), {})
            owners = [owner.strip() for owner in values.get('OWNER', '').split(',') if owner.strip()]
            factions = []
            if ALLIED.intersection(owners): factions.append('allied')
            if SOVIET.intersection(owners): factions.append('soviet')
            if 'YuriCountry' in owners: factions.append('yuri')
            record = dict(id=unit_id, name=labels.get(values.get('UINAME', '').lower(), values.get('NAME', unit_id)),
                internalName=values.get('NAME'), imageId=image_id, category=category, owners=owners, factions=factions,
                techLevel=values.get('TECHLEVEL'), prerequisite=values.get('PREREQUISITE'),
                normal=None, elite=None, rulesSource=rules_source, artSource=art_source)
            for kind, key in [('normal', 'CAMEO'), ('elite', 'ALTCAMEO')]:
                cameo = visual.get(key, visual.get('ELITECAMEO') if kind == 'elite' else None)
                if not cameo or cameo.lower() == 'none':
                    continue
                name = cameo.lower().removesuffix('.shp') + '.shp'
                if name not in icon_records:
                    # Art can reference an icon from another archive outside the cameo banks.
                    data, source = fetch(resources, name)
                    if data:
                        image, meta = decode_shp(data, palette)
                        path = folder / 'cameos' / (name[:-4] + '.png'); image.save(path, optimize=True)
                        raw = folder / 'raw' / name; raw.write_bytes(data)
                        icon_records[name] = dict(filename=name, path=path.relative_to(ROOT).as_posix(),
                            rawPath=raw.relative_to(ROOT).as_posix(), sourceArchive=source, shpSha256=sha(data),
                            pngSha256=sha(path.read_bytes()), paletteSource=palette_source, **meta)
                icon = icon_records.get(name)
                if not icon:
                    missing.append({'id': unit_id, 'category': category, 'reference': name, 'kind': kind})
                    record[kind + 'Status'] = 'referenced-file-missing'
                    continue
                directory = 'buildings' if category == 'building' else 'units'
                if kind == 'elite': directory += '/elite'
                target = folder / directory / (unit_id.lower() + '.png')
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes((ROOT / icon['path']).read_bytes())
                record[kind] = dict(path=target.relative_to(ROOT).as_posix(), cameo=name,
                                   sourceArchive=icon['sourceArchive'], pngSha256=icon['pngSha256'])
            if not record['normal']:
                record.setdefault('normalStatus', 'not-defined-in-art')
            (buildings if category == 'building' else units).append(record)
    manifest = dict(version=version, units=units, buildings=buildings, cameos=list(icon_records.values()),
        missingReferences=missing, metadata=dict(rulesSource=rules_source, rulesSha256=sha(rules_data),
        artSource=art_source, artSha256=sha(art_data), textSource=text_source, textSha256=sha(text_data)))
    write_json(folder / 'manifest.json', manifest)
    with (folder / 'units.csv').open('w', encoding='utf-8-sig', newline='') as stream:
        columns = ['id', 'name', 'category', 'techLevel', 'normalPath', 'elitePath', 'normalStatus']
        writer = csv.DictWriter(stream, fieldnames=columns)
        writer.writeheader()
        for unit in units:
            writer.writerow({key: unit.get(key, '') for key in columns[:4]} | {
                'normalPath': unit['normal']['path'] if unit['normal'] else '',
                'elitePath': unit['elite']['path'] if unit['elite'] else '',
                'normalStatus': unit.get('normalStatus', 'collected')})
    return manifest


def previews(manifest):
    version = manifest['version']
    entries = [u for u in manifest['units'] if u['normal']]
    font_path = Path('C:/Windows/Fonts/msyh.ttc')
    font = ImageFont.truetype(str(font_path), 13)
    small = ImageFont.truetype(str(font_path), 10)
    cols, cell_w, cell_h = 8, 144, 142
    canvas = Image.new('RGB', (cols * cell_w, 64 + math.ceil(len(entries) / cols) * cell_h), '#172125')
    draw = ImageDraw.Draw(canvas)
    draw.text((20, 18), ('红警 2 原版' if version == 'ra2' else '尤里的复仇') + ' · 单位普通图标', font=font, fill='#f3eee7')
    for i, unit in enumerate(entries):
        x, y = i % cols * cell_w, 64 + i // cols * cell_h
        icon = Image.open(ROOT / unit['normal']['path']).resize((120, 96), Image.Resampling.NEAREST)
        canvas.paste(icon, (x + 12, y))
        label = unit['name']
        draw.text((x + 12, y + 99), label[:9], font=font, fill='#f3eee7')
        draw.text((x + 12, y + 119), unit['id'], font=small, fill='#a7b7bb')
    out = ROOT / 'docs' / ('单位图标预览-' + version + '.png')
    canvas.save(out, optimize=True)


def gallery(manifests):
    blocks = []
    for manifest in manifests:
        version = manifest['version']
        cards = []
        for unit in manifest['units']:
            if not unit['normal']: continue
            path = '../' + unit['normal']['path']
            elite = '<img alt="三星图标" src="../' + unit['elite']['path'] + '">' if unit['elite'] else ''
            cards.append('<article><div><img src="' + path + '" alt="普通图标">' + elite + '</div><strong>'
                         + html.escape(unit['name']) + '</strong><small>' + html.escape(unit['id'] + ' · ' + unit['category']) + '</small></article>')
        bank = ''.join('<article><img src="../' + c['path'] + '" alt="' + html.escape(c['filename'])
                       + '"><small>' + html.escape(c['filename']) + '</small></article>' for c in manifest['cameos'])
        blocks.append('<h2>' + ('红警 2 原版' if version == 'ra2' else '尤里的复仇') + '</h2><section>' + ''.join(cards)
                      + '</section><details><summary>全部菜单图标（含建筑、超武及遗留图标）</summary><section>' + bank + '</section></details>')
    template = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>红警单位图标素材库</title><style>
body{margin:24px;background:#172125;color:#f3eee7;font:14px system-ui,'Microsoft YaHei',sans-serif}h1{font-size:26px}h2{margin-top:40px}section{display:flex;flex-wrap:wrap}article{width:180px;padding:12px;margin:5px;border:1px solid #405056;border-radius:5px}img{width:120px;height:96px;image-rendering:pixelated;object-fit:contain}article div{display:flex;flex-wrap:wrap}article div img{width:80px;height:64px}strong,small{display:block;margin-top:8px}small{color:#a7b7bb;word-break:break-all}summary{cursor:pointer;padding:15px}</style><h1>红警 2 / 尤复 · 单位图标素材库</h1><p>普通图标在前，三星图标在后。来源为本机游戏资源；无独立图标的单位见各版本清单。</p>CONTENT</html>'''
    (ROOT / 'docs/单位图标素材库.html').write_text(template.replace('CONTENT', ''.join(blocks)), encoding='utf-8')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--game-dir', type=Path, default=Path('D:/Red_Alet_II/YURI'))
    parser.add_argument('--database', type=Path, default=Path('D:/Red_Alet_II/Utilities/global mix database.dat'))
    args = parser.parse_args()
    names = database(args.database)
    roots = {name: Mix.open(args.game_dir / name) for name in ['ra2.mix', 'ra2md.mix', 'language.mix', 'langmd.mix', 'expandmd01.mix']}
    base = children(roots['ra2.mix'], ['local.mix', 'cache.mix', 'conquer.mix', 'generic.mix'])
    expansion = children(roots['ra2md.mix'], ['localmd.mix', 'cachemd.mix', 'conqmd.mix', 'genermd.mix'])
    cameo = children(roots['language.mix'], ['cameo.mix'])
    cameomd = children(roots['langmd.mix'], ['cameomd.mix'])
    ra2 = collect_version('ra2', base + [roots['language.mix']] + cameo, cameo, names, 'rules.ini', 'art.ini', 'ra2.csf')
    yr = collect_version('yr', base + expansion + [roots['language.mix'], roots['langmd.mix'], roots['expandmd01.mix']] + cameo + cameomd,
                         cameo + cameomd, names, 'rulesmd.ini', 'artmd.ini', 'ra2md.csf')
    manifests = [ra2, yr]
    for manifest in manifests:
        previews(manifest)
        stats = dict(version=manifest['version'], registeredUnits=len(manifest['units']),
                     unitsWithNormal=sum(bool(u['normal']) for u in manifest['units']),
                     unitsWithElite=sum(bool(u['elite']) for u in manifest['units']),
                     cameos=len(manifest['cameos']), missingReferences=len(manifest['missingReferences']))
        print(json.dumps(stats))
    gallery(manifests)
    write_json(DEST / 'collection.json', dict(sourceDirectory=str(args.game_dir), sourceType='local-game-mix',
        versions={m['version']: str((DEST / m['version'] / 'manifest.json').relative_to(ROOT)).replace('\\', '/') for m in manifests},
        archives=[dict(path=str(args.game_dir / name), sha256=sha((args.game_dir / name).read_bytes())) for name in roots],
        licenseStatus='Game assets retain their original rights; public-use conditions not determined here.',
        transformation='SHP frames decoded with game cameo.pal, 6-bit channels expanded by multiplication by 4; native dimensions, opaque RGB PNG.'))


if __name__ == '__main__':
    main()
