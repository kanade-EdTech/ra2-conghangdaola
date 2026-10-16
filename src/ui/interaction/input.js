(function (global) {
  'use strict';
  var api = global.RA2.interaction = global.RA2.interaction || {};
  api.installInput = function (root, sink, controlsRoot) {
    var listeners = [], contacts = {}, owner = null, suppressUntil = 0, mouseUntil = 0, buttonTap = null;
    controlsRoot = controlsRoot || root;
    function on(node, type, fn, options) {
      node.addEventListener(type, fn, options);
      listeners.push(function () { node.removeEventListener(type, fn, options); });
    }
    function count() { return Object.keys(contacts).length; }
    function point(type, event, p, id, kind) {
      return { type: type, event: event, x: p.clientX, y: p.clientY, pointerId: id, kind: kind };
    }
    function prevent(event) { if (event.cancelable) event.preventDefault(); }
    function release() {
      var id = owner; owner = null;
      if (id !== null && root.releasePointerCapture) {
        try { if (root.hasPointerCapture(id)) root.releasePointerCapture(id); } catch (error) { /* optional capture */ }
      }
    }
    function start(event, p, id, kind) {
      suppressUntil = 0; contacts[id] = true;
      if (count() > 1) {
        buttonTap = null;
        if (owner !== null) suppressUntil = Date.now() + 700;
        sink.multi(); release(); return;
      }
      var card = event.target.closest && event.target.closest('.country-card');
      if (!card || !root.contains(card)) {
        var button = event.target.closest && event.target.closest('button');
        if (kind === 'touch' && button && !button.disabled && controlsRoot.contains(button)) {
          buttonTap = { id: id, x: p.clientX, y: p.clientY, node: button };
        }
        return;
      }
      if (sink.down(point('down', event, p, id, kind), card)) {
        owner = id;
        if (global.PointerEvent && root.setPointerCapture) {
          try { root.setPointerCapture(id); } catch (error) { /* document listeners remain active */ }
        }
        // The fallback claims touch before native scrolling starts.
        if (!global.PointerEvent && kind === 'touch') prevent(event);
      }
    }
    function move(event, p, id, kind) {
      if (buttonTap && buttonTap.id === id && Math.hypot(p.clientX - buttonTap.x, p.clientY - buttonTap.y) > 8) buttonTap = null;
      if (owner !== id) return;
      prevent(event); sink.move(point('move', event, p, id, kind));
    }
    function end(event, p, id, kind, cancelled) {
      delete contacts[id];
      var tap = buttonTap && buttonTap.id === id ? buttonTap : null;
      if (tap) buttonTap = null;
      if (owner === id) {
        suppressUntil = Date.now() + 700;
        release();
        if (cancelled) sink.cancel(); else sink.up(point('up', event, p, id, kind));
      }
      if (!count()) sink.free();
      // Some WebViews omit the compatibility click immediately after a drag.
      // Activate touch buttons once on release and consume any later native click.
      if (tap && !cancelled && !tap.node.disabled && Math.hypot(p.clientX - tap.x, p.clientY - tap.y) <= 8) {
        var hit = document.elementFromPoint(p.clientX, p.clientY);
        if (hit && tap.node.contains(hit)) { suppressUntil = Date.now() + 700; tap.node.click(); }
      }
    }
    if (global.PointerEvent) {
      on(document, 'pointerdown', function (e) {
        if (e.button === 0) start(e, e, e.pointerId, e.pointerType || 'mouse');
      }, true);
      on(document, 'pointermove', function (e) { move(e, e, e.pointerId, e.pointerType); }, { passive: false });
      on(document, 'pointerup', function (e) { end(e, e, e.pointerId, e.pointerType, false); });
      on(document, 'pointercancel', function (e) { end(e, e, e.pointerId, e.pointerType, true); });
      on(root, 'lostpointercapture', function (e) {
        if (owner === e.pointerId) { suppressUntil = Date.now() + 700; release(); sink.cancel(); }
      });
    } else {
      on(document, 'touchstart', function (e) {
        mouseUntil = Date.now() + 800;
        Array.from(e.changedTouches).forEach(function (p) { start(e, p, p.identifier, 'touch'); });
      }, { passive: false, capture: true });
      on(document, 'touchmove', function (e) {
        Array.from(e.changedTouches).forEach(function (p) { move(e, p, p.identifier, 'touch'); });
      }, { passive: false });
      ['touchend', 'touchcancel'].forEach(function (type) {
        on(document, type, function (e) {
          mouseUntil = Date.now() + 800;
          Array.from(e.changedTouches).forEach(function (p) { end(e, p, p.identifier, 'touch', type === 'touchcancel'); });
        });
      });
      on(document, 'mousedown', function (e) {
        if (e.button === 0 && Date.now() >= mouseUntil) start(e, e, 'mouse', 'mouse');
      }, true);
      on(document, 'mousemove', function (e) { move(e, e, 'mouse', 'mouse'); });
      on(document, 'mouseup', function (e) { end(e, e, 'mouse', 'mouse', false); });
    }
    on(document, 'click', function (e) {
      if (e.detail > 0 && Date.now() < suppressUntil) {
        suppressUntil = 0; prevent(e); e.stopImmediatePropagation();
      }
    }, true);
    on(root, 'click', function (e) {
      var card = e.target.closest('.country-card');
      if (card && e.detail === 0) sink.activate(card.getAttribute('data-item'));
      else if (!card) sink.clear();
    });
    on(root, 'dragstart', prevent);
    on(root, 'contextmenu', function (e) { if (e.target.closest('.country-card')) prevent(e); });
    return {
      reset: function () { if (owner !== null) suppressUntil = Date.now() + 700; release(); contacts = {}; buttonTap = null; },
      destroy: function () { release(); listeners.forEach(function (off) { off(); }); contacts = {}; buttonTap = null; }
    };
  };
})(window);
