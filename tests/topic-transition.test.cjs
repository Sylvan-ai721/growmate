const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('../frontend/node_modules/typescript');

// Exercise the actual async handler with delayed and failed API responses.
const source = ts.createSourceFile('page.tsx', fs.readFileSync(path.join(__dirname, '../frontend/app/page.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function find(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'handleGenerateTopics') handler = node;
  ts.forEachChild(node, find);
}
find(source);
assert.ok(handler);
const javascript = ts.transpileModule(handler.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;

function setup() {
  const profile = { session_id: 'test-session', profile: { type: 'knowledge' }, positioning: {} };
  const strategy = { next_focus: '验证评论率' };
  const state = { stage: 'review', selectedTopic: 'previous topic', diagnosis: 'previous report', profile, loading: false, topics: ['previous candidate'], rejections: [] };
  let resolve, reject;
  const response = new Promise((yes, no) => { resolve = yes; reject = no; });
  const bindings = {
    result: profile, customGoalText: '提升互动', strategyMemory: strategy,
    setTopicLoading: value => { state.loading = value; },
    setTopicError: value => { state.error = value; },
    resetAfterTopics: () => { state.selectedTopic = null; state.diagnosis = null; },
    requestJson: async (route, body) => { state.request = { route, body }; return response; },
    setRejectedTopics: value => { state.rejections = value; },
    setTopics: value => { state.topics = value; },
    setGraphTrace: value => { state.trace = value; },
    navigateToStage: value => { state.stage = value; },
  };
  const run = new Function(...Object.keys(bindings), `${javascript}; return handleGenerateTopics;`)(...Object.values(bindings));
  return { state, strategy, run, resolve, reject };
}

test('review stays intact during generation and advances only after success', async () => {
  const { state, strategy, run, resolve } = setup();
  const pending = run([{ title: 'previous topic' }]);
  assert.equal(state.stage, 'review');
  assert.equal(state.selectedTopic, 'previous topic');
  assert.equal(state.diagnosis, 'previous report');
  assert.equal(state.loading, true);
  assert.deepEqual(state.request.body.strategy_memory, strategy);
  resolve({ topics: [{ title: 'new topic' }], graph_trace: ['completed'] });
  await pending;
  assert.equal(state.stage, 'topics');
  assert.equal(state.selectedTopic, null);
  assert.equal(state.diagnosis, null);
  assert.equal(state.profile.session_id, 'test-session');
  assert.equal(state.topics[0].title, 'new topic');
  assert.equal(state.loading, false);
});

test('failed next round preserves report, candidates and rejections for retry', async () => {
  const { state, run, reject } = setup();
  const pending = run([{ title: 'previous topic' }]);
  reject(new Error('临时不可用'));
  await pending;
  assert.equal(state.stage, 'review');
  assert.equal(state.selectedTopic, 'previous topic');
  assert.equal(state.diagnosis, 'previous report');
  assert.deepEqual(state.topics, ['previous candidate']);
  assert.deepEqual(state.rejections, []);
  assert.equal(state.error, '临时不可用');
  assert.equal(state.loading, false);
});
