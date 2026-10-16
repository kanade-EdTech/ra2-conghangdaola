(function (global) {
  'use strict';
  var app = global.RA2 = global.RA2 || {};
  app.versions = { ra2: '红警 2 原版', yr: '尤里的复仇' };
  app.tiers = [
    { id: 'hang', name: '夯', color: '#f36b61', hint: '巅峰，毋庸置疑' },
    { id: 'top', name: '顶级', color: '#f4a45f', hint: '实力在线' },
    { id: 'elite', name: '人上人', color: '#e8cd67', hint: '有点东西' },
    { id: 'npc', name: 'NPC', color: '#a9cf82', hint: '中规中矩' },
    { id: 'la', name: '拉', color: '#81bfc6', hint: '这次排在最后' }
  ];
  app.factions = { allied: '盟军', soviet: '苏军', yuri: '尤里' };
  app.factionIcons = { allied: './assets/factions/allied.png', soviet: './assets/factions/soviet.png',
    yuri: './assets/factions/yuri.png', neutral: './assets/factions/neutral.png' };
  app.iconFaction = function (item) {
    var faction = item.iconFaction || item.faction;
    return Object.prototype.hasOwnProperty.call(app.factionIcons,faction) ? faction : 'neutral';
  };
  app.fallbackIcon = function (item) { return app.factionIcons[app.iconFaction(item)]; };
  app.itemIcon = function (item) { return item.iconPath || app.fallbackIcon(item); };
  app.countries = [
    ['america', '美国', 'allied', '伞兵'],
    ['britain', '英国', 'allied', '狙击手'],
    ['france', '法国', 'allied', '巨炮'],
    ['germany', '德国', 'allied', '坦克杀手'],
    ['korea', '韩国', 'allied', '黑鹰战机'],
    ['russia', '苏俄', 'soviet', '磁能坦克'],
    ['iraq', '伊拉克', 'soviet', '辐射工兵'],
    ['cuba', '古巴', 'soviet', '恐怖分子'],
    ['libya', '利比亚', 'soviet', '自爆卡车'],
    ['yuri', '尤里', 'yuri', '心灵控制阵营']
  ].map(function (row) {
    return {
      id: row[0], name: row[1], faction: row[2], signature: row[3],
      versions: row[0] === 'yuri' ? ['yr'] : ['ra2', 'yr'],
      iconPath: './assets/countries/' + row[0] + '.png'
    };
  });
  app.countryById = {};
  app.countries.forEach(function (country) { app.countryById[country.id] = country; });
})(window);
