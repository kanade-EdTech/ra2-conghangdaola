(function (global) {
  'use strict';
  var app = global.RA2;
  app.createDialog = function () {
    var overlay = document.getElementById('modal-overlay');
    var modal = document.getElementById('modal');
    var content = document.getElementById('modal-content');
    var opener = null;
    var cleanup = null;
    var oldOverflow = '';
    function hide() {
      if (overlay.hidden) return;
      overlay.hidden = true;
      document.body.style.overflow = oldOverflow;
      if (cleanup) cleanup();
      cleanup = null;
      content.textContent = '';
      modal.className = 'modal';
      if (opener && document.contains(opener)) opener.focus();
      else document.getElementById('export-button').focus();
    }
    document.getElementById('modal-close').addEventListener('click', hide);
    overlay.addEventListener('click', function (event) { if (event.target === overlay) hide(); });
    document.addEventListener('keydown', function (event) {
      if (overlay.hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); hide(); return; }
      if (event.key !== 'Tab') return;
      var focusable = Array.from(modal.querySelectorAll('button:not(:disabled), input, [tabindex="0"]'));
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (!first) { event.preventDefault(); modal.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === modal)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    });
    return {
      show: function (node, options) {
        if (!overlay.hidden) hide();
        opener = document.activeElement;
        oldOverflow = document.body.style.overflow;
        content.textContent = '';
        content.appendChild(node);
        modal.className = options && options.poster ? 'modal poster-modal' : 'modal';
        cleanup = options && options.cleanup;
        overlay.hidden = false;
        document.body.style.overflow = 'hidden';
        modal.focus();
      },
      hide: hide,
      isOpen: function () { return !overlay.hidden; }
    };
  };
})(window);
