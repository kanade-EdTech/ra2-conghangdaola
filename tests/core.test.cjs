const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function load() {
  const context = vm.createContext({ window: {} });
  for (const relative of ['data.js','data/units.js','data/others.js','data/buildings.js','data/signatures.js','core/catalog.js','core/ranking.js','core/storage.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', relative), 'utf8'), context);
  }
  return context.window.RA2;
}
function plain(value) { return JSON.parse(JSON.stringify(value)); }

test('Original has nine countries; Yuri belongs only to the expansion', () => {
  const { core } = load();
  assert.equal(core.ids('ra2').length, 9);
  assert.equal(core.ids('yr').length, 10);
  assert.equal(core.ids('ra2').includes('yuri'), false);
  assert.equal(core.ids('yr').includes('yuri'), true);
  assert.ok(core.validate(core.initial().boards['ra2|countries'], 'ra2'));
});

test('Moves are immutable and preserve ordering, including same-tier insertion', () => {
  const { core } = load();
  const initial = core.createBoard('ra2');
  let board = core.move(initial, 'ra2', 'america', 'hang');
  board = core.move(board, 'ra2', 'britain', 'hang');
  board = core.move(board, 'ra2', 'france', 'hang', 1);
  assert.deepEqual(plain(board.tiers.hang), ['america', 'france', 'britain']);
  board = core.move(board, 'ra2', 'america', 'hang', 2);
  assert.deepEqual(plain(board.tiers.hang), ['france', 'britain', 'america']);
  board = core.move(board, 'ra2', 'america', 'unranked');
  assert.equal(board.unranked.at(-1), 'america');
  assert.equal(initial.unranked.length, 9);
  assert.equal(initial.tiers.hang.length, 0);
  assert.throws(() => core.move(board, 'ra2', 'yuri', 'hang'));
  assert.throws(() => core.move(board, 'ra2', 'america', 'unknown'));
});

test('Deterministic mixed moves retain each country exactly once', () => {
  const { core } = load();
  for (const version of ['ra2', 'yr']) {
    let board = core.createBoard(version);
    const ids = core.ids(version);
    let seed = 73;
    function next(n) { seed = (seed * 1664525 + 1013904223) >>> 0; return seed % n; }
    for (let i = 0; i < 1500; i++) {
      board = core.move(board, version, ids[next(ids.length)], core.locations[next(6)], next(12));
      assert.ok(core.validate(board, version), 'Move ' + i);
    }
  }
});

test('Undo histories are isolated, capped at twenty and store copies', () => {
  const { core } = load();
  const history = core.createHistory();
  let board = core.createBoard('ra2');
  for (let i = 0; i < 25; i++) {
    board.title = String(i);
    history.push('ra2', board);
  }
  history.push('yr', core.createBoard('yr'));
  board.title = 'later';
  assert.equal(history.count('ra2'), 20);
  assert.equal(history.count('yr'), 1);
  assert.equal(history.pop('ra2').title, '24');
  assert.equal(history.pop('yr').unranked.length, 10);
  assert.equal(history.count('ra2'), 19);
});

test('Reset preserves title and does not mutate another version', () => {
  const { core } = load();
  const state = core.initial();
  state.boards['ra2|countries'] = core.move(state.boards['ra2|countries'], 'ra2', 'america', 'hang');
  state.boards['ra2|countries'].title = '个人榜';
  const reset = core.reset(state.boards['ra2|countries'], 'ra2');
  assert.equal(reset.title, '个人榜');
  assert.equal(reset.unranked.length, 9);
  assert.equal(state.boards['yr|countries'].unranked.length, 10);
  assert.equal(state.boards['ra2|countries'].tiers.hang.length, 1);
});

