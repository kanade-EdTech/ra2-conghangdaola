"""Build the remaining registered-unit catalog; preserve the reviewed regular/T4 data."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED = {'HORNET':'航母舰载子机', 'ASW':'驱逐舰反潜子机'}
# These art.ini cameos depict another unit, rather than the listed character/vehicle.
# Keep their original paths for audit; show faction emblems instead.
BORROWED = dict(VLADIMIR='soviet',PENTGEN='allied',PRES='allied',SSRV='allied',
    ARND='allied',STLN='allied',RMNV='soviet',SLAV='yuri',YDOG='yuri',YADOG='yuri',
    TRUCKA='neutral',XCOMET='allied',VLAD='soviet',UTNK='soviet',SCHD='soviet',CARGOPLANE='neutral')
NAMES = dict(GHOST='海豹突击队',VLADIMIR='维拉迪摩将军',PENTGEN='五角大楼将军',PRES='美国总统',
    SSRV='特勤保镖',ARND='英雄',STLN='健美先生',RMNV='罗曼诺夫总理',LUNR='登月火箭员',
    SLAV='奴隶',YDOG='尤里军犬（苏军型）',YADOG='尤里军犬（盟军型）',TRUCKA='民用卡车',
    HIND='雌鹿运输直升机',VLAD='维拉迪摩指挥舰',PDPLANE='伞兵运输机',CARGOPLANE='战役运输机',
    BPLN='米格支援战机',SPYP='侦察机',XCOMET='隐藏测试战车',UTNK='未使用战车',SCHD='武装直升机（隐藏形态）')

def main():
    reviewed = json.loads((ROOT/'data/unit-catalog.json').read_text(encoding='utf-8'))
    normal = [u for u in reviewed if u['rankingPool'] in ('regular','t4')]
    known = {(u['version'],u['gameId']) for u in normal}
    others=[]; audit=[]
    for version in ('ra2','yr'):
        manifest=json.loads((ROOT/f'assets/unit-icons/{version}/manifest.json').read_text(encoding='utf-8'))
        for u in manifest['units']:
            gid=u['id'].upper()
            if (version,gid) in known: continue
            reason = '没有独立菜单图标' if not u.get('normal') else EXCLUDED.get(gid)
            audit.append(dict(version=version,gameId=gid,sourceName=u['name'],included=not bool(reason),
                reason=reason or '有图标的战役／平民／隐藏或特殊支援单位'))
            if reason: continue
            factions=u['factions']
            others.append(dict(id=f'unit:{version}:{gid}',gameId=gid,version=version,
                name=NAMES.get(gid,u['name']),sourceName=u['name'],kind='unit',rankingPool='others',
                faction=factions[0] if len(factions)==1 else 'neutral',factions=factions,
                categories=[u['category']],techStage=None,techLevelRaw=u['techLevel'],
                iconPath=None if gid in BORROWED else './'+u['normal']['path'],
                sourceIconPath='./'+u['normal']['path'],
                iconFaction=BORROWED.get(gid,factions[0] if len(factions)==1 else 'neutral'),
                iconReason='原菜单借用其他单位图，改用阵营标志' if gid in BORROWED else '原菜单图标',
                note='战役／平民／隐藏或特殊支援单位 · '+gid))
    (ROOT/'data/other-unit-catalog.json').write_text(json.dumps(others,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (ROOT/'data/other-unit-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    # Keep the regular/T4 generation script as the source for its own two pools.
    (ROOT/'src/data/others.js').write_text('(function(global){\n  global.RA2.units = global.RA2.units.concat('+json.dumps(others,ensure_ascii=False,separators=(',',':'))+');\n})(window);\n',encoding='utf-8')
    print(json.dumps({v:{'others':sum(u['version']==v for u in others),'withIcons':sum(u['version']==v and bool(u['iconPath']) for u in others)} for v in ('ra2','yr')}))

if __name__ == '__main__':
    # Compatibility entry point: use the current generator without overwriting legacy inputs.
    import runpy
    runpy.run_path(str(ROOT/'scripts/prepare-0.4-catalog.py'), run_name='__main__')
