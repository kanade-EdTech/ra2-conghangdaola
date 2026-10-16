(function(global){
  'use strict';
  var app=global.RA2;
  app.createStorage=function(provider){
    var key='ra2-tier-list:save:v3',protectedSave=false;
    return {load:function(){
      try{
        var value=null,version=3;
        for(;version>=1;version--){value=provider().getItem('ra2-tier-list:save:v'+version);if(value!==null)break;}
        if(value===null)return {state:app.core.initial(),status:'new'};
        if(value.length>2000000)throw new Error('Save too large');
        var parsed=JSON.parse(value);if(parsed.schemaVersion!==version)throw new Error('Save version mismatch');
        var state=app.core.normalize(parsed);
        return {state:state,status:version<3?'migrated':JSON.stringify(parsed)===JSON.stringify(state)?'restored':'repaired'};
      }catch(error){protectedSave=true;return {state:app.core.initial(),status:'protected'};}
    },save:function(state){
      if(protectedSave)return 'protected';
      try{provider().setItem(key,JSON.stringify(state));return 'saved';}catch(error){return 'failed';}
    }};
  };
})(window);
