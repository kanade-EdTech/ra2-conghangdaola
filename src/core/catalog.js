(function (global) {
  'use strict';
  var app = global.RA2, items = Object.create(null);
  app.categories = { all:'全部类别', infantry:'步兵', ground:'地面载具', naval:'海军', air:'空中单位', building:'普通建筑', defense:'防御及超级武器', animal:'动物' };
  app.stages = { all:'全部科技', basic:'基础', radar:'雷达后', lab:'作战实验室后', spy:'间谍偷实验室后' };
  app.sources = { all:'全部来源', campaign:'战役', civilian:'平民', hidden:'隐藏', neutral:'中立' };
  app.modes = { countries:'国家榜', units:'常规榜', signatures:'国家特色', t4:'T4 科技', others:'其他单位', structures:'特殊建筑' };
  app.countries.forEach(function (i) { i.kind='country'; items[i.id]=i; });
  app.units.concat(app.signatures).forEach(function (i) { items[i.id]=i; });
  function own(o,k) { return Object.prototype.hasOwnProperty.call(o,k); }
  function context(raw) {
    if (typeof raw==='string') raw={mode:'countries',version:raw};
    if (!raw || !own(app.modes,raw.mode)) throw new Error('未知榜单类型');
    var v=raw.version || (raw.mode==='signatures'?'combined':null);
    if (v!=='ra2' && v!=='yr' && !(v==='combined' && raw.mode==='signatures')) throw new Error('未知游戏版本');
    var c={mode:raw.mode,version:v};
    if(c.mode==='countries') return c;
    c.faction=raw.faction || 'all'; c.category=raw.category || 'all';
    if(c.faction!=='all' && c.faction!=='neutral' && !own(app.factions,c.faction)) throw new Error('筛选阵营无效');
    if(!own(app.categories,c.category)) throw new Error('筛选类别无效');
    if(c.version==='ra2' && c.mode==='units' && c.faction==='yuri') c.faction='all';
    if(c.mode==='units') {
      c.stage=raw.stage || 'all'; if(!own(app.stages,c.stage)) throw new Error('科技筛选无效');
      c.hideNational=raw.hideNational===true;
    }
    if(c.mode==='others'||c.mode==='structures') {
      c.source=raw.source || 'all'; if(!own(app.sources,c.source)) throw new Error('来源筛选无效');
    }
    return c;
  }
  function key(raw) { var c=context(raw); return c.version+'|'+c.mode; }
  function base(raw) { var c=context(raw); return context({mode:c.mode,version:c.version}); }
  function ids(raw) {
    var c=context(raw), pool;
    if(c.mode==='countries') return app.countries.filter(function(i){return i.versions.indexOf(c.version)!==-1;}).map(function(i){return i.id;});
    pool=c.mode==='signatures'?app.signatures:app.units;
    return pool.filter(function(i){
      if(c.mode!=='signatures' && (i.version!==c.version || (c.mode==='units' ? ['regular','t4'].indexOf(i.rankingPool)===-1 : i.rankingPool!==c.mode))) return false;
      return (c.faction==='all'||(i.factions || [i.faction]).indexOf(c.faction)!==-1) &&
        (c.category==='all'||i.categories.indexOf(c.category)!==-1) &&
        (!c.stage||c.stage==='all'||i.techStage===c.stage) && (!c.hideNational||!i.national) &&
        (!c.source||c.source==='all'||i.source===c.source);
    }).map(function(i){return i.id;});
  }
  function summary(raw) {
    var c=context(raw), text=(c.version==='combined'?'综合':app.versions[c.version])+' · '+app.modes[c.mode];
    if(c.mode==='countries') return text;
    text+=' · '+(c.faction==='all'?'全部阵营':app.factions[c.faction] || '中立')+' / '+app.categories[c.category];
    if(c.stage) text+=' / '+app.stages[c.stage];
    if(c.source) text+=' / '+app.sources[c.source];
    if(c.hideNational) text+=' · 已屏蔽国家专属';
    return text;
  }
  function title(raw) {
    var c=context(raw);
    return {countries:'国家强度排序',units:'常规强度排序',signatures:'国家特色强度排序',t4:'T4 间谍科技强度排序',others:'其他单位强度排序',structures:'特殊建筑强度排序'}[c.mode];
  }
  function detail(i) {
    if(i.kind==='country')return app.factions[i.faction]+' · '+i.signature;
    if(i.kind==='signature')return i.countryName+' · 国家特色';
    return (app.factions[i.faction] || '中立')+' · '+i.categories.map(function(c){return app.categories[c];}).join('／')+
      (i.techStage?' · '+app.stages[i.techStage]:' · '+(app.sources[i.source] || '特殊单位'))+(i.national?' · 国家专属':'')+' · '+i.gameId;
  }
  app.catalog={revision:2,context:context,key:key,base:base,ids:ids,title:title,summary:summary,detail:detail,getItem:function(id){return items[id]||null;}};
})(window);
