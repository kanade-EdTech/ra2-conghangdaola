"""Prepare a reviewed production catalog without modifying source game archives."""
import json
from pathlib import Path
from cnc_assets import Mix, parse_ini

ROOT = Path(__file__).resolve().parents[1]
HOUSES = {'allied': ['British', 'French', 'Germans', 'Americans', 'Alliance'],
          'soviet': ['Russians', 'Confederation', 'Africans', 'Arabs'], 'yuri': ['YuriCountry']}
PRODUCERS = {'GAPILE': 'allied', 'GAWEAP': 'allied', 'GAYARD': 'allied',
             'NAHAND': 'soviet', 'NAWEAP': 'soviet', 'NAYARD': 'soviet',
             'YABRCK': 'yuri', 'YAWEAP': 'yuri', 'YAYARD': 'yuri'}
NAMES = dict(E1='美国大兵', E2='动员兵', SHK='磁爆步兵', ENGINEER='工程师', JUMPJET='火箭飞行兵',
    YURI='尤里', IVAN='疯狂伊文', DESO='辐射工兵', DOG='军犬', CLEG='超时空军团兵', SPY='间谍',
    CCOMAND='超时空突击队', PTROOP='心灵突击队', CIVAN='超时空伊文', YURIPR='尤里改',
    SNIPE='狙击手', TANY='谭雅', FLAKT='防空步兵', TERROR='恐怖分子', SENGINEER='工程师', ADOG='军犬',
    GHOST='海豹突击队', YENGINEER='工程师', GGI='重装大兵', INIT='尤里新兵', BORIS='鲍里斯',
    BRUTE='狂兽人', VIRUS='病毒狙击手', AMCV='盟军基地车', HARV='武装采矿车', APOC='天启坦克',
    HTNK='犀牛坦克', SAPC='苏军运输船', MTNK='灰熊坦克', CARRIER='航空母舰', V3='V3 火箭发射车',
    ZEP='基洛夫空艇', DRON='恐怖机器人', HTK='防空履带车', DEST='驱逐舰', SUB='台风潜艇',
    AEGIS='神盾巡洋舰', LCRF='盟军运输船', DRED='无畏级战舰', SHAD='夜鹰直升机', SQD='巨型乌贼',
    DLPH='海豚', SMCV='苏军基地车', TNKD='坦克杀手', TTNK='磁能坦克', CMIN='超时空采矿车',
    SREF='光棱坦克', HYD='海蝎', MGTK='幻影坦克', FV='多功能步兵车', DTRUCK='自爆卡车',
    ORCA='入侵者战机', BEAG='黑鹰战机', LTNK='狂风坦克', YHVR='尤里运输船', PCV='尤里基地车',
    SMIN='奴隶矿车', YTNK='盖特机炮坦克', BFRT='战斗要塞', TELE='磁电坦克', CAOS='混乱机器人',
    BSUB='雷鸣攻击潜艇', SCHP='武装直升机', MIND='精神控制车', DISK='镭射幽浮', ROBO='遥控坦克')
EXCLUDED = {'LUNR': '战役月球步兵；普通生产前置 NAPILE 不存在',
    'YDOG': '尤里国家限定但需要苏军兵营；属于占领工厂后的替代军犬，不列常规',
    'YADOG': '尤里国家限定但需要盟军兵营；属于占领工厂后的替代军犬，不列常规'}

def parts(value):
    return [x.strip().upper() for x in (value or '').split(',') if x.strip()]

def allowed(section, house):
    owners, required, forbidden = map(parts, [section.get('OWNER'), section.get('REQUIREDHOUSES'), section.get('FORBIDDENHOUSES')])
    return (not owners or house.upper() in owners) and (not required or house.upper() in required) and house.upper() not in forbidden

