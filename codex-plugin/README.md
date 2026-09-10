# Waiting Room for Codex CLI

This adapter maps Codex lifecycle events onto Waiting Room's existing `/api/hook`
protocol. It does not change the lobby, matching, WebRTC, or room UI.

## Install this checkout

Codex 0.144 or newer exposes the hook events used here. Add this repository as a local
marketplace and install the plugin:

```sh
codex plugin marketplace add .
codex plugin add waiting-room@waiting-room
```

Codex's current hook set does not include a turn-completed event. Add the following to
`~/.codex/config.toml` so its supported `agent-turn-complete` notification closes or
pauses the Waiting Room task (replace the path with the installed plugin path):

```toml
notify = ["bash", "/absolute/path/to/installed/waiting-room/scripts/signal.sh"]
```

Waiting Room uses the same local state as the Claude plugin. Turn it on once from this
checkout (an invite is optional):

```sh
bash plugin/scripts/toggle.sh on [invite]
```

`WAITING_ROOM_URL`, `~/.waiting-room/endpoint`, and the browser command overrides work
exactly as documented in `plugin/README.md`.

## Lifecycle mapping

| Codex event | Waiting Room event |
| --- | --- |
| `UserPromptSubmit` | `started` |
| `PreToolUse`, `PostToolUse` | `tick` |
| `PermissionRequest` | `needs_you` |
| `agent-turn-complete`, final message ends in `?` | `paused` with `why: "question"` |
| other `agent-turn-complete` | `stopped` |

Codex supplies different hook and notification shapes. Hook JSON is read from stdin and
uses `session_id`; notification JSON arrives as the command's last argument and uses
`thread-id`. Both identifiers are hashed locally. The outgoing body always has exactly
`token`, `event`, `why`, `session`, and `ts`. Prompts, working directories, tool names and
inputs, tool results, turn IDs, file contents, and assistant messages are discarded.

`SessionStart`, compaction, and subagent events are deliberately ignored; they do not
describe a user task lifecycle.

## Tests

```sh
node --test codex-plugin/test/*.test.js
```
