'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { startLobby } = require('../../plugin/test/fake-lobby');
const { makeHome, removeHome, run, until, TOKEN } = require('../../plugin/test/helpers');

const SIGNAL = path.join(__dirname, '../scripts/signal.sh');
const FIXTURES = path.join(__dirname, 'fixtures');
const read = (name) => fs.readFileSync(path.join(FIXTURES, `${name}.json`), 'utf8');
const CASES = [
  ['user-prompt-submit', 'started', null, false],
  ['pre-tool-use', 'tick', null, false],
  ['post-tool-use', 'tick', null, false],
  ['permission-request', 'needs_you', null, false],
  ['stop', 'stopped', null, false],
  ['stop-question', 'paused', 'question', false],
  ['interrupt', 'stopped', null, false],
  ['session-end', 'stopped', null, false],
  ['turn-complete', 'stopped', null, true],
  ['turn-question', 'paused', 'question', true],
];

async function signal(name, notify, home, url) {
  const payload = read(name);
  return notify
    ? run('bash', [SIGNAL, payload], '', home, { WAITING_ROOM_URL: url })
    : run('bash', [SIGNAL], payload, home, { WAITING_ROOM_URL: url });
}

test('Codex hook and notify payloads reach the lobby as only five safe fields', async (t) => {
  const lobby = await startLobby();
  const { home } = makeHome();
  t.after(async () => { await lobby.close(); removeHome(home); });
  const secrets = ['/secret/repo', 'private', 'payroll', 'cat private.txt', 'PRIVATE FILE CONTENT', 'thread-secret', 'turn-secret'];

  for (const [name, event, why, notify] of CASES) {
    lobby.requests.length = 0;
    const result = await signal(name, notify, home, lobby.url);
    assert.deepStrictEqual({ status: result.status, stdout: result.stdout, stderr: result.stderr }, { status: 0, stdout: '', stderr: '' });
    assert.ok(await until(() => lobby.requests.some((request) => request.method === 'POST'), 3000), `${name} posted`);
    const posts = lobby.requests.filter((request) => request.method === 'POST');
    assert.strictEqual(posts.length, 1);
    assert.strictEqual(posts[0].path, '/api/hook');
    assert.deepStrictEqual(Object.keys(posts[0].json), ['token', 'event', 'why', 'session', 'ts']);
    assert.strictEqual(posts[0].json.token, TOKEN);
    assert.strictEqual(posts[0].json.event, event);
    assert.strictEqual(posts[0].json.why, why);
    for (const secret of secrets) assert.ok(!posts[0].raw.includes(secret), `${name} leaked ${secret}`);
  }
});
