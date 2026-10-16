const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const context = vm.createContext({ window: { RA2: {} } });
for (const name of ['session', 'hit-test']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/ui/interaction', name + '.js'), 'utf8'), context);
const api = context.window.RA2.interaction;
const down = (kind = 'touch') => api.step(api.initial(), { type: 'down', pointerId: 2, kind, id: 'america', version: 'ra2', x: 10, y: 10 }).state;
test('Device threshold uses Euclidean CSS distance and preserves initial state', () => {
  const initial = down();
  assert.equal(api.step(initial, { type: 'move', pointerId: 2, x: 15, y: 15 }).state.phase, 'pressing');
  assert.equal(api.step(initial, { type: 'move', pointerId: 2, x: 16, y: 16 }).state.phase, 'dragging');
  assert.equal(initial.phase, 'pressing');
  assert.equal(api.step(down('pen'), { type: 'move', pointerId: 2, x: 15, y: 10 }).state.phase, 'dragging');
});
test('Tap selects once; drop includes final release coordinates and cannot repeat', () => {
  assert.equal(api.step(down(), { type: 'up', pointerId: 2, x: 10, y: 10 }).effect.type, 'select');
  const moved = api.step(down(), { type: 'move', pointerId: 2, x: 20, y: 20 }).state;
  const result = api.step(moved, { type: 'up', pointerId: 2, x: 300, y: 500 });
  assert.equal(result.effect.type, 'drop'); assert.equal(result.effect.y, 500);
  assert.equal(api.step(result.state, { type: 'up', pointerId: 2, x: 300, y: 500 }).effect, null);
});
test('Multitouch blocks remaining pointers until all are released', () => {
  const blocked = api.step(down(), { type: 'multi' });
  assert.equal(blocked.effect.type, 'cancel');
  assert.equal(api.step(blocked.state, { type: 'down', pointerId: 3 }).state.phase, 'blocked');
  assert.equal(api.step(blocked.state, { type: 'up', pointerId: 2 }).effect, null);
  assert.equal(api.step(blocked.state, { type: 'free' }).state.phase, 'idle');
});
test('Cancellation never emits a drop and unrelated pointers cannot move session', () => {
  const state = down();
  assert.equal(api.step(state, { type: 'move', pointerId: 3, x: 400, y: 400 }).effect, null);
  const cancelled = api.step(state, { type: 'cancel' });
  assert.equal(cancelled.state.phase, 'idle');
  assert.equal(api.step(cancelled.state, { type: 'up', pointerId: 2, x: 400, y: 400 }).effect, null);
});
test('Wrapped rows, gaps, empty zones and list ends have deterministic indices', () => {
  const cards = [
    { left: 0, right: 100, top: 0, bottom: 70 }, { left: 110, right: 210, top: 0, bottom: 70 },
    { left: 0, right: 100, top: 80, bottom: 150 }, { left: 110, right: 210, top: 80, bottom: 150 }
  ];
  assert.equal(api.insertion([], 1, 1), 0);
  assert.equal(api.insertion(cards, 20, 20), 0);
  assert.equal(api.insertion(cards, 105, 20), 1);
  assert.equal(api.insertion(cards, 220, 74), 2);
  assert.equal(api.insertion(cards, 20, 76), 2);
  assert.equal(api.insertion(cards, 200, 200), 4);
});
test('Edge speed is bounded, directional and zero outside usable viewport', () => {
  assert.equal(api.edgeSpeed(0, 0, 600), -600);
  assert.equal(api.edgeSpeed(600, 0, 600), 600);
  assert.equal(api.edgeSpeed(300, 0, 600), 0);
  assert.equal(api.edgeSpeed(601, 0, 600), 0);
  assert.equal(api.edgeSpeed(20, 60, 20), 0);
});
