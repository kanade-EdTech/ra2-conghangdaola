(function(global){
  'use strict';
  var app=global.RA2;
  app.createStorage=function(provider){
    var profile=app.buildProfile || {},key=profile.storageKey || 'ra2-tier-list:save:v3',protectedSave=false;
    return {load:function(){
      try{
        var value=profile.storageKey?provider().getItem(key):null,version=3,fromProfile=value!==null;
        if(value===null)for(;version>=1;version--){value=provider().getItem('ra2-tier-list:save:v'+version);if(value!==null)break;}
        if(value===null)return {state:app.core.initial(),status:'new'};
        if(value.length>2000000)throw new Error('Save too large');
        var parsed=JSON.parse(value);if(parsed.schemaVersion!==version)throw new Error('Save version mismatch');
        var state=app.core.normalize(parsed);
        var disabled=profile.disabledModes || [];
        Object.keys(state.boards).forEach(function(k){if(disabled.indexOf(state.boards[k].context.mode)!==-1)delete state.boards[k];});
        Object.keys(state.lastContexts).forEach(function(k){if(disabled.indexOf(state.lastContexts[k].mode)!==-1)delete state.lastContexts[k];});
        if(disabled.indexOf(state.activeContext.mode)!==-1){
          state.activeContext=state.lastRegularContexts[state.lastGameVersion];
          state.activeBoardKey=app.catalog.key(state.activeContext);app.core.ensureBoard(state,state.activeContext);
        }
        return {state:state,status:version<3||profile.storageKey&&!fromProfile?'migrated':JSON.stringify(parsed)===JSON.stringify(state)?'restored':'repaired'};
      }catch(error){protectedSave=true;return {state:app.core.initial(),status:'protected'};}
    },save:function(state){
      if(protectedSave)return 'protected';
      try{provider().setItem(key,JSON.stringify(state));return 'saved';}catch(error){return 'failed';}
    }};
  };
})(window);
