'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const classifier = require('../scripts/classify.js');

const FIXTURES = path.join(__dirname, 'fixtures');
const read = (name) => fs.readFileSync(path.join(FIXTURES, `${name}.json`), 'utf8');
const CASES = [
  ['user-prompt-submit', 'started', null],
  ['pre-tool-use', 'tick', null],
  ['post-tool-use', 'tick', null],
  ['permission-request', 'needs_you', null],
  ['stop', 'stopped', null],
  ['stop-question', 'paused', 'question'],
  ['interrupt', 'stopped', null],
  ['session-end', 'stopped', null],
  ['turn-complete', 'stopped', null],
  ['turn-question', 'paused', 'question'],
];

test('Codex lifecycle payloads map to the lobby protocol', () => {
  for (const [name, event, why] of CASES) {
    assert.deepStrictEqual(classifier.classify(JSON.parse(read(name))), { event, why }, name);
  }
});

test('both hook and notify session identifiers are hashed', () => {
  const want = crypto.createHash('sha256').update('thread-secret').digest('hex').slice(0, 16);
  for (const name of ['user-prompt-submit', 'turn-complete']) {
    assert.strictEqual(classifier.build(JSON.parse(read(name)), 'tok', 123).session, want);
  }
});

test('the adapter emits exactly five safe fields and no task data', () => {
  const secrets = ['/secret/repo', 'private', 'payroll', 'cat private.txt', 'PRIVATE FILE CONTENT', 'thread-secret', 'turn-secret'];
  for (const [name] of CASES) {
    const run = spawnSync(process.execPath, [path.join(__dirname, '../scripts/classify.js')], {
      input: read(name), env: { ...process.env, WR_TOKEN: 'tok' }, encoding: 'utf8',
    });
    assert.strictEqual(run.status, 0);
    assert.strictEqual(run.stderr, '');
    assert.deepStrictEqual(Object.keys(JSON.parse(run.stdout)), ['token', 'event', 'why', 'session', 'ts']);
    for (const secret of secrets) assert.ok(!run.stdout.includes(secret), `${name} leaked ${secret}`);
    assert.ok(run.stdout.length < 160);
  }
});

test('notify argv input is supported and unrelated events stay silent', () => {
  const script = path.join(__dirname, '../scripts/classify.js');
  const notify = spawnSync(process.execPath, [script, read('turn-complete')], {
    env: { ...process.env, WR_TOKEN: 'tok' }, encoding: 'utf8',
  });
  assert.strictEqual(JSON.parse(notify.stdout).event, 'stopped');
  for (const input of ['', 'bad json', '{}', '[]', '{"hook_event_name":"PreCompact"}']) {
    const run = spawnSync(process.execPath, [script], { input, env: { ...process.env, WR_TOKEN: 'tok' }, encoding: 'utf8' });
    assert.strictEqual(run.status, 0);
    assert.strictEqual(run.stdout, '');
    assert.strictEqual(run.stderr, '');
  }
});

test('bundled hook configuration uses every required Codex hook and timeoutSec', () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../hooks/hooks.json'), 'utf8'));
  assert.deepStrictEqual(Object.keys(config.hooks), [
    'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PermissionRequest',
    'Stop', 'Interrupt', 'SessionEnd',
  ]);
  for (const [event, matchers] of Object.entries(config.hooks)) {
    assert.strictEqual(matchers.length, 1, event);
    const hook = matchers[0].hooks[0];
    assert.strictEqual(hook.timeoutSec, 5, event);
    assert.ok(!Object.hasOwn(hook, 'timeout'), event);
    assert.match(hook.command, /\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/signal\.sh$/);
  }
});

test('installed plugin contains its own setup entry point', () => {
  const toggle = path.join(__dirname, '../scripts/toggle.sh');
  assert.ok(fs.statSync(toggle).isFile());
  assert.match(fs.readFileSync(toggle, 'utf8'), /WR_HERE=.*BASH_SOURCE/);
});
