(function (global) {
  'use strict';
  var app = global.RA2;
  var sources = ['cameos/aparicon', 'units/snipe', 'buildings/gtgcan', 'units/tnkd', 'units/beag',
    'units/ttnk', 'units/deso', 'units/terror', 'units/dtruck'];
  app.signatures = app.countries.filter(function (c) { return c.id !== 'yuri'; }).map(function (c, i) {
    return { id: 'signature:' + c.id, name: i === 0 ? '美国伞兵' : c.signature, kind: 'signature',
      countryName: c.name, faction: c.faction, categories:[['infantry','infantry','defense','ground','air','ground','infantry','infantry','ground'][i]],
      iconPath: './assets/unit-icons/ra2/' + sources[i] + '.png' };
  });
})(window);
