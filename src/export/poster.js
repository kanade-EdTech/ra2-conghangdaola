(function (global) {
  'use strict';
  var app = global.RA2;
  var cache = Object.create(null);
  var font = '"Microsoft YaHei", "PingFang SC", sans-serif';
  function loadImage(path) {
    if (!path) return Promise.resolve(null);
    if (cache[path]) return cache[path];
    cache[path] = new Promise(function (resolve) {
      var image = new Image();
      var done = false;
      var timer = setTimeout(function () { finish(null); }, 4000);
      function finish(value) {
        if (done) return;
        done = true; clearTimeout(timer);
        if (!value) delete cache[path];
        image.onload = null; image.onerror = null;
        resolve(value);
      }
      image.onload = function () { finish(image); };
      image.onerror = function () { finish(null); };
      image.src = path;
    });
    return cache[path];
  }
  function wrap(ctx, text, width) {
    var lines = []; var line = '';
    Array.from(text).forEach(function (character) {
      if (line && ctx.measureText(line + character).width > width) { lines.push(line); line = ''; }
      line += character;
    });
    if (line) lines.push(line);
    return lines.length ? lines : ['我的排名'];
  }
  app.createPoster = async function (board, version, width, pageIndex) {
    width = width === 720 ? 720 : 1080;
    if (!app.core.validate(board, version)) throw new Error('榜单数据无效，无法导出');
    var orderedIds = [];
    app.core.locations.forEach(function(location) { orderedIds = orderedIds.concat(app.core.list(board,location)); });
    var pageCount = Math.max(1,Math.ceil(orderedIds.length/50));
    pageIndex = Math.max(0,Math.min(pageCount-1,Math.floor(pageIndex || 0)));
    var countryIds = orderedIds.slice(pageIndex*50,(pageIndex+1)*50), onPage = new Set(countryIds);
    var loaded = new Array(countryIds.length), cursor = 0;
    async function worker() {
      while (cursor < countryIds.length) {
        var index = cursor++, item = app.catalog.getItem(countryIds[index]);
        loaded[index] = await loadImage(app.itemIcon(item));
        if (!loaded[index] && item.iconPath) loaded[index] = await loadImage(app.fallbackIcon(item));
      }
    }
    await Promise.all(Array.from({length: Math.min(6,countryIds.length)}, worker));
    var images = {};
    countryIds.forEach(function (id, index) { images[id] = loaded[index]; });
    var canvas = document.createElement('canvas');
    canvas.width = 1; canvas.height = 1;
    var ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('当前环境无法绘制图片，请使用系统截图');
    var scale = width / 1080;
    ctx.font = 'bold ' + (46 * scale) + 'px ' + font;
    var titleLines = wrap(ctx, board.title || '我的排名', 910 * scale);
    ctx.font = '22px ' + font;
    var summaryLines = wrap(ctx, app.catalog.summary(version)+(pageCount>1?' · 第 '+(pageIndex+1)+' / '+pageCount+' 页':''), 980);
    var header = 160 + titleLines.length * 58 + summaryLines.length * 29;
    var sections = app.tiers.map(function (tier) {
      return { name: tier.name, color: tier.color, ids: board.tiers[tier.id].filter(function(id){return onPage.has(id);}) };
    });
    var unrankedPage = board.unranked.filter(function(id){return onPage.has(id);});
    if (unrankedPage.length) sections.push({ name: '待排名', color: '#a2a9aa', ids: unrankedPage });
    var height = header + 122;
    sections.forEach(function (section) {
      section.height = Math.max(118, Math.ceil(section.ids.length / 5) * 152 + 22);
      height += section.height;
    });
    if (width * Math.ceil(height * scale) > 4000000) throw new Error('图片尺寸较大，请使用轻量画质');
    canvas.width = width; canvas.height = Math.ceil(height * scale);
    ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#131719'; ctx.fillRect(0, 0, 1080, height);
    ctx.fillStyle = '#ee6258'; ctx.fillRect(0, 0, 1080, 8);
    ctx.fillStyle = '#a2a9aa'; ctx.font = '19px ' + font;
    ctx.fillText('红色警戒 2  /  从夯到拉', 48, 58);
    ctx.fillStyle = '#f1eee8'; ctx.font = 'bold 46px ' + font;
    titleLines.forEach(function (line, index) { ctx.fillText(line, 48, 125 + index * 58); });
    ctx.fillStyle = '#a2a9aa'; ctx.font = '22px ' + font;
    var placed = orderedIds.length - board.unranked.length;
    summaryLines.forEach(function (line,index) { ctx.fillText(line,48,header - 52 - (summaryLines.length - 1 - index) * 29); });
    ctx.font = '18px ' + font; ctx.fillText('已排 ' + placed + ' / ' + orderedIds.length+(pageCount>1?' · 本页 '+countryIds.length+' 项':''),48,header - 20);
    var y = header;
    sections.forEach(function (section) {
      ctx.fillStyle = '#1c2225'; ctx.fillRect(48, y, 984, section.height - 4);
      ctx.fillStyle = section.color; ctx.fillRect(48, y, 130, section.height - 4);
      ctx.fillStyle = '#202529'; ctx.font = 'bold ' + (section.name.length > 2 ? 28 : 36) + 'px ' + font;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(section.name, 113, y + (section.height - 4) / 2);
      section.ids.forEach(function (id, index) {
        var country = app.catalog.getItem(id);
        var x = 194 + (index % 5) * 165;
        var cy = y + 12 + Math.floor(index / 5) * 152;
        ctx.fillStyle = '#2a3338'; ctx.fillRect(x, cy, 153, 136);
        ctx.imageSmoothingEnabled = false;
        if (images[id]) {
          var boxW = country.kind === 'country' ? 99 : 80, boxH = country.kind === 'country' ? 48 : 64;
          var ratio = Math.min(boxW / images[id].naturalWidth, boxH / images[id].naturalHeight);
          var iw = images[id].naturalWidth * ratio, ih = images[id].naturalHeight * ratio;
          ctx.drawImage(images[id],x+76-iw/2,cy+8+(boxH-ih)/2,iw,ih);
        }
        else {
          ctx.fillStyle = '#c5c9cc'; ctx.font = 'bold 25px ' + font;
          ctx.fillText(app.factions[app.iconFaction(country)] || '中立', x + 76, cy + 36);
        }
        ctx.fillStyle = '#f1eee8'; ctx.font = '21px ' + font;
        var nameLines = wrap(ctx,country.name,140);
        nameLines.slice(0,2).forEach(function(line,i) { ctx.fillText(line,x+76,cy+84+i*23); });
        if (country.kind !== 'country') { ctx.fillStyle = '#b9c0bd'; ctx.font = '16px ' + font; ctx.fillText(country.countryName || (['others','structures'].indexOf(country.rankingPool)!==-1 ? country.gameId : app.factions[country.faction]) || '中立',x+76,cy+122); }
      });
      if (!section.ids.length) {
        ctx.textAlign = 'left'; ctx.fillStyle = '#859094'; ctx.font = '23px ' + font;
        ctx.fillText('这一档暂时空着', 210, y + section.height / 2);
      }
      y += section.height;
    });
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.font = '19px ' + font;
    ctx.fillStyle = '#a2a9aa'; ctx.fillText('个人游戏体验 · 仅供交流', 48, y + 55);
    ctx.textAlign = 'right'; ctx.fillText('我的排名，我来定档。', 1032, y + 55);
    var data = canvas.toDataURL('image/png');
    if (!data || data === 'data:,') throw new Error('图片生成失败，请使用轻量画质重试');
    var dimensions = { width: canvas.width, height: canvas.height };
    canvas.width = 1; canvas.height = 1;
    return { data: data, width: dimensions.width, height: dimensions.height, page: pageIndex, pageCount: pageCount, itemIds: countryIds };
  };
})(window);