test('Known saves repair duplicate, missing and wrong-version IDs', () => {
  const { core } = load();
  const raw = core.initial();
  raw.boards['ra2|countries'].tiers.hang = ['america', 'america', 'yuri', '__proto__', null];
  raw.boards['ra2|countries'].tiers.top = ['america', 'france'];
  raw.boards['ra2|countries'].unranked = ['france', 'korea'];
  raw.lastGameVersion = 'not-a-version';
  const normalized = core.normalize(raw);
  assert.deepEqual(plain(normalized.boards['ra2|countries'].tiers.hang), ['america']);
  assert.deepEqual(plain(normalized.boards['ra2|countries'].tiers.top), ['france']);
  assert.equal(normalized.lastGameVersion, 'ra2');
  assert.ok(core.validate(normalized.boards['ra2|countries'], 'ra2'));
  assert.equal(normalized.boards['ra2|countries'].unranked[0], 'korea');
  raw.lastGameVersion = '__proto__';
  assert.equal(core.normalize(raw).lastGameVersion, 'ra2');
  assert.throws(() => core.ids('constructor'));
});

test('Legacy default titles migrate without changing rankings or custom titles', () => {
  const app = load();
  const raw = app.core.initial();
  raw.boards['ra2|countries'] = app.core.move(raw.boards['ra2|countries'], 'ra2', 'america', 'hang');
  raw.boards['yr|countries'] = app.core.move(raw.boards['yr|countries'], 'yr', 'yuri', 'top');
  raw.boards['ra2|countries'].title = '我的红警 2 国家喜好榜';
  raw.boards['yr|countries'].title = '我的尤复国家／阵营喜好榜';
  let value = JSON.stringify(raw);
  const storage = app.createStorage(() => ({ getItem: () => value, setItem: (_, text) => { value = text; } }));
  const loaded = storage.load();
  assert.equal(loaded.status, 'repaired');
  for (const version of ['ra2', 'yr']) {
    assert.equal(loaded.state.boards[version + '|countries'].title, '国家强度排序');
    assert.deepEqual(plain(loaded.state.boards[version + '|countries'].tiers), plain(raw.boards[version + '|countries'].tiers));
    assert.deepEqual(plain(loaded.state.boards[version + '|countries'].unranked), plain(raw.boards[version + '|countries'].unranked));
  }
  assert.equal(storage.save(loaded.state), 'saved');
  assert.equal(storage.load().status, 'restored');
  assert.equal(raw.boards['ra2|countries'].title, '我的红警 2 国家喜好榜');
  for (const title of ['个人喜好榜', '', '我的红警 2 国家喜好榜 · 自定义']) {
    raw.boards['ra2|countries'].title = title;
    assert.equal(app.core.normalize(raw).boards['ra2|countries'].title, title);
  }
});

test('Invalid save shapes and future versions are rejected; Unicode titles are limited by code point', () => {
  const { core } = load();
  const raw = core.initial();
  raw.schemaVersion = 99;
  assert.throws(() => core.normalize(raw));
  raw.schemaVersion = 1;
  raw.boards['ra2|countries'].tiers.hang = 'america';
  assert.throws(() => core.normalize(raw));
  assert.equal(Array.from(core.limitTitle('😀'.repeat(31))).length, 30);
});

test('Storage writes after normal restore and repairs; does not overwrite broken/future saves', () => {
  const app = load();
  let value = JSON.stringify(app.core.initial());
  const memory = { getItem: () => value, setItem: (_, next) => { value = next; } };
  const normal = app.createStorage(() => memory);
  assert.equal(normal.load().status, 'restored');
  assert.equal(normal.save(app.core.initial()), 'saved');
  for (const broken of ['{broken', '{"schemaVersion":2}']) {
    value = broken;
    const storage = app.createStorage(() => memory);
    assert.equal(storage.load().status, 'protected');
    assert.equal(storage.save(app.core.initial()), 'protected');
    assert.equal(value, broken);
  }
});

test('Read denial and quota exhaustion degrade without throwing', () => {
  const app = load();
  const denied = app.createStorage(() => { throw new Error('denied'); });
  assert.equal(denied.load().status, 'protected');
  assert.equal(denied.save(app.core.initial()), 'protected');
  const quota = app.createStorage(() => ({
    getItem: () => null, setItem: () => { throw new Error('quota'); }
  }));
  assert.equal(quota.load().status, 'new');
  assert.equal(quota.save(app.core.initial()), 'failed');
});
