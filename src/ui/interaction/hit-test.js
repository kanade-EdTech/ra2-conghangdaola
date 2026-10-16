(function (global) {
  'use strict';
  var api = global.RA2.interaction = global.RA2.interaction || {};
  api.contains = function (rect, x, y) {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  };
  // Rectangles follow DOM order, with the moving card already excluded.
  api.insertion = function (cards, x, y) {
    if (!cards.length) return 0;
    var rows = [];
    cards.forEach(function (card, index) {
      var row = rows[rows.length - 1];
      if (!row || card.top >= row.bottom - 1) {
        row = { top: card.top, bottom: card.bottom, entries: [] }; rows.push(row);
      }
      row.bottom = Math.max(row.bottom, card.bottom);
      row.entries.push({ rect: card, index: index });
    });
    var chosen = rows[rows.length - 1];
    for (var r = 0; r < rows.length - 1; r++) {
      if (y < (rows[r].bottom + rows[r + 1].top) / 2) { chosen = rows[r]; break; }
    }
    for (var i = 0; i < chosen.entries.length; i++) {
      var entry = chosen.entries[i];
      if (x < (entry.rect.left + entry.rect.right) / 2) return entry.index;
    }
    return chosen.entries[chosen.entries.length - 1].index + 1;
  };
  api.edgeSpeed = function (y, top, bottom) {
    if (y < top || y > bottom || bottom <= top) return 0;
    var band = Math.min(48, (bottom - top) / 3);
    if (y < top + band) return -600 * (top + band - y) / band;
    if (y > bottom - band) return 600 * (y - bottom + band) / band;
    return 0;
  };
})(window);
