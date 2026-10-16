"""Build offline 0.4 catalogs from the reviewed units and original game rules."""
import json
from pathlib import Path
from cnc_assets import Mix, parse_ini
from prepare_catalog_helpers import building_stage

ROOT = Path(__file__).resolve().parents[1]
HOUSES = {'allied':['British','French','Germans','Americans','Alliance'],
          'soviet':['Russians','Confederation','Africans','Arabs'],'yuri':['YuriCountry']}
NATIONAL = {'SNIPE','TNKD','BEAG','TTNK','DESO','TERROR','DTRUCK','GTGCAN','AMRADR'}
YARDS = {'GACNST':'allied','NACNST':'soviet','YACNST':'yuri'}
BORROWED = dict(VLADIMIR='soviet',PENTGEN='allied',PRES='allied',SSRV='allied',
    ARND='allied',STLN='allied',RMNV='soviet',SLAV='yuri',YDOG='yuri',YADOG='yuri',
    TRUCKA='neutral',XCOMET='allied',VLAD='soviet',UTNK='soviet',SCHD='soviet',CARGOPLANE='neutral')
ANIMALS = {'COW','ALL','POLARB','JOSH','CAML','DNOA','DNOB'}
CHARACTERS = {'VLADIMIR','PENTGEN','PRES','SSRV','CLNT','ARND','STLN','EINS','RMNV','MUMY'}
CIVIL_VEHICLES = {'CAR','BUS','WINI','PICK','TRUCKA','TRUCKB','PROPA','CONA','COP','EUROC','LIMO','STANG','SUVB','SUVW','TAXI','PTRUCK','CRUISE','TUG','CDEST','YCAB','DDBX','BCAB','JEEP','DOLY','CBLC','FTRK','AMBU','CIVP'}
HIDDEN = {'WEEDGUY','HORV','CMON','SMON','HOWI','LTNK','XCOMET','UTNK','YDOG','YADOG','SCHD','WWLF'}
CAMPAIGN_BUILDINGS = {'NAPSYA','NAPSYB','CALAB','CASLAB','CATIME','CATIME01','CATIME02','YACOMD','YAPPPT','YAROCK','CAMOON01','CALUNR01','CALUNR02'}
NAMES = dict(GACNST='盟军建造厂',NACNST='苏军建造厂',YACNST='尤里建造厂',GAPOWR='发电厂',
    GAREFN='盟军矿石精炼厂',GAPILE='盟军兵营',GADEPT='盟军维修厂',GATECH='盟军作战实验室',GAWEAP='盟军战车工厂',
    NAPOWR='磁能反应炉',NATECH='苏军作战实验室',NAHAND='苏军兵营',GAWALL='盟军围墙',NAWALL='苏军围墙',
    NARADR='雷达',NAWEAP='苏军战车工厂',NAREFN='苏军矿石精炼厂',NALASR='哨戒炮',NASAM='爱国者导弹',
    GAYARD='盟军船厂',NAIRON='铁幕装置',NADEPT='苏军维修厂',GACSPH='超时空传送仪',GAWEAT='天气控制机',
    TESLA='磁暴线圈',NAMISL='核弹发射井',ATESLA='光棱塔',NAYARD='苏军船厂',GASPYSAT='间谍卫星',GAGAP='裂缝产生器',
    GTGCAN='巨炮',NANRCT='核子反应炉',GAPILL='机枪碉堡',NAFLAK='防空炮',NACLON='复制中心',GAOREP='矿石精炼器',
    GAAIRC='空指部',AMRADR='美国空指部',YAPOWR='生化反应炉',YABRCK='尤里兵营',YAWEAP='尤里战车工厂',
    YAYARD='尤里船厂',YATECH='尤里作战实验室',GAFWLL='尤里围墙',YAGGUN='盖特机炮',YAPSYT='心灵控制塔',
    NAINDP='工业工厂',YAGRND='部队回收厂',YAGNTC='基因突变器',YAPPET='心灵控制器',NATBNK='坦克碉堡',
    GAROBO='遥控坦克控制中心',YAREFN='奴隶矿场',NABNKR='战斗碉堡',CAOILD='科技钻油井',CAAIRP='科技机场',
    CATHOSP='科技医院',CAOUTP='科技前哨站',CAMACH='科技机器商店',CAPOWR='科技电厂',CASLAB='秘密科技实验室',
    CLNT='牛仔',EINS='爱因斯坦',COW='奶牛',ALL='鳄鱼',POLARB='北极熊',JOSH='猴子',CAML='骆驼',DNOA='暴龙',DNOB='腕龙',
    GHOST='海豹突击队',VLADIMIR='维拉迪摩将军',PENTGEN='五角大楼将军',PRES='美国总统',SSRV='特勤保镖',
    ARND='英雄',STLN='健美先生',RMNV='罗曼诺夫总理',LUNR='登月火箭员',SLAV='奴隶',YDOG='尤里军犬（苏军型）',
    YADOG='尤里军犬（盟军型）',TRUCKA='民用卡车',HIND='雌鹿运输直升机',VLAD='维拉迪摩指挥舰',PDPLANE='伞兵运输机',
    CARGOPLANE='战役运输机',BPLN='米格支援战机',SPYP='侦察机',XCOMET='隐藏测试战车',UTNK='未使用战车',SCHD='武装直升机（隐藏形态）')

