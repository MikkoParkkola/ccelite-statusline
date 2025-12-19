/**
 * Quality Metrics Widgets - v17.1 Dashboard Features
 *
 * Widgets for system and quality metrics:
 * - DiskSpace: Shows available disk space
 * - TestsPercentage: Shows test coverage percentage
 * - SecurityScore: Shows security score/issues count
 * - TechDebt: Shows tech debt count (e.g., mypy errors)
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';

// ============================================================================
// Data Readers with Caching
// ============================================================================

// Simple cache to avoid expensive operations on every render
interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const dataCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string, ttlMs: number, fetcher: () => T): T {
    const now = Date.now();
    const cached = dataCache.get(key) as CacheEntry<T> | undefined;
    if (cached && (now - cached.timestamp) < ttlMs) {
        return cached.data;
    }
    const data = fetcher();
    dataCache.set(key, { data, timestamp: now });
    return data;
}

interface DiskInfo {
    available: number;
    total: number;
    percentUsed: number;
    formatted: string;
}

// Cache disk info for 30 seconds (shell command is expensive)
const DISK_CACHE_TTL = 30000;

function getDiskSpace(): DiskInfo | null {
    return getCached('diskSpace', DISK_CACHE_TTL, () => {
        try {
            // Use df command for macOS/Linux compatibility
            const output = execSync('df -h "$HOME" 2>/dev/null', {
                encoding: 'utf-8',
                timeout: 1000,
                env: { ...process.env, HOME: os.homedir() }
            });

            const lines = output.trim().split('\n');
            if (lines.length < 2) return null;

            // Parse: Filesystem Size Used Avail Capacity ...
            const dataLine = lines[1];
            if (!dataLine) return null;
            const parts = dataLine.split(/\s+/);
            if (parts.length < 5) return null;

            const available = parts[3] ?? ''; // e.g., "84Gi" or "147G"
            const capacityStr = (parts[4] ?? '0').replace('%', ''); // e.g., "45"
            const percentUsed = parseInt(capacityStr, 10);

            // Parse available space to bytes for calculations
            let availableBytes = 0;
            const match = available.match(/^([\d.]+)([KMGT]i?)?$/i);
            if (match && match[1]) {
                const num = parseFloat(match[1]);
                const unit = (match[2] || '').toUpperCase().replace('I', '');
                const multipliers: Record<string, number> = {
                    'K': 1024,
                    'M': 1024 * 1024,
                    'G': 1024 * 1024 * 1024,
                    'T': 1024 * 1024 * 1024 * 1024
                };
                availableBytes = num * (multipliers[unit] || 1);
            }

            return {
                available: availableBytes,
                total: 0, // Not easily available from df
                percentUsed,
                formatted: available || '—'
            };
        } catch {
            return null;
        }
    });
}

interface QualityMetrics {
    tests_percentage?: number;
    tests_passed?: number;
    tests_total?: number;
    security_score?: number;
    security_issues?: number;
    tech_debt?: number;
    mypy_errors?: number;
    ruff_errors?: number;
}

function getQualityMetrics(): QualityMetrics | null {
    try {
        // Try statusline_cache.json (updated by hooks/lib/statusline_cache_updater.py)
        const cacheFile = path.join(os.homedir(), '.claude', 'hooks', 'lib', '.statusline_cache.json');
        if (fs.existsSync(cacheFile)) {
            const content = fs.readFileSync(cacheFile, 'utf-8');
            return JSON.parse(content) as QualityMetrics;
        }

        // Try quality_metrics.json from elite_sdk
        const metricsFile = path.join(os.homedir(), '.claude', 'data', 'quality_metrics.json');
        if (fs.existsSync(metricsFile)) {
            const content = fs.readFileSync(metricsFile, 'utf-8');
            return JSON.parse(content) as QualityMetrics;
        }

        // Try test_metrics.json
        const testFile = path.join(os.homedir(), '.claude', 'data', 'learning_test', 'test_metrics.json');
        if (fs.existsSync(testFile)) {
            const content = fs.readFileSync(testFile, 'utf-8');
            return JSON.parse(content) as QualityMetrics;
        }

        return null;
    } catch {
        return null;
    }
}

function getMypyBaseline(): number | null {
    try {
        // Read from mypy baseline file
        const baselineFile = path.join(os.homedir(), '.claude', 'data', 'mypy_baseline.txt');
        if (fs.existsSync(baselineFile)) {
            const content = fs.readFileSync(baselineFile, 'utf-8').trim();
            const count = parseInt(content, 10);
            return isNaN(count) ? null : count;
        }

        // Try CLAUDE.md for baseline mention
        const claudeMd = path.join(os.homedir(), '.claude', 'CLAUDE.md');
        if (fs.existsSync(claudeMd)) {
            const content = fs.readFileSync(claudeMd, 'utf-8');
            // Look for pattern like "Mypy errors | 3,257"
            const match = content.match(/[Mm]ypy\s*(?:errors?)?\s*\|?\s*([\d,]+)/);
            if (match && match[1]) {
                return parseInt(match[1].replace(/,/g, ''), 10);
            }
        }

        return null;
    } catch {
        return null;
    }
}

// ============================================================================
// Formatting Helpers
// ============================================================================

function formatBytes(bytes: number): string {
    if (bytes >= 1099511627776) { // 1 TB
        return `${(bytes / 1099511627776).toFixed(0)}T`;
    } else if (bytes >= 1073741824) { // 1 GB
        return `${(bytes / 1073741824).toFixed(0)}G`;
    } else if (bytes >= 1048576) { // 1 MB
        return `${(bytes / 1048576).toFixed(0)}M`;
    }
    return `${(bytes / 1024).toFixed(0)}K`;
}

function formatNumber(num: number): string {
    if (num >= 1000000) {
        return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
        return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
}

// ============================================================================
// Widget Implementations
// ============================================================================

/**
 * Disk Space Widget - Shows available disk space
 * Example output: "84G" or "⛁ 84G"
 */
