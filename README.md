# ccelite-statusline

A status line renderer for the Claude Code CLI, written in Rust. It reads one
line of JSON from standard input, renders one or more status lines, and exits.

This repository started as a fork of
[sirmalloc/ccstatusline](https://github.com/sirmalloc/ccstatusline) and has since
been rewritten in Rust. It shares the settings file format and several widget
names with that project, and nothing else: there is no npm package, no
TypeScript entry point, and no configuration UI here. Settings are edited by
hand.

## Build and install

```bash
cargo build --release          # produces target/release/ccstatusline
./install.sh                   # build, then copy the binary into place
./install.sh --smoke           # same, plus render one frame from a test payload
```

`install.sh` copies the binary to `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/bin/ccstatusline-rs`,
which is the path the Claude Code status line wrapper runs. It copies rather
than symlinks, because `target/` is periodically deleted (`install.sh:1-20`).

Point Claude Code at it in `settings.json`:

```json
{
  "statusLine": {
    "command": "~/.claude/bin/ccstatusline-rs"
  }
}
```

The toolchain is pinned to Rust 1.95.0 in `rust-toolchain.toml`.

## Running it by hand

```bash
echo '{"model":{"id":"claude-sonnet-4-5[1m]"},"workspace":{"current_dir":"/tmp"}}' \
  | ./target/release/ccstatusline
```

There are no command line flags or subcommands. If standard input is a terminal,
or the first line is empty, the program renders from an empty payload rather than
waiting (`src/main.rs:19-56`).

## Configuration

Settings are read from `~/.config/ccstatusline/settings.json`. If that file does
not exist, built-in defaults are used and nothing is written
(`src/config.rs:9-38`). A worked example lives in
`configs/v19.4-elite-magnificent.json`.

The full settings schema is in `src/types.rs:94-144`. Only some of it changes the
output. Keys the renderer reads:

| Key | Effect |
| --- | --- |
| `lines` | array of lines, each an array of widget objects |
| `defaultPadding` | string put on each side of a widget (default one space) |
| `globalBold` | bold every widget |
| `powerline.enabled` and `powerline.separators[0]` | draw that separator between colour groups (`src/render.rs:310-333`) |

The remaining keys are accepted so that a settings file from the upstream
project still parses, but nothing in `src/` reads them: `flexMode`,
`compactThreshold`, `colorLevel`, `defaultSeparator`, `inheritSeparatorColors`,
and the rest of the `powerline` object (`theme`, caps, `autoAlign`). Widgets of
type `separator` and `flex-separator` are dropped before rendering
(`src/render.rs:270-276`); columns are lined up by padding each merge group to
the widest one in that position instead.

Each widget object takes `type` plus optional `color`, `backgroundColor`,
`bold`, `merge`, `minWidth`, `maxWidth`, `fullWidth`, and, for `custom-command`,
`commandPath`, `timeout` and `preserveColors`.

Terminal width is detected from `$COLUMNS`, then from an `ioctl` on `/dev/tty`;
lines longer than that are clipped (`src/render.rs:6-52`).

## Widgets

`type` values fall through a single dispatch table in
`src/widgets/mod.rs:24-101`. An unrecognised type renders as its own name in
square brackets, for example `[block-timer]`, so a typo is visible rather than
silent.

The 62 recognised types:

- **Session and model**: `model`, `project-name`, `project-elite`,
  `session-clock`, `session-cost`, `session-cost-elite`, `session-quota`,
  `weekly-quota`, `burn-rate`, `burn-rate-clarity`, `rate-status`,
  `context-percentage`, `context-percentage-usable`, `context-collapse-risk`,
  `context-prediction`, `turns`, `token-phase`, `tokens-cached`, `cache-hit`
- **Git**: `git-branch`, `git-changes`, `commits-today`
- **Machine**: `cpu`, `memory-percent`, `disk-free`, `load-average`
- **Claude Code environment**: `user-email`, `mcp-count`, `hooks-status`,
  `tools-count`, `active-agents`
- **Local telemetry**: `roi`, `session-roi`, `session-npv`, `session-npv-elite`,
  `saved-per-session`, `codex-tokens-saved`, `tokens-saved`, `quality`,
  `coverage`, `tests-percentage`, `test-pass-rate`, `first-try-rate`,
  `first-try-success`, `lint-errors`, `bugs-clarity`, `risk`, `alert`,
  `alert-detail`, `fresh`, `data-freshness`, `recent-fails`, `proposal-queue`
- **Background services**: `daemon-health`, `daemon-latency`, `event-bus`,
  `db-events`, `db-health` (alias `surrealdb-health`)
- **Free-form**: `custom-text`, `custom-command`, `feed`

### What the widgets touch

These widgets are not pure formatters. They are enabled by whatever is in your
configuration file, and when enabled they read from the live machine on every
render:

- **Files under `$HOME`.** Most of the telemetry widgets read JSON or JSONL
  files in `~/.claude/data/` (`session_value.json`, `usage_cache.json`,
  `elite_telemetry_cache.json`, `session_quality.json`, `failures.jsonl`,
  `event_bus.jsonl` and others). `mcp-count` reads `~/.claude/settings.json`,
  and `user-email` reads the OAuth account email out of `~/.claude.json`
  (`src/widgets/builtin.rs:609-620`). A missing file usually yields a
  placeholder such as `—` rather than an error.
- **Subprocesses.** `git-branch`, `git-changes` and `commits-today` run `git`
  in the current directory. On macOS `cpu` runs `ps` and `memory-percent` runs
  `vm_stat`. `custom-command` runs the command you name, piping the Claude Code
  payload to its standard input and killing it after `timeout` milliseconds
  (default 1000). Custom commands run in parallel (`src/widgets/mod.rs:104-134`).
- **System calls.** `disk-free` calls `statvfs` on `/`; `load-average` calls
  `getloadavg`. `cpu`, `memory-percent`, `disk-free` and `load-average` are
  macOS-only; elsewhere they render `?` or nothing.
- **A local TCP connection.** `db-health` first reads
  `~/.claude/data/surrealdb_status`, and if that is absent it opens a connection
  to `127.0.0.1:8000` with a 50 ms timeout (`src/widgets/builtin.rs:654-678`).
- **A feed file.** `feed` reads a SurrealDB `feed_item` cache export, or
  `~/.config/ccstatusline/feed.json` as a fallback, caches it by file
  modification time, and drops items older than 24 hours
  (`src/widgets/feed.rs:1-21`).

Widget names that appear in `configs/` but have no implementation yet are listed
in `UNIMPLEMENTED` in `src/widgets/mod.rs`, and a test fails if that list grows.

## Development

```bash
cargo test --all-targets
cargo clippy --all-targets
cargo fmt --all -- --check
```

CI runs those three plus `cargo check` and an OSV dependency scan
(`.github/workflows/ci.yml`).

Source layout:

```
src/main.rs            stdin, settings, one render call
src/config.rs          settings.json loading
src/types.rs           input and settings schema, colour parsing
src/render.rs          layout, powerline, separators, truncation
src/widgets/mod.rs     type -> renderer dispatch, parallel custom commands
src/widgets/builtin.rs the built-in widget renderers
src/widgets/feed.rs    feed widget and its cache
```

A few `.ts` files remain under `src/widgets/` and `scripts/`. No build refers to
them; the repository has no `package.json`.

## License

[MIT](LICENSE). Original work copyright (c) 2025 Matthew Breedlove
([@sirmalloc](https://github.com/sirmalloc)); see `NOTICE` and `AUTHORS`.
