#!/usr/bin/env node
import chalk from 'chalk';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { runTUI } from './tui';
import type {
    BlockMetrics,
    TokenMetrics
} from './types';
import type { RenderContext } from './types/RenderContext';
import type { StatusJSON } from './types/StatusJSON';
import { StatusJSONSchema } from './types/StatusJSON';
import { updateColorMap } from './utils/colors';
import {
    loadSettings,
    saveSettings
} from './utils/config';
import {
    getBlockMetrics,
    getSessionDuration,
    getTokenMetrics
} from './utils/jsonl';
import {
    calculateMaxWidthsFromPreRendered,
    preRenderAllWidgets,
    renderStatusLine
} from './utils/renderer';

async function readStdin(): Promise<string | null> {
    // Check if stdin is a TTY (terminal) - if it is, there's no piped data
    if (process.stdin.isTTY) {
        return null;
    }

    const chunks: string[] = [];

    try {
        // Use Node.js compatible approach
        if (typeof Bun !== 'undefined') {
            // Bun environment
            const decoder = new TextDecoder();
            for await (const chunk of Bun.stdin.stream()) {
                chunks.push(decoder.decode(chunk));
            }
        } else {
            // Node.js environment
            process.stdin.setEncoding('utf8');
            for await (const chunk of process.stdin) {
                chunks.push(chunk as string);
            }
        }
        return chunks.join('');
    } catch {
        return null;
    }
}

// Auto-refresh stale caches (workaround for PostToolUse hooks not triggering)
// Uses file-based throttling to prevent concurrent refreshes
let lastRefreshAttempt = 0;
const REFRESH_THROTTLE_MS = 5000; // 5 seconds between refresh attempts (reduced from 10s)
const MAX_CACHE_AGE_SECONDS = 300; // 5 minutes max staleness