export class DiskSpaceWidget implements Widget {
    getDefaultColor(): string { return 'blue'; }
    getDescription(): string { return 'Shows available disk space on home partition'; }
    getDisplayName(): string { return 'Disk Space'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '147G' : '⛁ 147G';
        }

        const disk = getDiskSpace();
        const formatted = disk?.formatted ?? null;

        // rawValue mode: ALWAYS return a value (never null)
        if (item.rawValue) {
            return formatted ?? '—';
        }

        // Full mode: can return null
        if (!formatted) {
            return null;
        }
        return `⛁ ${formatted}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

/**
 * Disk Usage Percentage Widget - Shows disk usage percentage
 * Example output: "45%" or "Disk: 45%"
 */
export class DiskUsagePercentWidget implements Widget {
    getDefaultColor(): string { return 'blue'; }
    getDescription(): string { return 'Shows disk usage percentage (low is good)'; }
    getDisplayName(): string { return 'Disk Usage %'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '45%' : '💿 45%';
        }

        const disk = getDiskSpace();
        const percentUsed = disk?.percentUsed;
        const formatted = percentUsed != null && !isNaN(percentUsed) ? `${percentUsed}%` : null;

        // Semantic warning indicators for disk usage (high = bad)
        const getWarningIndicator = (pct: number): string => {
            if (pct >= 95) return '🔴';  // Critical: almost full
            if (pct >= 85) return '🟠';  // Warning: getting full
            if (pct >= 75) return '🟡';  // Caution: above normal
            return '';  // Normal: no indicator
        };

        const warning = percentUsed != null ? getWarningIndicator(percentUsed) : '';

        // rawValue mode: ALWAYS return a value (never null)
        if (item.rawValue) {
            return formatted ? `${formatted}${warning}` : '—';
        }

        // Full mode: can return null
        if (!formatted) {
            return null;
        }
        return `💿 ${formatted}${warning}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

/**
 * Tests Percentage Widget - Shows test coverage
 * Example output: "95%" or "✓ 95%"
 */
export class TestsPercentageWidget implements Widget {
    getDefaultColor(): string { return 'green'; }
    getDescription(): string { return 'Shows test coverage percentage'; }
    getDisplayName(): string { return 'Tests %'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '95%' : '✓ 95%';
        }

