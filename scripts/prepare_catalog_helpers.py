"""Resolve a building's prerequisite stage in its own construction tree."""
def building_stage(gid,rules,faction):
    def parts(s):return [x.strip().upper() for x in (s or '').split(',') if x.strip()]
    aliases={k[len('PREREQUISITE'):]:parts(v) for k,v in rules['GENERAL'].items() if k.startswith('PREREQUISITE') and not k.endswith('ALTERNATE')}
    faction_nodes={'allied':{'POWER':'GAPOWR','PROC':'GAREFN','BARRACKS':'GAPILE','RADAR':'GAAIRC','FACTORY':'GAWEAP','TECH':'GATECH'},
                   'soviet':{'POWER':'NAPOWR','PROC':'NAREFN','BARRACKS':'NAHAND','RADAR':'NARADR','FACTORY':'NAWEAP','TECH':'NATECH'},
                   'yuri':{'POWER':'YAPOWR','PROC':'YAREFN','BARRACKS':'YABRCK','RADAR':'NAPSIS','FACTORY':'YAWEAP','TECH':'YATECH'}}
    def visit(node,seen):
        if node in ('GATECH','NATECH','YATECH','TECH'):return 2
        if node in ('GAAIRC','AMRADR','NARADR','NAPSIS','RADAR'):return 1
        if node in seen:return 0
        if node in faction_nodes[faction]:return visit(faction_nodes[faction][node],seen+(node,))
        if node in aliases:return min([visit(n,seen+(node,)) for n in aliases[node]] or [0])
        return max([visit(n,seen+(node,)) for n in parts(rules.get(node,{}).get('PREREQUISITE'))] or [0])
    return ['basic','radar','lab'][max([visit(n,(gid,)) for n in parts(rules.get(gid,{}).get('PREREQUISITE'))] or [0])]
