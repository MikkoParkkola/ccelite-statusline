# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## Project overview

A status line renderer for the Claude Code CLI, written in Rust. It reads one
line of JSON from standard input, prints one or more rendered lines, and exits
(`src/main.rs:19-65`). There is no interactive configuration mode, no npm
package and no TypeScript entry point; the settings file is edited by hand.

The repository began as a fork of sirmalloc/ccstatusline and keeps that
project's settings file shape and some widget names. A few orphaned `.ts` files
still sit under `src/widgets/` and `scripts/`; nothing builds them, and there is
no `package.json`.

## Commands

```bash
cargo build --release            # target/release/ccstatusline
cargo test --all-targets
cargo clippy --all-targets
cargo fmt --all -- --check

./install.sh                     # build, copy to ~/.claude/bin/ccstatusline-rs
./install.sh --smoke             # same, plus one render from a test payload

echo '{"model":{"id":"claude-sonnet-4-5[1m]"}}' | ./target/release/ccstatusline
```

The toolchain is pinned to 1.95.0 in `rust-toolchain.toml`. CI runs check, test,
fmt, clippy and an OSV dependency scan (`.github/workflows/ci.yml`).

Deployment matters: the Claude Code wrapper runs
`~/.claude/bin/ccstatusline-rs`, and `target/` is periodically deleted, so a
build that is never copied by `install.sh` leaves the old binary live with no
error (`install.sh:1-20`).

## Architecture

- **src/main.rs** reads at most one line from standard input, without blocking
  when the pipe is empty, and falls back to `{}`. Then it loads settings and
  renders once.
- **src/config.rs** reads `~/.config/ccstatusline/settings.json`, or returns
  defaults when the file is absent. Nothing is ever written.
- **src/types.rs** holds the input schema from Claude Code, the settings schema
  and colour parsing (named colours and `hex:RRGGBB`; the 256-colour variant
  exists but `Color::parse` never produces it).
- **src/render.rs** pre-renders every widget, lines up merge groups by column,
  applies powerline separators between colour groups, and clips each line to the
  detected terminal width (`$COLUMNS`, then `ioctl` on `/dev/tty`).
- **src/widgets/mod.rs** maps the `type` string to a renderer and pre-executes
  `custom-command` widgets in parallel with rayon.
- **src/widgets/builtin.rs** holds the built-in renderers.
- **src/widgets/feed.rs** holds the `feed` widget and its mtime-keyed cache.

## Things worth knowing before editing

- **Unknown widget types render as `[type]`**, which looks the same as a widget
  with no data. Five widgets shipped that way in production. `UNIMPLEMENTED` in
  `src/widgets/mod.rs` lists the known gaps, and a test fails when a shipped
  config gains a type outside that list.
- **Several settings keys parse but are dead**: `flexMode`, `compactThreshold`,
  `colorLevel`, `defaultSeparator`, `inheritSeparatorColors`, per-widget
  `padding`, and every `powerline` field except `enabled` and `separators[0]`.
  Widgets of type `separator` and `flex-separator` are filtered out before
  rendering. Do not document them as working; wire them up or leave them alone.
- **Widgets read the live machine.** They open files under `~/.claude/data/`,
  `~/.claude/settings.json` and `~/.claude.json`; run `git`, and on macOS `ps`
  and `vm_stat`; call `statvfs` and `getloadavg`; and open a 50 ms TCP
  connection to `127.0.0.1:8000` for `db-health`. A missing source yields a
  placeholder rather than an error, so a broken path is quiet.
- **The machine widgets are macOS-only.** `cpu`, `memory-percent`, `disk-free`
  and `load-average` are behind `#[cfg(target_os = "macos")]` and render `?` or
  nothing elsewhere.
- **Custom commands are arbitrary code** run with the Claude Code payload on
  standard input and killed after `timeout` milliseconds (default 1000).
- **Width is a layout concern.** Clip in `render.rs` using the widget's
  `maxWidth`, not inside a widget by slicing bytes, which panics mid-codepoint.

## License

MIT. Original work copyright (c) 2025 Matthew Breedlove; see `NOTICE` and
`AUTHORS`.