        const metrics = getQualityMetrics();
        let percentage: number | null = null;

        if (metrics?.tests_percentage !== undefined) {
            percentage = metrics.tests_percentage;
        } else if (metrics?.tests_passed !== undefined && metrics?.tests_total !== undefined && metrics.tests_total > 0) {
            percentage = (metrics.tests_passed / metrics.tests_total) * 100;
        }

        // Semantic warning indicators for coverage (low = bad)
        const getWarningIndicator = (pct: number): string => {
            if (pct < 50) return '🔴';   // Critical: <50% coverage
            if (pct < 70) return '🟠';   // Warning: <70% coverage
            if (pct < 85) return '🟡';   // Caution: <85% coverage
            return '';  // Good: ≥85%
        };

        const warning = percentage !== null ? getWarningIndicator(percentage) : '';
        const formatted = percentage !== null ? `${Math.round(percentage)}%${warning}` : null;

        // rawValue mode: ALWAYS return a value (never null)
        if (item.rawValue) {
            return formatted ?? '—';
        }

        // Full mode: can return null
        if (!formatted) {
            return null;
        }
        return `✅ ${formatted}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

/**
 * Security Score Widget - Shows security score or issues count
 * Example output: "100" or "◉ 100" (score) or "2" or "⚠ 2" (issues)
 */
export class SecurityScoreWidget implements Widget {
    getDefaultColor(): string { return 'green'; }
    getDescription(): string { return 'Shows security score (100 = perfect) or issues count'; }
    getDisplayName(): string { return 'Security Score'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '100%' : '◉ 100%';
        }

        const metrics = getQualityMetrics();
        let formatted: string | null = null;
        let icon = '◉';

        // Prefer score (higher is better) - add % unit
        if (metrics?.security_score !== undefined) {
            formatted = `${metrics.security_score}%`;
        } else if (metrics?.security_issues !== undefined) {
            // Fallback to issues count (lower is better) - no % for count
            formatted = metrics.security_issues.toString();
            icon = metrics.security_issues > 0 ? '⚠' : '◉';
        }

        // rawValue mode: ALWAYS return a value (never null)
        if (item.rawValue) {
            return formatted ?? '—';
        }

        // Full mode: can return null
        if (!formatted) {
            return null;
        }
        return `${icon} ${formatted}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

/**
 * Tech Debt Widget - Shows combined tech debt: mypy + TODO + lint
 * Example output: "M:3.3K T:11" or "📋 M:3.3K T:11 L:0"
 * M = mypy type errors, T = TODO/FIXME comments, L = lint (ruff) errors
 * Note: Tracks ~/.claude/hooks directory (not current project)
 */
export class TechDebtWidget implements Widget {
    getDefaultColor(): string { return 'yellow'; }
    getDescription(): string { return 'Shows tech debt breakdown: M=mypy T=TODO L=lint'; }
    getDisplayName(): string { return 'Tech Debt'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? 'M:3.3K T:11' : '📋 M:3.3K T:11 L:0';
        }

        const metrics = getQualityMetrics();

        // Get all three debt types
        let mypy = getMypyBaseline();
        if (mypy === null && metrics?.mypy_errors !== undefined) {
            mypy = metrics.mypy_errors;
        }
        const todo = metrics?.tech_debt ?? 0;
        const lint = metrics?.ruff_errors ?? 0;

        // Build compact format: only show non-zero values in rawValue mode
        const parts: string[] = [];

        if (item.rawValue) {
            // Compact: skip zeros, use short format
            if (mypy !== null && mypy > 0) parts.push(`M:${formatNumber(mypy)}`);
            if (todo > 0) parts.push(`T:${todo}`);
            if (lint > 0) parts.push(`L:${lint}`);

            if (parts.length === 0) return '✓';  // No debt!
            return parts.join(' ');
        }

