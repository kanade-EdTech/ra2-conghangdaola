(function (global) {
  'use strict';
  var api = global.RA2.interaction = global.RA2.interaction || {};
  api.initial = function () { return { phase: 'idle' }; };
  api.step = function (state, event) {
    var next = Object.assign({}, state), effect = null;
    if (event.type === 'multi') {
      next = { phase: 'blocked' }; effect = { type: 'cancel' };
    } else if (event.type === 'free' && state.phase === 'blocked') next = api.initial();
    else if (event.type === 'cancel') { next = api.initial(); effect = { type: 'cancel' }; }
    else if (event.type === 'down' && state.phase === 'idle') {
      next = { phase: 'pressing', id: event.id, version: event.version,
        pointerId: event.pointerId, kind: event.kind, startX: event.x, startY: event.y, x: event.x, y: event.y };
    } else if ((state.phase === 'pressing' || state.phase === 'dragging') && event.pointerId === state.pointerId) {
      if (event.type === 'move' || event.type === 'up') {
        next.x = event.x; next.y = event.y;
        var dx = next.x - state.startX, dy = next.y - state.startY;
        var threshold = state.kind === 'touch' ? 8 : 4;
        if (dx * dx + dy * dy > threshold * threshold) next.phase = 'dragging';
        if (event.type === 'move' && next.phase === 'dragging') effect = { type: 'preview' };
        if (event.type === 'up') {
          effect = { type: next.phase === 'dragging' ? 'drop' : 'select', id: state.id,
            version: state.version, x: next.x, y: next.y };
          next = api.initial();
        }
      }
    }
    return { state: next, effect: effect };
  };
})(window);
