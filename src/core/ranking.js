(function(global){
  'use strict';
  var app=global.RA2, catalog=app.catalog;
  var locations=app.tiers.map(function(t){return t.id;}).concat(['unranked']);
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function ids(c){return catalog.ids(c);}
  function list(b,l){return l==='unranked'?b.unranked:b.tiers[l];}
  function createBoard(raw){var c=catalog.context(raw),tiers={};app.tiers.forEach(function(t){tiers[t.id]=[];});return {context:c,title:catalog.title(c),tiers:tiers,unranked:ids(c)};}
  function initial(){return {schemaVersion:3,catalogRevision:catalog.revision,lastGameVersion:'ra2',activeContext:catalog.context('ra2'),activeBoardKey:'ra2|countries',lastContexts:{},lastRegularContexts:{ra2:catalog.context({mode:'units',version:'ra2'}),yr:catalog.context({mode:'units',version:'yr'})},boards:{'ra2|countries':createBoard('ra2'),'yr|countries':createBoard('yr')}};}
  function validate(b,c){
    if(!b||typeof b.title!=='string'||!b.tiers)return false;
    var all=[];for(var i=0;i<locations.length;i++){var row=list(b,locations[i]);if(!Array.isArray(row))return false;all=all.concat(row);}
    var allowed=ids(c),seen=new Set(all);return all.length===allowed.length&&seen.size===all.length&&allowed.every(function(id){return seen.has(id);});
  }
  function locate(b,id){for(var i=0;i<locations.length;i++){var index=list(b,locations[i]).indexOf(id);if(index!==-1)return {location:locations[i],index:index};}return null;}
  function move(b,c,id,target,index){
    if(!validate(b,c)||locations.indexOf(target)===-1)throw new Error('排名数据无效');
    var next=clone(b),source=locate(next,id);if(!source)throw new Error('当前榜单没有此项目');
    list(next,source.location).splice(source.index,1);var dest=list(next,target),at=typeof index==='number'&&isFinite(index)?Math.floor(index):dest.length;
    dest.splice(Math.max(0,Math.min(dest.length,at)),0,id);return next;
  }
  function reset(b,c){var next=createBoard(c);next.title=b.title;return next;}
  function limitTitle(t){return Array.from(t).slice(0,30).join('');}
  function project(master,raw){
    var c=catalog.context(raw),visible=new Set(ids(c)),next=createBoard(c);next.title=master.title;
    locations.forEach(function(l){var row=list(master,l).filter(function(id){return visible.has(id);});if(l==='unranked')next.unranked=row;else next.tiers[l]=row;});return next;
  }
  // Replace only visible slots. Hidden cards retain their relative order and tier.
  function mergeView(master,raw,view){
    var c=catalog.context(raw);if(catalog.key(master.context)!==catalog.key(c)||!validate(view,c))throw new Error('筛选排名无效');
    var visible=new Set(ids(c)),next=clone(master);next.title=view.title;
    locations.forEach(function(l){var queue=list(view,l).slice(),row=[];
      list(master,l).forEach(function(id){if(!visible.has(id))row.push(id);else if(queue.length)row.push(queue.shift());});
      row=row.concat(queue);if(l==='unranked')next.unranked=row;else next.tiers[l]=row;
    });
    if(!validate(next,catalog.base(c)))throw new Error('完整排名校验失败');return next;
  }
  function normalizeBoard(raw,c){
    if(!raw||typeof raw!=='object'||!raw.tiers||!Array.isArray(raw.unranked)||locations.slice(0,-1).some(function(l){return !Array.isArray(raw.tiers[l]);}))throw new Error('存档格式损坏');
    var next=createBoard(c),allowed=new Set(ids(c)),seen=new Set();next.title=typeof raw.title==='string'?limitTitle(raw.title):next.title;
    if(next.context.mode==='countries'&&['我的红警 2 国家喜好榜','我的尤复国家／阵营喜好榜'].indexOf(raw.title)!==-1)next.title='国家强度排序';
    locations.forEach(function(l){var row=list(raw,l).filter(function(id){if(typeof id!=='string'||!allowed.has(id)||seen.has(id))return false;seen.add(id);return true;});if(l==='unranked')next.unranked=row;else next.tiers[l]=row;});
    ids(c).forEach(function(id){if(!seen.has(id))next.unranked.push(id);});return next;
  }
  function ensureBoard(state,raw){
    var c=catalog.base(raw),key=catalog.key(c);
    if(!Object.prototype.hasOwnProperty.call(state.boards,key)){
      var combined=state.boards['combined|signatures'];
      state.boards[key]=c.mode==='signatures'&&c.version!=='combined'&&combined?normalizeBoard(combined,c):createBoard(c);
    }
    return state.boards[key];
  }
  function legacyContext(b){var c=clone(b.context);if(c.mode==='signatures')return catalog.context({mode:'signatures',version:'combined'});return catalog.context(c);}
  function legacyKey(c){if(c.mode==='signatures')return 'shared|signatures';return c.mode==='units'?[c.version,'units',c.faction||'all',c.category||'all','stage:'+(c.stage||'all')].join('|'):c.version+'|'+c.mode;}
  function normalize(raw){
    if(!raw||!raw.boards||typeof raw.boards!=='object'||Array.isArray(raw.boards))throw new Error('存档格式损坏');
    var next=initial(),keys=Object.keys(raw.boards);if(keys.length>500)throw new Error('存档过大');
    if(raw.schemaVersion===1){
      ['ra2','yr'].forEach(function(v){next.boards[v+'|countries']=normalizeBoard(raw.boards[v],v);});
      next.lastGameVersion=raw.activeVersion==='yr'?'yr':'ra2';next.activeContext=catalog.context(next.lastGameVersion);next.activeBoardKey=catalog.key(next.activeContext);return next;
    }
    if(raw.schemaVersion===2){
      if(raw.catalogRevision!==1||!Object.prototype.hasOwnProperty.call(raw.boards,raw.activeBoardKey))throw new Error('旧存档身份无效');
      var groups={};
      keys.sort().forEach(function(k){var b=raw.boards[k],c=legacyContext(b);if(legacyKey(b.context)!==k)throw new Error('旧榜单身份无效');
        var target=catalog.key(c);(groups[target]||(groups[target]=[])).push({key:k,context:c,board:b});});
      Object.keys(groups).forEach(function(k){
        var rows=groups[k];rows.sort(function(a,b){return (a.key===raw.activeBoardKey?-1:0)-(b.key===raw.activeBoardKey?-1:0);});
        var c=catalog.base(rows[0].context),dest=createBoard(c),seen=new Set(),allowed=new Set(ids(c));dest.title=normalizeBoard(rows[0].board,c).title;
        // Old saves have no timestamps. The active board wins; other placed cards fill gaps.
        rows.forEach(function(row){
          normalizeBoard(row.board,row.context); // validate each source before migration
          locations.forEach(function(l){if(l==='unranked'&&row.key!==raw.activeBoardKey)return;
            list(row.board,l).forEach(function(id){if(allowed.has(id)&&!seen.has(id)){seen.add(id);if(l!=='unranked')dest.tiers[l].push(id);}});
          });
        });
        var placed=new Set();locations.slice(0,-1).forEach(function(l){dest.tiers[l].forEach(function(id){placed.add(id);});});
        // Preserve the first source's unranked sequence, then append newly introduced entries.
        var unranked=[];rows.forEach(function(row){row.board.unranked.forEach(function(id){if(allowed.has(id)&&!placed.has(id)&&unranked.indexOf(id)===-1)unranked.push(id);});});
        ids(c).forEach(function(id){if(!placed.has(id)&&unranked.indexOf(id)===-1)unranked.push(id);});dest.unranked=unranked;next.boards[k]=dest;
      });
      next.activeContext=legacyContext(raw.boards[raw.activeBoardKey]);
    }else if(raw.schemaVersion===3&&raw.catalogRevision===catalog.revision){
      next.boards=Object.create(null);keys.forEach(function(k){var b=raw.boards[k],c=catalog.base(b.context);if(catalog.key(c)!==k)throw new Error('榜单身份无效');next.boards[k]=normalizeBoard(b,c);});
      next.activeContext=catalog.context(raw.activeContext);
    }else throw new Error('存档或名录版本不支持');
    next.activeBoardKey=catalog.key(next.activeContext);
    if(!Object.prototype.hasOwnProperty.call(next.boards,next.activeBoardKey))throw new Error('当前榜单不存在');
    if(raw.schemaVersion===3&&raw.activeBoardKey!==next.activeBoardKey)throw new Error('当前榜单身份无效');
    next.lastGameVersion=next.activeContext.version==='combined'?(raw.lastGameVersion==='yr'?'yr':'ra2'):next.activeContext.version;
    ['ra2','yr'].forEach(function(v){var c=raw.lastRegularContexts&&raw.lastRegularContexts[v];if(c){c=catalog.context(c);if(c.mode!=='units'||c.version!==v)throw new Error('常规筛选记录无效');next.lastRegularContexts[v]=c;}});
    if(raw.schemaVersion===3&&raw.lastContexts)Object.keys(raw.lastContexts).forEach(function(k){var c=catalog.context(raw.lastContexts[k]);if(catalog.key(c)!==k)throw new Error('筛选身份无效');next.lastContexts[k]=c;});
    return next;
  }
  function createHistory(){var stacks=Object.create(null);return {push:function(key,b){var s=stacks[key]||(stacks[key]=[]);s.push(clone(b));if(s.length>20)s.shift();},pop:function(key){return stacks[key]&&stacks[key].pop()||null;},count:function(key){return stacks[key]?stacks[key].length:0;}};}
  app.core={clone:clone,ids:ids,list:list,locations:locations,initial:initial,createBoard:createBoard,validate:validate,locate:locate,move:move,reset:reset,limitTitle:limitTitle,normalize:normalize,createHistory:createHistory,project:project,mergeView:mergeView,ensureBoard:ensureBoard};
})(window);
