(function (global) {
  'use strict';
  var app = global.RA2;
  var core = app.core;
  var storage = app.createStorage(function () { return global.localStorage; });
  var loaded = storage.load();
  var state = loaded.state;
  var history = core.createHistory();
  var dialog = app.createDialog();
  var boardElement = document.getElementById('tier-board');
  var poolElement = document.getElementById('country-pool');
  var titleInput = document.getElementById('board-title');
  var exportButton = document.getElementById('export-button');
  var undoButton = document.getElementById('undo-button');
  var titleBefore = null;
  var composing = false;
  var generating = false;
  var saveTimer = null;
  var toastTimer = null;
  var selected = null;
  var dragging = false;
  var dragController = null;
  var lastSpecialty = 'signatures';
  var selectionBar = document.getElementById('selection-bar');

  function cancelDrag() { if (dragController) dragController.cancel('app'); }
  function selectCountry(id) { selected = id; renderSelection(); }
  function renderSelection() {
    document.querySelectorAll('.workspace .country-card').forEach(function (node) {
      var active = node.getAttribute('data-item') === selected;
      node.classList.toggle('is-selected', active);
      node.querySelector('.card-main').setAttribute('aria-pressed', String(active));
    });
    selectionBar.hidden = !selected && !dragging;
    document.getElementById('selection-label').textContent = dragging ? '拖到目标档位 · 松手落位' : selected ? app.catalog.getItem(selected).name + ' · 已选中' : '';
    document.getElementById('selection-actions').hidden = dragging;
    document.getElementById('cancel-drag').hidden = !dragging;
    if (selected) {
      var position = core.locate(board(), selected);
      if (!position) { selected = null; renderSelection(); return; }
      document.getElementById('selection-prev').disabled = position.index === 0;
      document.getElementById('selection-next').disabled = position.index === core.list(board(), position.location).length - 1;
      document.getElementById('selection-unrank').disabled = position.location === 'unranked';
    }
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(text, className, handler) {
    var node = element('button', className, text);
    node.type = 'button';
    node.addEventListener('click', handler);
    return node;
  }
  var visibleLimits = {};
  function master() { return state.boards[state.activeBoardKey]; }
  function board() { return core.project(master(), state.activeContext); }
  function context() { return state.activeContext; }
  function toast(message) {
    var node = document.getElementById('toast');
    clearTimeout(toastTimer);
    node.textContent = message; node.hidden = false;
    toastTimer = setTimeout(function () { node.hidden = true; }, 3800);
  }
  function saveStatus(status) {
    var node = document.getElementById('save-status');
    var messages = {
      new: '排名会自动保存到本机',
      restored: '已恢复上次排名 · 仅保存在本机',
      repaired: '已更新并恢复本机草稿',
      migrated: '旧排名已合并恢复，正在保存新版草稿…',
      saved: '草稿已保存到本机',
      pending: '正在保存草稿…',
      failed: '草稿未能保存，当前排名仅保留在本次页面',
      protected: '草稿不可读取，当前仅保留本次排名；原草稿不会覆盖'
    };
    node.textContent = messages[status] || messages.new;
    node.classList.toggle('warning', status === 'failed' || status === 'protected');
  }
  function flush() {
    clearTimeout(saveTimer);
    saveTimer = null;
    saveStatus(storage.save(state));
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveStatus('pending');
    saveTimer = setTimeout(flush, 220);
  }
  function image(country) {
    var img = element('img', 'flag-image');
    var usingFaction = !country.iconPath;
    img.alt = usingFaction ? (app.factions[app.iconFaction(country)] || '中立／未指定阵营') + '标志' : '';
    img.width = 58; img.height = country.kind === 'country' ? 28 : 46;
    if (country.kind !== 'country') img.classList.add('unit-image');
    img.draggable = false;
    img.addEventListener('error', function () {
      if (!usingFaction) {
        usingFaction = true; img.alt = (app.factions[app.iconFaction(country)] || '中立／未指定阵营') + '标志';
        img.src = app.fallbackIcon(country); return;
      }
      var fallback = element('span', 'flag-fallback unit-fallback', app.factions[app.iconFaction(country)] || '中立');
      if (img.parentNode) img.parentNode.replaceChild(fallback, img);
    });
    img.src = app.itemIcon(country);
    return img;
  }
  function card(id) {
    var country = app.catalog.getItem(id);
    var outer = element('div', 'country-card' + (country.kind === 'country' ? '' : ' unit-card'));
    outer.setAttribute('data-item', id);
    var main = element('button', 'card-main');
    main.type = 'button'; main.setAttribute('aria-label', '为' + country.name + (country.kind === 'unit' ? '（' + (app.factions[country.faction] || '特殊单位') + '）' : country.kind === 'signature' ? '（' + country.countryName + '）' : '') + '定档');
    main.appendChild(image(country));
    main.appendChild(element('span', 'country-name', country.name));
    if (country.kind !== 'country') main.appendChild(element('small', 'card-caption', country.kind === 'signature' ? country.countryName : ['others','structures'].indexOf(country.rankingPool)!==-1 ? country.gameId : app.factions[country.faction] || '中立'));
    outer.appendChild(main);
    outer.appendChild(element('i', 'faction-dot ' + country.faction));
    var handle = element('span', 'drag-handle');
    handle.setAttribute('aria-hidden', 'true');
    handle.innerHTML = '<svg viewBox="0 0 12 20" aria-hidden="true"><g fill="currentColor"><circle cx="3" cy="4" r="1.3"/><circle cx="9" cy="4" r="1.3"/><circle cx="3" cy="10" r="1.3"/><circle cx="9" cy="10" r="1.3"/><circle cx="3" cy="16" r="1.3"/><circle cx="9" cy="16" r="1.3"/></g></svg>';
    outer.appendChild(handle);
    return outer;
  }
  function populate(container, ids, emptyText) {
    if (!ids.length) container.appendChild(element('span', 'empty-hint', emptyText));
    var zone = container.getAttribute('data-dropzone'), limit = visibleLimits[zone] || 40;
    ids.slice(0,limit).forEach(function (id) { container.appendChild(card(id)); });
    if(ids.length>limit) container.appendChild(button('再显示 '+Math.min(40,ids.length-limit)+' 项（剩余 '+(ids.length-limit)+'）','show-more',function(){ cancelDrag(); visibleLimits[zone]=limit+40; render(); }));
  }
  function render() {
    var current = board();
    boardElement.textContent = '';
    app.tiers.forEach(function (tier) {
      var row = element('div', 'tier-row');
      var label = element('div', 'tier-label');
      label.style.backgroundColor = tier.color;
      label.appendChild(element('strong', '', tier.name));
      label.appendChild(element('small', '', tier.hint));
      var list = element('div', 'card-list');
      list.setAttribute('data-dropzone', tier.id);
      list.setAttribute('role', 'group'); list.setAttribute('aria-label', tier.name + '档');
      populate(list, current.tiers[tier.id], '点选卡片，或拖到这一档');
      row.appendChild(label); row.appendChild(list); boardElement.appendChild(row);
    });
    poolElement.textContent = '';
    populate(poolElement, current.unranked, '全部定档完毕！也可以把卡片移回来。');
    var total = core.ids(context()).length;
    var placed = total - current.unranked.length;
    document.getElementById('progress-label').textContent = '已排 ' + placed + ' / ' + total;
    document.getElementById('progress-bar').style.width = (total ? placed / total * 100 : 0) + '%';
    document.getElementById('pool-count').textContent = current.unranked.length;
    if (document.activeElement !== titleInput) titleInput.value = current.title;
    document.getElementById('title-count').textContent = Array.from(titleInput.value).length + '/30';
    document.querySelectorAll('[data-version]').forEach(function (node) {
      var version=node.getAttribute('data-version'),mode=context().mode;
      node.hidden=version==='combined'&&mode!=='signatures';
      node.setAttribute('aria-pressed',String(version===context().version));
      if(!node.hidden)node.querySelector('span').textContent=app.catalog.ids({mode:mode,version:version}).length+' 项';
    });
    undoButton.disabled = !total || !history.count(state.activeBoardKey);
    renderControls(total);
    renderSelection();
  }
  function commit(next) {
    if (!core.validate(next, context())) { toast('排名数据校验失败，请重试'); return false; }
    if (JSON.stringify(next) === JSON.stringify(board())) return false;
    history.push(state.activeBoardKey, master());
    state.boards[state.activeBoardKey] = core.mergeView(master(), context(), next);
    render(); scheduleSave();
    return true;
  }
  function move(id, target, index) {
    try {
      var changed = commit(core.move(board(), context(), id, target, index));
      if (changed) {
        var tier = app.tiers.filter(function (value) { return value.id === target; })[0];
        toast(app.catalog.getItem(id).name + '已移至' + (tier ? tier.name + '档' : '待排名'));
      }
    } catch (error) { toast(error.message || '移动失败，请重试'); }
  }
  function finishTitle() {
    if (titleBefore === null) return;
    var current = board();
    if (current.title !== titleBefore) {
      var previous = core.clone(master());
      previous.title = titleBefore;
      history.push(state.activeBoardKey, previous);
      undoButton.disabled = false;
    }
    titleBefore = null;
  }
  function updateTitle() {
    if (composing) return;
    var value = core.limitTitle(titleInput.value);
    titleInput.value = value;
    master().title = value;
    document.getElementById('title-count').textContent = Array.from(value).length + '/30';
    scheduleSave();
  }
  titleInput.addEventListener('focus', function () { titleBefore = board().title; });
  titleInput.addEventListener('input', updateTitle);
  titleInput.addEventListener('compositionstart', function () { composing = true; });
  titleInput.addEventListener('compositionend', function () { composing = false; updateTitle(); });
  titleInput.addEventListener('blur', finishTitle);

  function openCountry(id) {
    cancelDrag();
    var country = app.catalog.getItem(id);
    var position = core.locate(board(), id);
    var wrapper = element('div');
    var detail = element('div', 'country-detail');
    detail.appendChild(image(country));
    var text = element('div');
    var heading = element('h2', '', country.name);
    heading.id = 'modal-title';
    text.appendChild(heading);
    text.appendChild(element('p', '', app.catalog.detail(country)));
    detail.appendChild(text); wrapper.appendChild(detail);
    wrapper.appendChild(element('p', 'modal-description', '给它选一档，排出你的看法。'));
    var choices = element('div', 'choice-grid');
    app.tiers.forEach(function (tier) {
      var choice = button(tier.name, 'tier-choice', function () {
        if (position.location !== tier.id) move(id, tier.id);
        dialog.hide(); focusCard(id);
      });
      choice.style.backgroundColor = tier.color;
      choice.setAttribute('aria-label', '移至' + tier.name + '档');
      choice.setAttribute('aria-pressed', String(position.location === tier.id));
      choices.appendChild(choice);
    });
    wrapper.appendChild(choices);
    var actions = element('div', 'modal-actions');
    var previous = button('← 前移', 'secondary-button', function () {
      move(id, position.location, position.index - 1); dialog.hide(); focusCard(id);
    });
    previous.disabled = position.index === 0;
    var next = button('后移 →', 'secondary-button', function () {
      move(id, position.location, position.index + 1); dialog.hide(); focusCard(id);
    });
    next.disabled = position.index === core.list(board(), position.location).length - 1;
    var unrank = button('移回待排名', 'secondary-button', function () {
      move(id, 'unranked'); dialog.hide(); focusCard(id);
    });
    unrank.disabled = position.location === 'unranked';
    actions.appendChild(previous); actions.appendChild(next); actions.appendChild(unrank);
    wrapper.appendChild(actions);
    wrapper.appendChild(element('p', 'modal-note', '同档卡片从左到右排列；排名依据由你决定。'));
    dialog.show(wrapper);
  }
  function focusCard(id) {
    var node = document.querySelector('[data-item="' + id + '"] .card-main');
    if (node) node.focus();
  }
  document.getElementById('selection-edit').addEventListener('click', function () { if (selected) openCountry(selected); });
  document.getElementById('selection-prev').addEventListener('click', function () {
    if (!selected) return;
    var position = core.locate(board(), selected); move(selected, position.location, position.index - 1);
  });
  document.getElementById('selection-next').addEventListener('click', function () {
    if (!selected) return;
    var position = core.locate(board(), selected); move(selected, position.location, position.index + 1);
  });
  document.getElementById('selection-unrank').addEventListener('click', function () { if (selected) move(selected, 'unranked'); });
  document.getElementById('cancel-drag').addEventListener('click', cancelDrag);
  function switchBoard(raw) {
    if (composing || generating) { toast('请先完成当前输入或图片生成'); return; }
    finishTitle(); updateTitle(); cancelDrag(); selected = null; closeSecret(false); flush();
    var nextContext = app.catalog.context(raw), key = app.catalog.key(nextContext);
    if (nextContext.version !== 'combined') state.lastGameVersion = nextContext.version;
    if (nextContext.mode === 'units') state.lastRegularContexts[nextContext.version] = nextContext;
    core.ensureBoard(state,nextContext);
    state.activeContext=nextContext; state.activeBoardKey=key; state.lastContexts[key]=nextContext;
    visibleLimits={}; render(); flush();
  }
  function draftContext() {
    return app.catalog.context({mode:context().mode,version:context().version,
      category:document.getElementById('filter-category').value,faction:document.getElementById('filter-faction').value,
      stage:document.getElementById('filter-stage').value,source:document.getElementById('filter-source').value,
      hideNational:document.getElementById('filter-national').checked});
  }
  function previewFilters() { document.getElementById('filter-preview').textContent='匹配 '+app.catalog.ids(draftContext()).length+' 项 · 档位与同行顺序自动保存'; }
  function options(id,values,selected) {
    var select=document.getElementById(id);select.textContent='';
    Object.keys(values).forEach(function(key){var option=element('option','',values[key]);option.value=key;select.appendChild(option);});select.value=selected;
  }
  function renderControls(total) {
    var c=context(),regular=c.mode==='units',specialty=['signatures','t4','others','structures'].indexOf(c.mode)!==-1;
    if(specialty)lastSpecialty=c.mode;
    document.getElementById('specialty-tabs').hidden=!specialty;
    document.getElementById('version-tabs').hidden=false;
    document.getElementById('unit-controls').hidden=c.mode==='countries';
    document.getElementById('t4-heading').hidden=c.mode!=='t4';
    document.getElementById('context-summary').textContent=app.catalog.summary(c);
    document.getElementById('empty-state').hidden=total!==0; document.querySelector('.workspace').hidden=total===0;
    titleInput.disabled=!total;exportButton.disabled=!total||generating;document.getElementById('reset-button').disabled=!total;
    document.querySelectorAll('[data-mode]').forEach(function(n){n.setAttribute('aria-pressed',String(n.getAttribute('data-mode')===(specialty?'signatures':c.mode)));});
    document.querySelectorAll('[data-specialty]').forEach(function(n){n.setAttribute('aria-pressed',String(n.getAttribute('data-specialty')===c.mode));});
    document.body.classList.toggle('is-t4',c.mode==='t4');
    if(c.mode!=='countries') {
      var categories={},factions={all:'全部阵营',allied:'盟军',soviet:'苏军'};
      var allowed=c.mode==='structures'?['all','building','defense']:c.mode==='others'?['all','infantry','ground','naval','air','animal']:c.mode==='t4'?['all','infantry']:['all','infantry','ground','naval','air','building','defense'];
      allowed.forEach(function(k){categories[k]=app.categories[k];});
      if(c.version!=='ra2'||!regular)factions.yuri='尤里';
      if(c.mode==='others'||c.mode==='structures')factions.neutral='中立';
      options('filter-category',categories,c.category);options('filter-faction',factions,c.faction);
      options('filter-stage',app.stages,c.stage||'all');
      options('filter-source',c.mode==='structures'?{all:'全部来源',neutral:'中立',campaign:'战役'}:{all:'全部来源',campaign:'战役',civilian:'平民',hidden:'隐藏'},c.source||'all');
      document.getElementById('stage-field').hidden=!regular;
      document.getElementById('source-field').hidden=c.mode!=='others'&&c.mode!=='structures';
      document.getElementById('national-field').hidden=!regular;
      document.getElementById('filter-national').checked=!!c.hideNational;
      document.getElementById('secret-button').hidden=!regular;
      previewFilters();
    }
  }
  document.querySelectorAll('[data-version]').forEach(function(node){node.addEventListener('click',function(){
    var c=core.clone(context());c.version=node.getAttribute('data-version');switchBoard(c);
  });});
  function enterMode(mode,version) {
    var raw={mode:mode,version:version},key=app.catalog.key(raw);
    switchBoard(state.lastContexts[key] || (mode==='units'?state.lastRegularContexts[version]:raw));
  }
  document.querySelectorAll('[data-mode]').forEach(function(node){node.addEventListener('click',function(){
    var mode=node.getAttribute('data-mode');if(mode==='signatures')mode=lastSpecialty;
    enterMode(mode,mode==='signatures'?'combined':state.lastGameVersion);
  });});
  document.querySelectorAll('[data-specialty]').forEach(function(node){node.addEventListener('click',function(){
    var mode=node.getAttribute('data-specialty');enterMode(mode,mode==='signatures'?'combined':state.lastGameVersion);
  });});
  ['category','faction','stage','source','national'].forEach(function(field){document.getElementById('filter-'+field).addEventListener('change',previewFilters);});
  document.getElementById('apply-filters').addEventListener('click',function(){switchBoard(draftContext());});
  document.getElementById('clear-filters').addEventListener('click',function(){switchBoard(app.catalog.base(context()));});
  document.getElementById('clear-all-filters').addEventListener('click',function(){switchBoard(app.catalog.base(context()));});
  document.getElementById('toggle-filters').addEventListener('click',function(){
    var panel=document.getElementById('filter-fields');panel.hidden=!panel.hidden;
    this.setAttribute('aria-expanded',String(!panel.hidden));this.textContent=panel.hidden?'展开筛选':'收起筛选';
  });
  function closeSecret(focus) {
    document.getElementById('secret-panel').hidden = true;
    document.getElementById('secret-button').setAttribute('aria-expanded','false');
    if (focus) document.getElementById('secret-button').focus();
  }
  document.getElementById('secret-button').addEventListener('click', function () {
    cancelDrag(); var panel = document.getElementById('secret-panel');
    if (!panel.hidden) { closeSecret(true); return; }
    document.getElementById('secret-version').textContent = app.versions[state.lastGameVersion];
    panel.hidden = false; this.setAttribute('aria-expanded','true');
    document.getElementById('enter-t4').focus();
  });
  document.getElementById('close-secret').addEventListener('click', function () { closeSecret(true); });
  document.getElementById('enter-t4').addEventListener('click', function () { switchBoard({mode:'t4',version:state.lastGameVersion}); });
  document.getElementById('return-units').addEventListener('click', function () { switchBoard(state.lastRegularContexts[state.lastGameVersion]); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !document.getElementById('secret-panel').hidden) closeSecret(true); });
  function undo() {
    if (!core.ids(context()).length) return;
    cancelDrag();
    finishTitle();
    var previous = history.pop(state.activeBoardKey);
    if (!previous) return;
    state.boards[state.activeBoardKey] = previous;
    render(); scheduleSave(); toast('已撤销上一步');
  }
  undoButton.addEventListener('click', undo);
  document.addEventListener('keydown', function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' &&
        event.target.tagName !== 'INPUT' && !dialog.isOpen()) {
      event.preventDefault(); undo();
    }
  });
  document.getElementById('reset-button').addEventListener('click', function () {
    cancelDrag();
    var wrapper = element('div');
    var heading = element('h2', '', '重新排名？'); heading.id = 'modal-title';
    wrapper.appendChild(heading);
    wrapper.appendChild(element('p', 'modal-description', '将' + app.catalog.summary(context()) + '的卡片全部移回待排名。榜单名称会保留，也可以撤销这一步。'));
    var actions = element('div', 'modal-actions');
    actions.appendChild(button('保留排名', 'secondary-button', dialog.hide));
    actions.appendChild(button('确认重置', 'primary-button', function () {
      commit(core.reset(board(), context())); dialog.hide(); toast('已重新开始，仍可撤销');
    }));
    wrapper.appendChild(actions); dialog.show(wrapper);
  });

  async function exportPoster(width, pageIndex) {
    if (generating) return;
    cancelDrag();
    finishTitle(); flush();
    generating = true; exportButton.disabled = true; exportButton.textContent = '正在生成…';
    var snapshot = core.clone(board());
    var version = core.clone(context());
    try {
      var poster = await app.createPoster(snapshot, version, width, pageIndex);
      var wrapper = element('div', 'poster-content');
      var heading = element('h2', '', '你的排名，已就位。'); heading.id = 'modal-title';
      wrapper.appendChild(heading);
      wrapper.appendChild(element('p', 'modal-description', app.catalog.summary(version) + ' · ' + poster.width + ' × ' + poster.height));
      var preview = element('img', 'poster-preview'); preview.src = poster.data;
      preview.alt = (snapshot.title || '我的排名') + '结果图，' + app.catalog.summary(version);
      var previewScroll = element('div', 'poster-scroll');
      previewScroll.tabIndex = 0;
      previewScroll.setAttribute('role', 'region');
      previewScroll.setAttribute('aria-label', '结果图预览，可上下滚动');
      previewScroll.appendChild(preview); wrapper.appendChild(previewScroll);
      if(poster.pageCount>1) {
        var pager=element('div','poster-pager');
        var prevPage=button('上一页','secondary-button',function(){dialog.hide();exportPoster(width,poster.page-1);});
        var nextPage=button('下一页','secondary-button',function(){dialog.hide();exportPoster(width,poster.page+1);});
        prevPage.disabled=poster.page===0;nextPage.disabled=poster.page===poster.pageCount-1;
        pager.appendChild(prevPage);pager.appendChild(element('span','','第 '+(poster.page+1)+' / '+poster.pageCount+' 页 · 逐页保存'));pager.appendChild(nextPage);wrapper.appendChild(pager);
      }
      var note = element('p', 'modal-note', app.platform.hint);
      var actions = element('div', 'poster-actions');
      var save = button('保存图片', 'primary-button', async function () {
        save.disabled = true; save.textContent = '正在保存…';
        try {
          var message = await app.platform.saveImage(poster.data, 'ra2-tier-list-' + version.version + '-' + version.mode + '-'+(poster.page+1)+'.png');
          note.textContent = message; toast(message);
        } catch (error) {
          var message = error.errMsg || error.message || '保存未完成，请检查相册权限后重试';
          note.textContent = message; toast(message);
        } finally { save.disabled = false; save.textContent = '保存图片'; }
      });
      var light = button(width === 720 ? '已是轻量画质' : '轻量画质', 'secondary-button', function () {
        dialog.hide(); exportPoster(720,pageIndex);
      });
      light.disabled = width === 720;
      actions.appendChild(save); actions.appendChild(light);
      wrapper.appendChild(actions); wrapper.appendChild(note);
      dialog.show(wrapper, { poster: true, cleanup: function () { preview.removeAttribute('src'); poster.data = ''; } });
    } catch (error) {
      var wrapper = element('div');
      var heading = element('h2', '', '图片暂未生成'); heading.id = 'modal-title';
      wrapper.appendChild(heading);
      wrapper.appendChild(element('p', 'modal-description', error.message || '请稍后重试，当前排名会保留。'));
      wrapper.appendChild(button('用轻量画质重试', 'primary-button', function () { dialog.hide(); exportPoster(720); }));
      dialog.show(wrapper);
    } finally {
      generating = false; exportButton.disabled = false;
      exportButton.innerHTML = '生成结果图 <span aria-hidden="true">↗</span>';
    }
  }
  exportButton.addEventListener('click', function () { exportPoster(1080); });
  dragController = app.installDrag(document.querySelector('.workspace'), {
    controlsRoot: document.body,
    disabled: function () { return dialog.isOpen() || generating || !core.ids(context()).length; },
    getVersion: function () { return JSON.stringify(context()); },
    move: move,
    select: selectCountry,
    dragging: function (value) { dragging = value; renderSelection(); }
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden) { closeSecret(false); flush(); } });
  global.addEventListener('pagehide', function () { closeSecret(false); flush(); });
  if (global.visualViewport) {
    global.visualViewport.addEventListener('resize', function () {
      document.getElementById('modal').style.maxHeight = Math.floor(global.visualViewport.height * .85) + 'px';
    });
  }
  render(); saveStatus(loaded.status);
  if (loaded.status === 'migrated') flush();
})(window);