def parts(s): return [x.strip().upper() for x in (s or '').split(',') if x.strip()]
def yes(v): return str(v).lower() in ('yes','true','1')
def write(name,data): (ROOT/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def js(name,assignment,data,concat=False):
    (ROOT/'src/data'/name).write_text('(function(global){\n  '+assignment+json.dumps(data,ensure_ascii=False,separators=(',',':'))+(')' if concat else '')+';\n})(window);\n',encoding='utf-8')

def main():
    reviewed=json.loads((ROOT/'data/unit-catalog.json').read_text('utf-8'))
    others=[]; buildings=[]; audit=[]
    base=Mix.open('D:/Red_Alet_II/YURI/ra2.mix')
    rulesets={'ra2':parse_ini(Mix(base.get('local.mix'),'local').get('rules.ini')),
              'yr':parse_ini(Mix.open('D:/Red_Alet_II/YURI/expandmd01.mix').get('rulesmd.ini'))}
    for u in reviewed:
        u['national']=u['gameId'] in NATIONAL
        if u['rankingPool']=='t4':u['techStage']='spy'
    for version,rules in rulesets.items():
        manifest=json.loads((ROOT/f'assets/unit-icons/{version}/manifest.json').read_text('utf-8'))
        known={u['gameId'] for u in reviewed if u['version']==version}
        for u in manifest['units']:
            gid=u['id'].upper(); s=rules.get(gid,{})
            if gid in known:continue
            reason='未定义的条目' if not s or 'STRENGTH' not in s else '弹体或舰载子机' if yes(s.get('MISSILESPAWN')) or gid in ('HORNET','ASW') else None
            audit.append(dict(version=version,gameId=gid,kind='unit',included=not reason,reason=reason or '特殊／平民单位'))
            if reason:continue
            uid=f'unit:{version}:{gid}'
            civilian=gid in ANIMALS or gid in CIVIL_VEHICLES or (yes(s.get('CIVILIAN')) and gid not in CHARACTERS and gid not in HIDDEN)
            source='civilian' if civilian else 'hidden' if gid in HIDDEN else 'campaign'
            faction='neutral' if civilian else BORROWED.get(gid,u['factions'][0] if len(u['factions'])==1 else 'neutral')
            category='animal' if gid in ANIMALS else 'naval' if yes(s.get('NAVAL')) else 'air' if u['category']=='aircraft' or s.get('MOVEMENTZONE','').lower()=='fly' else 'ground' if u['category']=='vehicle' else 'infantry'
            others.append(dict(id=uid,gameId=gid,version=version,name=NAMES.get(gid,u['name']),kind='unit',
                rankingPool='others',faction=faction,factions=[faction],categories=[category],source=source,techStage=None,
                iconPath='./'+u['normal']['path'] if u.get('normal') and gid not in BORROWED else None,
                sourceIconPath='./'+u['normal']['path'] if u.get('normal') else None,iconFaction=faction,national=False))
        seen=set()
        for u in manifest['buildings']:
            gid=u['id'].upper(); s=rules.get(gid,{})
            if gid in seen:continue
            seen.add(gid)
            owners=parts(s.get('OWNER')); required=parts(s.get('REQUIREDHOUSES')); forbidden=parts(s.get('FORBIDDENHOUSES'))
            legal=[h for values in HOUSES.values() for h in values if (not owners or h.upper() in owners) and (not required or h.upper() in required) and h.upper() not in forbidden]
            prereq=parts(s.get('PREREQUISITE'))
            faction=next((f for y,f in YARDS.items() if y in prereq or y==gid),None)
            if gid in ('GAWALL','NAWALL','GAFWLL'): faction={'GAWALL':'allied','NAWALL':'soviet','GAFWLL':'yuri'}[gid]
            regular=(0<=int(s.get('TECHLEVEL','-1'))<=10 and bool(faction) and any(h in HOUSES[faction] for h in legal)) or gid in YARDS
            reason='缺少实体规则' if not s or 'STRENGTH' not in s else '灯光／不可见辅助对象' if yes(s.get('INVISIBLEINGAME')) or s.get('IMAGE','').lower() in ('null','none') or 'LIGHTINTENSITY' in s else None
            audit.append(dict(version=version,gameId=gid,kind='building',included=not reason,reason=reason or ('遭遇战建筑' if regular else '中立／战役建筑'),buildCat=s.get('BUILDCAT')))
            if reason:continue
            faction=faction if regular else 'yuri' if gid in ('YACOMD','YAPPPT','YAROCK') else 'soviet' if gid in ('NAPSYA','NAPSYB') else 'neutral'
            buildings.append(dict(id=f'building:{version}:{gid}',gameId=gid,version=version,
                name=('心灵探测器' if version=='ra2' else '心灵感应器') if gid=='NAPSIS' else NAMES.get(gid,u['name']),
                kind='building',rankingPool='regular' if regular else 'structures',faction=faction,factions=[faction],
                categories=['defense' if s.get('BUILDCAT','').lower()=='combat' or yes(s.get('WALL')) or (not regular and s.get('PRIMARY')) else 'building'],
                source=None if regular else 'campaign' if gid in CAMPAIGN_BUILDINGS else 'neutral',
                techStage=building_stage(gid,rules,faction) if regular else None,national=gid in NATIONAL,
                iconPath='./'+u['normal']['path'] if u.get('normal') and gid not in ('YADEPT','GADUMY') else None))
    write('data/other-unit-catalog.json',others);write('data/building-catalog.json',buildings);write('data/0.4-catalog-audit.json',audit)
    write('data/runtime-unit-catalog.json',reviewed+others+buildings)
    js('units.js','global.RA2.units = ',reviewed)
    js('others.js','global.RA2.units = global.RA2.units.concat(',others,concat=True)
    js('buildings.js','global.RA2.units = global.RA2.units.concat(',buildings,concat=True)
    print(json.dumps({v:{'regularBuildings':sum(b['version']==v and b['rankingPool']=='regular' for b in buildings),'specialBuildings':sum(b['version']==v and b['rankingPool']=='structures' for b in buildings),'others':sum(u['version']==v for u in others)} for v in rulesets}))

if __name__=='__main__':main()
