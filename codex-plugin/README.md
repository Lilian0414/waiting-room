# Waiting Room for Codex CLI

This adapter maps Codex lifecycle events onto Waiting Room's existing `/api/hook`
protocol. It does not change the lobby, matching, WebRTC, or room UI.

## Install this checkout

Use a current Codex build whose `hooks/list` output exposes `Stop`, `Interrupt`, and
`SessionEnd`. Add this repository as a local marketplace and install the plugin:

```sh
codex plugin marketplace add .
codex plugin add waiting-room@waiting-room
```

Waiting Room uses the same `~/.waiting-room` local state as the Claude plugin. Turn it
on once from the installed Codex plugin root (an invite is optional):

```sh
cd /path/to/installed/waiting-room
bash scripts/toggle.sh on [invite]
```

`WAITING_ROOM_URL`, `~/.waiting-room/endpoint`, and the browser command overrides work
exactly as documented in `plugin/README.md`.

## Lifecycle mapping

| Codex event | Waiting Room event |
| --- | --- |
| `UserPromptSubmit` | `started` |
| `PreToolUse`, `PostToolUse` | `tick` |
| `PermissionRequest` | `needs_you` |
| `Stop`, final assistant message ends in `?` | `paused` with `why: "question"` |
| other `Stop` | `stopped` |
| `Interrupt`, `SessionEnd` | `stopped` |

Hook JSON is read from stdin and its `session_id` is hashed locally. The outgoing body
always has exactly `token`, `event`, `why`, `session`, and `ts`. Prompts, working
directories, tool names and inputs, tool results, turn IDs, file contents, and assistant
messages are discarded.

For backward compatibility only, `signal.sh` still accepts Codex's legacy
`agent-turn-complete` notify JSON as its first argument. New installations do not need a
global `notify` setting because the bundled first-class `Stop` hook handles turn completion.

`SessionStart`, compaction, and subagent events are deliberately ignored; they do not
describe a user task lifecycle.

## Tests

```sh
node --test codex-plugin/test/*.test.js
```
