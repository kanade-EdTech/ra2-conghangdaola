(function (global) {
  'use strict';
  global.RA2.installDrag = function (root, options) {
    var api = global.RA2.interaction, session = api.initial();
    var card = null, ghost = null, origin = null, frame = null, target = null;
    var lastTime = 0, edgeSince = null, edgeDirection = 0, destroyed = false;
    var listeners = [];
    function on(node, type, fn) {
      node.addEventListener(type, fn);
      listeners.push(function () { node.removeEventListener(type, fn); });
    }
    function clearMarks() {
      root.querySelectorAll('.drop-active, .drop-before, .drop-after').forEach(function (node) {
        node.classList.remove('drop-active', 'drop-before', 'drop-after');
      });
    }
    function cleanup() {
      if (frame !== null) global.cancelAnimationFrame(frame);
      frame = null; lastTime = 0; edgeSince = null; edgeDirection = 0;
      if (ghost) ghost.remove();
      ghost = null;
      if (card) card.classList.remove('is-dragging', 'is-pressing');
      card = null; origin = null; target = null; clearMarks(); options.dragging(false);
    }
    function measure(x, y) {
      var viewport = global.visualViewport;
      var top = viewport ? viewport.offsetTop : 0;
      var bottom = top + (viewport ? viewport.height : global.innerHeight);
      var rootRect = root.getBoundingClientRect();
      var navigation = document.querySelector('.top-navigation');
      if (navigation) {
        var navRect = navigation.getBoundingClientRect();
        if (navRect.top <= top + 1 && navRect.bottom > top) top = navRect.bottom;
      }
      document.querySelectorAll('.selection-bar, .action-bar').forEach(function (bar) {
        if (bar.hidden) return;
        var rect = bar.getBoundingClientRect(), position = global.getComputedStyle(bar).position;
        if ((position === 'fixed' || position === 'sticky') && rect.bottom > top && rect.top < bottom) bottom = Math.min(bottom, rect.top);
      });
      top = Math.max(top, rootRect.top); bottom = Math.min(bottom, rootRect.bottom);
      var inside = x >= rootRect.left && x <= rootRect.right && y >= top && y <= bottom;
      var destination = null;
      if (inside) {
        var zones = root.querySelectorAll('[data-dropzone]');
        for (var i = 0; i < zones.length; i++) {
          var zone = zones[i], rect = zone.getBoundingClientRect();
          if (!api.contains(rect, x, y)) continue;
          var nodes = Array.from(zone.querySelectorAll('.country-card')).filter(function (node) { return node !== card; });
          var index = api.insertion(nodes.map(function (node) { return node.getBoundingClientRect(); }), x, y);
          destination = { location: zone.getAttribute('data-dropzone'), index: index, zone: zone,
            before: nodes[index] || null, after: index === nodes.length ? nodes[index - 1] : null };
          break;
        }
      }
      return { target: destination, speed: inside ? api.edgeSpeed(y, top, bottom) : 0 };
    }
    function paint() {
      var measured = measure(session.x, session.y); target = measured.target; clearMarks();
      if (target) {
        target.zone.classList.add('drop-active');
        if (target.before) target.before.classList.add('drop-before');
        if (target.after) target.after.classList.add('drop-after');
      }
      var offset = session.kind === 'touch' ? 20 : 0;
      ghost.style.transform = 'translate3d(' + (session.x - origin.grabX) + 'px,' + (session.y - origin.grabY - offset) + 'px,0)';
      return measured.speed;
    }
    function tick(time) {
      frame = null;
      if (session.phase !== 'dragging' || !ghost) return;
      var speed = paint(), direction = Math.sign(speed);
      if (!direction || direction !== edgeDirection) { edgeSince = direction ? time : null; edgeDirection = direction; }
      var dt = lastTime ? Math.min(32, time - lastTime) : 0; lastTime = time;
      if (edgeSince !== null && time - edgeSince >= 120) global.scrollBy(0, speed * dt / 1000);
      frame = global.requestAnimationFrame(tick);
    }
    function preview() {
      if (ghost) return;
      card.classList.remove('is-pressing'); card.classList.add('is-dragging');
      ghost = card.cloneNode(true); ghost.classList.remove('is-dragging', 'is-pressing'); ghost.classList.add('drag-ghost');
      ghost.removeAttribute('data-item'); ghost.removeAttribute('id'); ghost.setAttribute('aria-hidden', 'true');
      ghost.querySelectorAll('[id]').forEach(function (node) { node.removeAttribute('id'); });
      ghost.querySelectorAll('button').forEach(function (node) { node.tabIndex = -1; });
      ghost.style.width = origin.width + 'px'; ghost.style.height = origin.height + 'px';
      document.body.appendChild(ghost); options.dragging(true); paint(); frame = global.requestAnimationFrame(tick);
    }
    function dispatch(event) {
      var result = api.step(session, event), effect = result.effect; session = result.state;
      if (!effect) return;
      if (effect.type === 'preview') preview();
      else if (effect.type === 'select' || effect.type === 'drop') {
        var finalTarget = effect.type === 'drop' ? measure(effect.x, effect.y).target : null;
        cleanup();
        if (effect.version !== options.getVersion() || options.disabled()) return;
        if (effect.type === 'select') options.select(effect.id);
        else if (finalTarget) { options.move(effect.id, finalTarget.location, finalTarget.index); options.select(effect.id); }
      } else if (effect.type === 'cancel') cleanup();
    }
    function cancel() { input.reset(); dispatch({ type: 'cancel' }); }
    var input = api.installInput(root, {
      down: function (point, node) {
        if (destroyed || options.disabled() || session.phase !== 'idle') return false;
        card = node;
        var rect = node.getBoundingClientRect();
        origin = { width: rect.width, height: rect.height, grabX: point.x - rect.left, grabY: point.y - rect.top };
        point.id = node.getAttribute('data-item'); point.version = options.getVersion();
        dispatch(point); node.classList.add('is-pressing'); return true;
      },
      move: dispatch, up: dispatch,
      cancel: function () { dispatch({ type: 'cancel' }); },
      multi: function () { dispatch({ type: 'multi' }); },
      free: function () { dispatch({ type: 'free' }); },
      activate: function (id) { if (!options.disabled()) options.select(id); },
      clear: function () { if (session.phase === 'idle') options.select(null); }
    }, options.controlsRoot);
    on(global, 'blur', cancel); on(global, 'resize', cancel); on(global, 'pagehide', cancel);
    if (global.visualViewport) on(global.visualViewport, 'resize', cancel);
    on(document, 'visibilitychange', function () { if (document.hidden) cancel(); });
    on(document, 'keydown', function (event) {
      if (event.key === 'Escape' && !options.disabled()) {
        if (session.phase !== 'idle') cancel(); else options.select(null);
      }
    });
    return {
      cancel: cancel,
      isDragging: function () { return session.phase === 'dragging'; },
      destroy: function () {
        if (destroyed) return;
        cancel(); destroyed = true; input.destroy(); listeners.forEach(function (off) { off(); });
      }
    };
  };
})(window);