def classify(version, rules, manifest):
    rows, audit = [], []
    general = rules['GENERAL']
    aliases = {k.removeprefix('PREREQUISITE'): parts(v) for k, v in general.items()
               if k.startswith('PREREQUISITE') and not k.endswith('ALTERNATE')}
    def stage(node, house, visited=()):
        if node in ('GATECH', 'NATECH', 'YATECH', 'TECH'): return 2
        if node in ('GAAIRC', 'AMRADR', 'NARADR', 'NAPSIS', 'RADAR'): return 1
        if node in visited: raise ValueError('Prerequisite cycle: ' + node)
        if node in aliases:
            choices = [x for x in aliases[node] if allowed(rules.get(x, {}), house)]
            if node == 'BARRACKS': choices = [x for x in choices if PRODUCERS.get(x) == next(f for f,h in HOUSES.items() if house in h)]
            if not choices: raise ValueError('No legal prerequisite: ' + node)
            return min(stage(x, house, visited + (node,)) for x in choices)
        if node not in rules: raise ValueError('Unknown prerequisite: ' + node)
        return max([stage(x, house, visited + (node,)) for x in parts(rules[node].get('PREREQUISITE'))] or [0])
    for unit in manifest['units']:
        gid = unit['id'].upper(); s = rules.get(gid, {})
        evidence = {k:v for k,v in s.items() if k in ('OWNER','REQUIREDHOUSES','FORBIDDENHOUSES','TECHLEVEL',
            'PREREQUISITE','PREREQUISITEOVERRIDE','NAVAL','MOVEMENTZONE','CONSIDEREDAIRCRAFT','JUMPJET','BUILDLIMIT') or 'STOLEN' in k}
        reason = EXCLUDED.get(gid)
        if not reason and int(s.get('TECHLEVEL', '-1')) < 0: reason = 'TechLevel 未开放：战役／平民／派生／废弃条目'
        if not reason and not unit['normal']: reason = '无菜单图标及常规生产条目'
        stolen = [k for k,v in s.items() if k.startswith('REQUIRESSTOLEN') and v.lower() in ('yes','true')]
        pool = 't4' if stolen else 'regular'
        houses = [h for faction, members in HOUSES.items() for h in members
                  if (version == 'yr' or faction != 'yuri') and allowed(s,h)]
        producer = next((PRODUCERS[x] for x in parts(s.get('PREREQUISITE')) if x in PRODUCERS), None)
        if pool == 'regular' and producer: houses = [h for h in houses if h in HOUSES[producer]]
        if not reason and not houses: reason = '没有合法普通生产国家'
        audit_row = {'version':version, 'gameId':gid, 'sourceName':unit['name'], 'rules':evidence,
                     'inclusion':'excluded' if reason else 'included', 'rankingPool':'excluded' if reason else pool,
                     'reason':reason or ('间谍偷取科技解锁' if stolen else '合法国家与正常生产链核对通过')}
        audit.append(audit_row)
        if reason: continue
        factions = [f for f, members in HOUSES.items() if any(h in members for h in houses)]
        categories = []
        if unit['category'] == 'infantry': categories.append('infantry')
        if s.get('NAVAL','').lower() == 'yes': categories.append('naval')
        elif unit['category']=='aircraft' or s.get('MOVEMENTZONE','').upper()=='FLY' or s.get('CONSIDEREDAIRCRAFT','').lower()=='yes': categories.append('air')
        elif unit['category']=='vehicle': categories.append('ground')
        level = None if stolen else max([stage(x,h) for h in houses for x in parts(s.get('PREREQUISITE'))] or [0])
        name = '尤里 X' if gid=='YURIPR' and version=='yr' else ('尤里复制人' if gid=='YURI' and version=='yr' else NAMES[gid])
        record = dict(id=f'unit:{version}:{gid}', gameId=gid, version=version, name=name,
            faction=factions[0], factions=factions, categories=categories, rankingPool=pool,
            techStage=None if stolen else ['basic','radar','lab'][level], techLevelRaw=s.get('TECHLEVEL'),
            countries=houses, iconPath='./'+unit['normal']['path'], kind='unit',
            acquisition=' / '.join(k.replace('REQUIRESSTOLEN','').replace('TECH','') for k in stolen) if stolen else '')
        audit_row['classification'] = record
        rows.append(record)
    return rows,audit

def main():
    base=Mix.open('D:/Red_Alet_II/YURI/ra2.mix'); local=Mix(base.get('local.mix'),'ra2.mix::local.mix')
    patch=Mix.open('D:/Red_Alet_II/YURI/expandmd01.mix')
    catalog=[]; audits=[]; counts={}
    for version,data in [('ra2',local.get('rules.ini')),('yr',patch.get('rulesmd.ini'))]:
        manifest=json.loads((ROOT/f'assets/unit-icons/{version}/manifest.json').read_text(encoding='utf-8'))
        rows,audit=classify(version,parse_ini(data),manifest); catalog+=rows; audits+=audit
        counts[version]={p:sum(u['rankingPool']==p for u in rows) for p in ['regular','t4']}
    dest=ROOT/'data'; dest.mkdir(exist_ok=True)
    (dest/'unit-catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (dest/'unit-audit.json').write_text(json.dumps(audits,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    target=ROOT/'src/data'; target.mkdir(exist_ok=True)
    (target/'units.js').write_text('(function (global) {\n  global.RA2.units = '+json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+';\n})(window);\n',encoding='utf-8')
    report=['# 0.3.0 单位名录核对','', '日期：2026-10-14。依据本机原版 rules.ini 与尤复 rulesmd.ini；完整原字段及分类结果见 `data/unit-audit.json`。', '',
        '|版本|常规单位|T4|登记总数|','|---|---:|---:|---:|']
    for v,c in counts.items(): report.append(f"|{v}|{c['regular']}|{c['t4']}|{sum(x['version']==v for x in audits)}|")
    report+=['','科技按正常前置链划分：基础、雷达、作战实验室。展开通用前置别名；特殊国家结合 RequiredHouses／ForbiddenHouses；忽略战役地图专用的 PrerequisiteOverride 路径。遥控坦克经控制中心的前置链归基础。海空身份独立于引擎注册表，飞行步兵具有步兵和空中标签。',
        '', 'T4 是间谍解锁集合，原版四项、尤复三项；尤复尤里 X 不属于 T4。常规查询始终排除 T4。T4 获取可涉及占领敌方生产设施及间谍取得敌方科技，按规则合法条件收录，不代表每个初始国家直接自建所有前置。',
        '', '尤复跨阵营 Owner 的常规单位按正常生产建筑确定身份。月球步兵及要求敌方兵营的尤里军犬排除；菜单图标存在不能证明普通可生产。平民、派生载机、弹体等逐条记录排除理由。','','## 全部单位处置','','|版本|ID|原名|去向|理由|','|---|---|---|---|---|']
    for row in audits: report.append('|'+ '|'.join([row['version'],row['gameId'],row['sourceName'],row['rankingPool'],row['reason']])+'|')
    (ROOT/'docs/0.3.0-单位名录核对.md').write_text('\n'.join(report)+'\n',encoding='utf-8')
    print(json.dumps(counts))

if __name__ == '__main__':
    # Compatibility entry point: use the current generator without overwriting legacy inputs.
    import runpy
    runpy.run_path(str(ROOT/'scripts/prepare-0.4-catalog.py'), run_name='__main__')