function refreshStaleCaches(): void {
    // Throttle: prevent multiple refresh attempts in quick succession
    const now = Date.now();
    if (now - lastRefreshAttempt < REFRESH_THROTTLE_MS) {
        return;
    }
    lastRefreshAttempt = now;

    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    if (!homeDir)
        return;

    const hooksLibDir = path.join(homeDir, '.claude', 'hooks', 'lib');
    const cacheFile = path.join(hooksLibDir, '.statusline_cache.json');
    const lockFile = path.join(hooksLibDir, '.statusline_refresh.lock');
    const updaterScript = path.join(hooksLibDir, 'statusline_cache_updater.py');

    try {
        // Check if cache exists
        if (!fs.existsSync(cacheFile))
            return;

        // Check lock file - if another refresh is in progress (lock < 60s old), skip
        if (fs.existsSync(lockFile)) {
            const lockAge = (Date.now() - fs.statSync(lockFile).mtimeMs) / 1000;
            if (lockAge < 60)
                return; // Another refresh in progress
            // Lock is stale, remove it
            try { fs.unlinkSync(lockFile); } catch { /* ignore */ }
        }

        // Parse cache and check age
        let cacheData: { updated_at?: string };
        try {
            cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        } catch {
            return; // Corrupted cache, skip refresh (will be rebuilt eventually)
        }

        if (!cacheData.updated_at)
            return;

        // Safe date parsing with fallback
        let updatedAt: Date;
        try {
            updatedAt = new Date(cacheData.updated_at);
            if (isNaN(updatedAt.getTime()))
                return; // Invalid date
        } catch {
            return;
        }

        const ageSeconds = (Date.now() - updatedAt.getTime()) / 1000;

        // Only refresh if stale and updater script exists
        if (ageSeconds > MAX_CACHE_AGE_SECONDS && fs.existsSync(updaterScript)) {
            // Create lock file BEFORE spawning
            try {
                fs.writeFileSync(lockFile, String(process.pid));
            } catch {
                return; // Can't create lock, skip refresh
            }

            // Find python3 - prefer pyenv/user version over system (for modern syntax support)
            const pythonPaths = [
                path.join(homeDir, '.pyenv', 'shims', 'python3'),
                '/usr/local/bin/python3',
                '/opt/homebrew/bin/python3',
                'python3'  // fallback to PATH
            ];
            let pythonCmd = 'python3';
            for (const p of pythonPaths) {
                if (p === 'python3' || fs.existsSync(p)) {
                    pythonCmd = p;
                    break;
                }
            }

            // Spawn background refresh (non-blocking, fully detached)
            // Pass full process.env to support pyenv and other python version managers
            const child = spawn(pythonCmd, [updaterScript], {
                detached: true,
                stdio: 'ignore',
                env: process.env
            });

            child.unref();

            // Clean up lock after spawn completes (in background)
            child.on('exit', () => {
                try { fs.unlinkSync(lockFile); } catch { /* ignore */ }
            });

            // Also set a timeout to clean up lock if child doesn't exit cleanly
            // Use .unref() so the timer doesn't keep the process alive
            const lockCleanupTimer = setTimeout(() => {
                try { fs.unlinkSync(lockFile); } catch { /* ignore */ }
            }, 30000);
            lockCleanupTimer.unref();

            // Also refresh feed data (insights, patterns) if updater exists
            const feedUpdater = path.join(homeDir, '.claude', 'hooks', 'PostToolUse', 'feed-updater.py');
            if (fs.existsSync(feedUpdater)) {
                const feedChild = spawn(pythonCmd, [feedUpdater], {
                    detached: true,
                    stdio: 'ignore',
                    env: process.env
                });
                feedChild.unref();
            }

            // Refresh elite metrics (streak display, hooks health)
            const eliteProvider = path.join(hooksLibDir, 'elite_metrics_provider.py');
            if (fs.existsSync(eliteProvider)) {
                const eliteChild = spawn(pythonCmd, [eliteProvider, '--json'], {
                    detached: true,
                    stdio: 'ignore',
                    env: process.env
                });
                eliteChild.unref();
            }

            // Maintain streak data (reset daily/weekly counters, update timestamp)
            const streakMaintenance = path.join(hooksLibDir, 'streak_maintenance.py');
            if (fs.existsSync(streakMaintenance)) {
                const streakChild = spawn(pythonCmd, [streakMaintenance], {
                    detached: true,
                    stdio: 'ignore',
                    env: process.env
                });
                streakChild.unref();
            }

            // Quota refresh removed: rate limit data now comes directly via stdin
            // rate_limits field (CC 2.1.80+), no cache needed
        }
    } catch {
        // Best-effort: silently ignore all errors
        // The statusline must render even if cache refresh fails
    }
}