        // Full mode: show all values
        const mypyStr = mypy !== null ? formatNumber(mypy) : '0';
        return `📋 M:${mypyStr} T:${todo} L:${lint}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

/**
 * One-Shot Success Rate Widget - Shows % of tasks completing on first attempt
 * Elite value metric: demonstrates quality of 1-shot execution
 * Example output: "94%" or "🎯 94%"
 */
export class OneShotSuccessWidget implements Widget {
    getDefaultColor(): string { return 'brightGreen'; }
    getDescription(): string { return 'Shows 1-shot success rate (tasks without retries)'; }
    getDisplayName(): string { return '1-Shot Success'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '94%' : '🎯 94%';
        }

        // Try to get 1-shot metrics from session data
        const metrics = this.getOneShotMetrics();
        if (!metrics) {
            // Return default if no data yet
            return item.rawValue ? '—' : '🎯 —';
        }

        const formatted = `${Math.round(metrics.successRate)}%`;
        return item.rawValue ? formatted : `🎯 ${formatted}`;
    }

    private getOneShotMetrics(): { successRate: number; total: number; firstAttempt: number } | null {
        try {
            // Try session metrics first
            const sessionFile = path.join(os.homedir(), '.claude', 'data', 'session_metrics.json');
            if (fs.existsSync(sessionFile)) {
                const content = fs.readFileSync(sessionFile, 'utf-8');
                const data = JSON.parse(content) as {
                    one_shot_success_rate?: number;
                    total_tasks?: number;
                    first_attempt_success?: number;
                    retry_count?: number;
                };

                if (data.one_shot_success_rate !== undefined) {
                    return {
                        successRate: data.one_shot_success_rate,
                        total: data.total_tasks ?? 0,
                        firstAttempt: data.first_attempt_success ?? 0
                    };
                }

                // Calculate from retry count if available
                if (data.total_tasks && data.retry_count !== undefined) {
                    const firstAttempt = data.total_tasks - data.retry_count;
                    const rate = data.total_tasks > 0 ? (firstAttempt / data.total_tasks) * 100 : 0;
                    return {
                        successRate: rate,
                        total: data.total_tasks,
                        firstAttempt
                    };
                }
            }

            // Try tool success metrics
            const toolFile = path.join(os.homedir(), '.claude', 'data', 'tool_success.json');
            if (fs.existsSync(toolFile)) {
                const content = fs.readFileSync(toolFile, 'utf-8');
                const data = JSON.parse(content) as {
                    success_rate?: number;
                    first_try_success?: number;
                };
                if (data.success_rate !== undefined) {
                    return {
                        successRate: data.success_rate,
                        total: 0,
                        firstAttempt: data.first_try_success ?? 0
                    };
                }
            }

            return null;
        } catch {
            return null;
        }
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

/**
 * Project Name Widget - Shows current project/workspace name
 * Example output: "claude-elite" or "📂 claude-elite"
 */
export class ProjectNameWidget implements Widget {
    getDefaultColor(): string { return 'white'; }
    getDescription(): string { return 'Shows current project name from workspace'; }
    getDisplayName(): string { return 'Project Name'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? 'github/project' : '📂 github/project';
        }

        // Get from context data - try multiple sources
        let cwd = context.data?.workspace?.current_dir
            ?? context.data?.workspace?.project_dir
            ?? context.data?.cwd;

        // Also try process.cwd() as ultimate fallback
        if (!cwd) {
            try {
                cwd = process.cwd();
            } catch {
                // Continue with null cwd
            }
        }

        // Extract parent/name format or just name
        let display: string | null = null;
        if (cwd) {
            const parts = cwd.split('/').filter(Boolean);
            if (parts.length >= 2) {
                display = `${parts[parts.length - 2] ?? ''}/${parts[parts.length - 1] ?? ''}`;
            } else if (parts.length === 1) {
                display = parts[0] ?? null;
            }
        }

        // rawValue mode: ALWAYS return a value (never null)
        if (item.rawValue) {
            return display ?? '—';
        }

        // Full mode: can return null
        if (!display) {
            return null;
        }
        return `📂 ${display}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
