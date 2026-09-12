#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');

function value(input, ...names) {
  for (const name of names) if (input[name] !== undefined) return input[name];
  return undefined;
}

function eventName(input) {
  return value(input, 'hook_event_name', 'hookEventName') || '';
}

function endsWithQuestion(message) {
  if (typeof message !== 'string') return false;
  const lines = message.slice(-4000).split('\n').map((line) => line.trim()).filter(Boolean);
  return /\?$/.test(lines.at(-1) || '');
}

function classify(input) {
  if (value(input, 'type') === 'agent-turn-complete') {
    return endsWithQuestion(value(input, 'last-assistant-message', 'last_assistant_message'))
      ? { event: 'paused', why: 'question' }
      : { event: 'stopped', why: null };
  }

  switch (eventName(input)) {
    case 'SessionStart': return null;
    case 'UserPromptSubmit': return { event: 'started', why: null };
    case 'PreToolUse': return { event: 'tick', why: null };
    case 'PostToolUse': return { event: 'tick', why: null };
    case 'PermissionRequest': return { event: 'needs_you', why: null };
    case 'Stop':
      return endsWithQuestion(value(input, 'last_assistant_message', 'last-assistant-message'))
        ? { event: 'paused', why: 'question' }
        : { event: 'stopped', why: null };
    case 'Interrupt':
    case 'SessionEnd': return { event: 'stopped', why: null };
    default: return null;
  }
}

function sessionHash(id) {
  return crypto.createHash('sha256').update(id == null ? '' : String(id)).digest('hex').slice(0, 16);
}

function build(input, token, now) {
  const verdict = classify(input);
  if (!verdict) return null;
  return {
    token,
    event: verdict.event,
    why: verdict.why,
    session: sessionHash(value(input, 'session_id', 'sessionId', 'thread-id', 'thread_id')),
    ts: now,
  };
}

module.exports = { classify, endsWithQuestion, sessionHash, build };

if (require.main === module) {
  const MAX_INPUT = 4 * 1024 * 1024;
  setTimeout(() => process.exit(0), 5000).unref();
  let raw = process.argv[2] || '';
  const finish = () => {
    let input;
    try { input = JSON.parse(raw); } catch { return; }
    if (!input || typeof input !== 'object' || Array.isArray(input)) return;
    const body = build(input, process.env.WR_TOKEN || '', Date.now());
    if (body) process.stdout.write(JSON.stringify(body));
  };
  if (process.argv[2]) finish();
  else {
    process.stdin.setEncoding('utf8');
    process.stdin.on('error', () => process.exit(0));
    process.stdin.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > MAX_INPUT) process.exit(0);
    });
    process.stdin.on('end', finish);
  }
}