async function renderMultipleLines(data: StatusJSON) {
    // Auto-refresh stale caches before rendering
    refreshStaleCaches();

    const settings = await loadSettings();

    // Set global chalk level based on settings
    chalk.level = settings.colorLevel;

    // Update color map after setting chalk level
    updateColorMap();

    // Get all lines to render
    const lines = settings.lines;

    // Get token metrics if needed (check all lines)
    const hasTokenItems = lines.some(line => line.some(item => ['tokens-input', 'tokens-output', 'tokens-cached', 'tokens-total', 'token-rate', 'context-length', 'context-percentage', 'context-percentage-usable'].includes(item.type)));

    // Check if session clock is needed
    const hasSessionClock = lines.some(line => line.some(item => item.type === 'session-clock'));

    // Check if block timer is needed
    const hasBlockTimer = lines.some(line => line.some(item => item.type === 'block-timer'));

    let tokenMetrics: TokenMetrics | null = null;
    if (hasTokenItems && data.transcript_path) {
        tokenMetrics = await getTokenMetrics(data.transcript_path);
    }

    let sessionDuration: string | null = null;
    if (hasSessionClock && data.transcript_path) {
        sessionDuration = await getSessionDuration(data.transcript_path);
    }

    let blockMetrics: BlockMetrics | null = null;
    if (hasBlockTimer) {
        blockMetrics = getBlockMetrics();
    }

    // Create render context
    const context: RenderContext = {
        data,
        tokenMetrics,
        sessionDuration,
        blockMetrics,
        isPreview: false
    };

    // Always pre-render all widgets once (for efficiency)
    const preRenderedLines = preRenderAllWidgets(lines, settings, context);
    const preCalculatedMaxWidths = calculateMaxWidthsFromPreRendered(preRenderedLines, settings);

    // Render each line using pre-rendered content
    let globalSeparatorIndex = 0;
    for (let i = 0; i < lines.length; i++) {
        const lineItems = lines[i];
        if (lineItems && lineItems.length > 0) {
            const preRenderedWidgets = preRenderedLines[i] ?? [];

            // v3.8.0: Handle fullWidth lines differently - just output content without column alignment
            const hasFullWidth = lineItems.some(item => item.fullWidth);
            let line: string;

            if (hasFullWidth) {
                // For fullWidth lines, just concatenate the pre-rendered content
                line = preRenderedWidgets.map(w => w.content).filter(Boolean).join('');
            } else {
                const lineContext = { ...context, lineIndex: i, globalSeparatorIndex };
                line = renderStatusLine(lineItems, settings, lineContext, preRenderedWidgets, preCalculatedMaxWidths);
            }

            // Only output the line if it has content (not just ANSI codes)
            // Strip ANSI codes to check if there's actual text
            const strippedLine = line.replace(/\x1b\[[0-9;]*m/g, '').trim();
            if (strippedLine.length > 0) {
                // Count separators used in this line (widgets - 1, excluding merged widgets)
                const nonMergedWidgets = lineItems.filter((_, idx) => idx === lineItems.length - 1 || !lineItems[idx]?.merge);
                if (nonMergedWidgets.length > 1)
                    globalSeparatorIndex += nonMergedWidgets.length - 1;

                // Replace all spaces with non-breaking spaces to prevent VSCode trimming
                let outputLine = line.replace(/ /g, '\u00A0');

                // Add reset code at the beginning to override Claude Code's dim setting
                outputLine = '\x1b[0m' + outputLine;
                console.log(outputLine);
            }
        }
    }

    // Check if there's an update message to display
    if (settings.updatemessage?.message
        && settings.updatemessage.message.trim() !== ''
        && settings.updatemessage.remaining
        && settings.updatemessage.remaining > 0) {
        // Display the message
        console.log(settings.updatemessage.message);

        // Decrement the remaining count
        const newRemaining = settings.updatemessage.remaining - 1;

        // Update or remove the updatemessage
        if (newRemaining <= 0) {
            // Remove the entire updatemessage block
            const { updatemessage, ...newSettings } = settings;
            void updatemessage;
            await saveSettings(newSettings);
        } else {
            // Update the remaining count
            await saveSettings({
                ...settings,
                updatemessage: {
                    ...settings.updatemessage,
                    remaining: newRemaining
                }
            });
        }
    }
}

async function main() {
    // Check if we're in a piped/non-TTY environment first
    if (!process.stdin.isTTY) {
        // We're receiving piped input
        const input = await readStdin();
        if (input && input.trim() !== '') {
            try {
                // Parse and validate JSON in one step
                const result = StatusJSONSchema.safeParse(JSON.parse(input));
                if (!result.success) {
                    console.error('Invalid status JSON format:', result.error.message);
                    process.exit(1);
                }

                await renderMultipleLines(result.data);
            } catch (error) {
                console.error('Error parsing JSON:', error);
                process.exit(1);
            }
        } else {
            console.error('No input received');
            process.exit(1);
        }
    } else {
        // Interactive mode - run TUI
        // Remove updatemessage before running TUI
        const settings = await loadSettings();
        if (settings.updatemessage) {
            const { updatemessage, ...newSettings } = settings;
            void updatemessage;
            await saveSettings(newSettings);
        }
        runTUI();
    }
}

void main();