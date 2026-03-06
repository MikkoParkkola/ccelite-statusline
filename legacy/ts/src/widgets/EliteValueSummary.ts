/**
 * Elite Value Summary Widgets - Actionable, Fresh, Concrete Value
 *
 * DESIGN PRINCIPLES (UXPin 2025 Best Practices):
 * 1. 3-Second Rule: Critical info visible immediately
 * 2. Actionable Insights: Not just data, but what to DO
 * 3. Progressive Disclosure: Summary → drill-down
 * 4. Freshness Indicators: Show when data was last updated
 * 5. Color for Meaning: Alerts vs status vs success
 *
 * v4.0.0 - Concrete User Value Edition
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';

// ============================================================================
// Data Reader with Freshness
// ============================================================================

interface EliteMetrics {
    session_id?: string;
    timestamp?: string;
    session_start?: string;
    session_duration_seconds?: number;
    baseline?: {
        cache_read_tokens?: number;
        baseline_cost_saved_usd?: number;
    };
    elite?: {
        cost_reduction?: {
            compression_ratio?: number;
            compression_cost_saved_usd?: number;
            compression_tokens_saved?: number;
            routing_cost_saved_usd?: number;
            semantic_cache_hit_rate?: number;
            semantic_cache_cost_saved_usd?: number;
            haiku_routed?: number;
            codex_routed?: number;
            skills_tokens_saved?: number;
        };
        speed?: {
            parallel_speedup?: number;
            prediction_accuracy?: number;
            latency_saved_ms?: number;
            hook_executions?: number;
            avg_hook_time_ms?: number;
            parallel_tasks_executed?: number;
            sequential_time_ms?: number;
            parallel_time_ms?: number;
        };
        quality?: {
            tasks_completed?: number;
            tasks_first_try_success?: number;
            bugs_detected_pre_commit?: number;
            security_issues_prevented?: number;
            rework_cycles_prevented?: number;
        };
        intelligence?: {
            patterns_learned?: number;
            patterns_applied?: number;
            learning_cycles?: number;
        };
    };
    totals?: {
        cost_saved_usd?: number;
        time_value_usd?: number;
        quality_value_usd?: number;
        total_elite_value_usd?: number;
        baseline_cost_saved_usd?: number;
        combined_value_usd?: number;
    };
    kpis?: {
        compression_ratio?: number;
        cache_hit_rate_pct?: number;
        parallel_speedup?: number;
        prediction_accuracy_pct?: number;
        first_try_success_pct?: number;
        routing_count?: number;
    };
}

interface MetricsWithFreshness {
    metrics: EliteMetrics | null;
    ageSeconds: number;
    isFresh: boolean;  // < 60 seconds
    isStale: boolean;  // > 300 seconds (5 min)
    isVeryStale: boolean; // > 3600 seconds (1 hour)
    lastUpdated: Date | null;
}

const METRICS_FILE = path.join(os.homedir(), '.claude', 'data', 'elite', 'metrics.json');

// Simple in-memory cache with 5-second TTL
let cachedData: MetricsWithFreshness | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 5000;

function getEliteMetricsWithFreshness(): MetricsWithFreshness {
    const now = Date.now();

    // Return cached data if still valid
    if (cachedData && (now - cacheTime) < CACHE_TTL_MS) {
        return cachedData;
    }

    try {
        if (!fs.existsSync(METRICS_FILE)) {
            cachedData = {
                metrics: null,
                ageSeconds: Infinity,
                isFresh: false,
                isStale: true,
                isVeryStale: true,
                lastUpdated: null
            };
            cacheTime = now;
            return cachedData;
        }

        // Get file modification time for freshness
        const stats = fs.statSync(METRICS_FILE);
        const mtime = stats.mtime;
        const ageSeconds = (now - mtime.getTime()) / 1000;

        const content = fs.readFileSync(METRICS_FILE, 'utf-8');
        const metrics = JSON.parse(content) as EliteMetrics;

        cachedData = {
            metrics,
            ageSeconds,
            isFresh: ageSeconds < 60,
            isStale: ageSeconds > 300,
            isVeryStale: ageSeconds > 3600,
            lastUpdated: mtime
        };
        cacheTime = now;
        return cachedData;
    } catch {
        cachedData = {
            metrics: null,
            ageSeconds: Infinity,
            isFresh: false,
            isStale: true,
            isVeryStale: true,
            lastUpdated: null
        };
        cacheTime = now;
        return cachedData;
    }
}

function formatCost(cost: number): string {
    if (cost >= 1000) {
        return `$${(cost / 1000).toFixed(1)}K`;
    } else if (cost >= 100) {
        return `$${Math.round(cost)}`;
    } else if (cost >= 1) {
        return `$${cost.toFixed(2)}`;
    } else if (cost >= 0.01) {
        return `$${cost.toFixed(2)}`;
    } else if (cost > 0) {
        return `$${cost.toFixed(3)}`;
    }
    return '$0';
}

function formatDuration(ms: number): string {
    if (ms >= 3600000) {
        return `${(ms / 3600000).toFixed(1)}h`;
    } else if (ms >= 60000) {
        return `${Math.round(ms / 60000)}m`;
    } else if (ms >= 1000) {
        return `${Math.round(ms / 1000)}s`;
    }
    return `${Math.round(ms)}ms`;
}

function formatAge(seconds: number): string {
    if (seconds < 60) return 'now';
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
    return `${Math.round(seconds / 86400)}d ago`;
}

function getFreshnessIndicator(data: MetricsWithFreshness): string {
    if (data.isFresh) return '🟢';
    if (data.isStale) return '🟡';
    if (data.isVeryStale) return '🔴';
    return '⚪';
}

// ============================================================================
// PRIMARY: One-Line Value Summary
// ============================================================================

/**
 * Elite Value Summary - The One Widget You Need
 * Shows: Total value + freshness + key action
 *
 * Format: "💎 $205 saved (3 bugs blocked) 🟢"
 * Or: "💎 $205 saved | 4.2× faster 🟢"
 */
export class EliteValueSummaryWidget implements Widget {
    getDefaultColor(): string { return 'brightGreen'; }
    getDescription(): string { return 'One-line summary: Total value saved + key impact + freshness'; }
    getDisplayName(): string { return 'Elite Value Summary'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: '💎 $205 saved (3 bugs blocked) 🟢' };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return '💎 $205 saved (3 bugs blocked) 🟢';
        }

        const data = getEliteMetricsWithFreshness();
        const metrics = data.metrics;

        if (!metrics) {
            return null;
        }

        const totalValue = metrics.totals?.total_elite_value_usd ?? 0;
        const bugs = metrics.elite?.quality?.bugs_detected_pre_commit ?? 0;
        const security = metrics.elite?.quality?.security_issues_prevented ?? 0;
        const speedup = metrics.kpis?.parallel_speedup ?? 1;
        const routingCount = metrics.kpis?.routing_count ?? 0;

        // Nothing tracked yet
        if (totalValue <= 0 && bugs === 0 && security === 0 && routingCount === 0) {
            return null;
        }

        const freshness = getFreshnessIndicator(data);
        const valueStr = formatCost(totalValue);

        // Build actionable summary based on what's most impactful
        let actionSummary = '';
        if (security > 0) {
            actionSummary = `${security} vuln${security > 1 ? 's' : ''} blocked`;
        } else if (bugs > 0) {
            actionSummary = `${bugs} bug${bugs > 1 ? 's' : ''} caught`;
        } else if (speedup > 1.5) {
            actionSummary = `${speedup.toFixed(1)}× faster`;
        } else if (routingCount > 0) {
            actionSummary = `${routingCount} routed`;
        }

        if (totalValue > 0 && actionSummary) {
            return `💎 ${valueStr} saved (${actionSummary}) ${freshness}`;
        } else if (totalValue > 0) {
            return `💎 ${valueStr} saved ${freshness}`;
        } else if (actionSummary) {
            return `💎 ${actionSummary} ${freshness}`;
        }

        return null;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

/**
 * Elite Quick Wins - What you saved THIS session
 * Format: "🚀 Saved $2.30 + 5m + 2 bugs"
 */
export class EliteQuickWinsWidget implements Widget {
    getDefaultColor(): string { return 'brightCyan'; }
    getDescription(): string { return 'Quick wins: Cost + time + quality savings this session'; }
    getDisplayName(): string { return 'Elite Quick Wins'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: '🚀 Saved $2.30 + 5m + 2 bugs' };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return '🚀 Saved $2.30 + 5m + 2 bugs';
        }

        const data = getEliteMetricsWithFreshness();
        const metrics = data.metrics;

        if (!metrics || data.isVeryStale) {
            return null;
        }

        const parts: string[] = [];

        // Cost saved
        const costSaved = metrics.totals?.cost_saved_usd ?? 0;
        if (costSaved > 0.01) {
            parts.push(formatCost(costSaved));
        }

        // Time saved (from parallel + latency)
        const latencySaved = metrics.elite?.speed?.latency_saved_ms ?? 0;
        const parallelTimeSaved = (metrics.elite?.speed?.sequential_time_ms ?? 0) -
                                   (metrics.elite?.speed?.parallel_time_ms ?? 0);
        const totalTimeSaved = Math.max(0, latencySaved + parallelTimeSaved);
        if (totalTimeSaved > 1000) {
            parts.push(formatDuration(totalTimeSaved));
        }

        // Bugs/security
        const bugs = metrics.elite?.quality?.bugs_detected_pre_commit ?? 0;
        const security = metrics.elite?.quality?.security_issues_prevented ?? 0;
        const qualityItems = bugs + security;
        if (qualityItems > 0) {
            parts.push(`${qualityItems} issue${qualityItems > 1 ? 's' : ''}`);
        }

        if (parts.length === 0) {
            return null;
        }

        return `🚀 Saved ${parts.join(' + ')}`;
    }

    supportsRawValue(): boolean { return false; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

// ============================================================================
// ACTIONABLE: What To Do Widgets
// ============================================================================

/**
 * Elite Action - Suggests what to do based on metrics
 * Format: "💡 High cache hits - keep similar prompts" or "⚠️ Low 1st-try - check tests"
 */
export class EliteActionWidget implements Widget {
    getDefaultColor(): string { return 'yellow'; }
    getDescription(): string { return 'Actionable suggestion based on current metrics'; }
    getDisplayName(): string { return 'Elite Action Suggestion'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: '💡 Cache 84% - prompts are consistent' };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return '💡 Cache 84% - prompts are consistent';
        }

        const data = getEliteMetricsWithFreshness();
        const metrics = data.metrics;

        if (!metrics || data.isVeryStale) {
            return null;
        }

        const cacheHitRate = metrics.kpis?.cache_hit_rate_pct ?? 0;
        const firstTryRate = metrics.kpis?.first_try_success_pct ?? 0;
        const compressionRatio = metrics.kpis?.compression_ratio ?? 1;
        const routingCount = metrics.kpis?.routing_count ?? 0;

        // Priority: Security > Quality > Performance > Info
        const security = metrics.elite?.quality?.security_issues_prevented ?? 0;
        if (security > 0) {
            return `🛡️ ${security} security issue${security > 1 ? 's' : ''} blocked!`;
        }

        const bugs = metrics.elite?.quality?.bugs_detected_pre_commit ?? 0;
        if (bugs > 0) {
            return `🐛 ${bugs} bug${bugs > 1 ? 's' : ''} caught pre-commit`;
        }

        // Low first-try success is a warning
        if (firstTryRate > 0 && firstTryRate < 70) {
            return `⚠️ ${firstTryRate.toFixed(0)}% 1st-try - consider more context`;
        }

        // Good cache performance is positive
        if (cacheHitRate >= 70) {
            return `💾 Cache ${cacheHitRate.toFixed(0)}% - prompts are consistent`;
        }

        // Compression working well
        if (compressionRatio > 0 && compressionRatio < 0.8) {
            return `📦 ${((1 - compressionRatio) * 100).toFixed(0)}% compressed`;
        }

        // Routing working
        if (routingCount > 0) {
            return `⚡ ${routingCount} task${routingCount > 1 ? 's' : ''} → cheaper model`;
        }

        return null;
    }

    supportsRawValue(): boolean { return false; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

// ============================================================================
// FRESHNESS: Data Age Indicators
// ============================================================================

/**
 * Elite Freshness - Shows how fresh the metrics are
 * Format: "🟢 now" or "🟡 5m ago" or "🔴 2h ago"
 */
export class EliteFreshnessWidget implements Widget {
    getDefaultColor(): string { return 'white'; }
    getDescription(): string { return 'Data freshness indicator with age'; }
    getDisplayName(): string { return 'Elite Data Freshness'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: '🟢 now' };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return '🟢 now';
        }

        const data = getEliteMetricsWithFreshness();

        if (!data.lastUpdated) {
            return '⚪ no data';
        }

        const indicator = getFreshnessIndicator(data);
        const age = formatAge(data.ageSeconds);

        return `${indicator} ${age}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

/**
 * Elite Staleness Warning - Only shows when data is stale
 * Format: "⚠️ Data 2h old" or nothing if fresh
 */
export class EliteStalenessWarningWidget implements Widget {
    getDefaultColor(): string { return 'yellow'; }
    getDescription(): string { return 'Warning when metrics data is stale (hidden when fresh)'; }
    getDisplayName(): string { return 'Elite Staleness Warning'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: '⚠️ Data 2h old' };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return '⚠️ Data 2h old';
        }

        const data = getEliteMetricsWithFreshness();

        // Only show warning if stale
        if (!data.isStale) {
            return null;
        }

        return `⚠️ Data ${formatAge(data.ageSeconds)}`;
    }

    supportsRawValue(): boolean { return false; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

// ============================================================================
// CONCRETE VALUE: Specific Impact Widgets
// ============================================================================

/**
 * Elite Money Saved - Just the dollar amount, clearly
 * Format: "$2.34 saved" or "$1.2K saved"
 */
export class EliteMoneySavedWidget implements Widget {
    getDefaultColor(): string { return 'green'; }
    getDescription(): string { return 'Total money saved by Elite optimizations'; }
    getDisplayName(): string { return 'Money Saved'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: '$2.34 saved' };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '$2.34' : '$2.34 saved';
        }

        const data = getEliteMetricsWithFreshness();
        const cost = data.metrics?.totals?.cost_saved_usd ?? 0;

        if (cost <= 0) {
            return null;
        }

        const formatted = formatCost(cost);
        return item.rawValue ? formatted : `${formatted} saved`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

/**
 * Elite Time Saved - Time saved in human terms
 * Format: "5m faster" or "2.3h faster"
 */
export class EliteTimeSavedWidget implements Widget {
    getDefaultColor(): string { return 'cyan'; }
    getDescription(): string { return 'Time saved by parallel execution and caching'; }
    getDisplayName(): string { return 'Time Saved'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: '5m faster' };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '5m' : '5m faster';
        }

        const data = getEliteMetricsWithFreshness();
        const metrics = data.metrics;

        if (!metrics) {
            return null;
        }

        // Calculate total time saved
        const latencySaved = metrics.elite?.speed?.latency_saved_ms ?? 0;
        const seqTime = metrics.elite?.speed?.sequential_time_ms ?? 0;
        const parTime = metrics.elite?.speed?.parallel_time_ms ?? 0;
        const parallelSaved = Math.max(0, seqTime - parTime);
        const totalMs = latencySaved + parallelSaved;

        if (totalMs < 1000) {
            return null;
        }

        const formatted = formatDuration(totalMs);
        return item.rawValue ? formatted : `${formatted} faster`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

/**
 * Elite Issues Blocked - Bugs + Security in one
 * Format: "3 issues blocked" or "🛡️ 1 vuln + 2 bugs"
 */
export class EliteIssuesBlockedWidget implements Widget {
    getDefaultColor(): string { return 'red'; }
    getDescription(): string { return 'Total bugs and security issues prevented'; }
    getDisplayName(): string { return 'Issues Blocked'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: '🛡️ 3 issues blocked' };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return '🛡️ 3 issues blocked';
        }

        const data = getEliteMetricsWithFreshness();
        const metrics = data.metrics;

        if (!metrics) {
            return null;
        }

        const bugs = metrics.elite?.quality?.bugs_detected_pre_commit ?? 0;
        const security = metrics.elite?.quality?.security_issues_prevented ?? 0;
        const total = bugs + security;

        if (total === 0) {
            return null;
        }

        if (security > 0 && bugs > 0) {
            return `🛡️ ${security} vuln + ${bugs} bug${bugs > 1 ? 's' : ''}`;
        } else if (security > 0) {
            return `🛡️ ${security} vuln${security > 1 ? 's' : ''} blocked`;
        } else {
            return `🐛 ${bugs} bug${bugs > 1 ? 's' : ''} caught`;
        }
    }

    supportsRawValue(): boolean { return false; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

/**
 * Elite Success Rate - First-try success, clearly labeled
 * Format: "✅ 95% 1st try" or "⚠️ 60% 1st try"
 */
export class EliteSuccessRateWidget implements Widget {
    getDefaultColor(): string { return 'brightGreen'; }
    getDescription(): string { return 'First-try success rate with status indicator'; }
    getDisplayName(): string { return 'Success Rate'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: '✅ 95% 1st try' };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '94%' : '✅ 95% 1st try';
        }

        const data = getEliteMetricsWithFreshness();

        // rawValue mode: ALWAYS return a value (never null) to preserve column alignment
        // Just return percentage - label provides "1st try:" context
        if (item.rawValue) {
            // No metrics data at all
            if (!data.metrics) {
                return '—';
            }
            const rate = data.metrics.kpis?.first_try_success_pct ?? 0;
            const tasksCompleted = data.metrics.elite?.quality?.tasks_completed ?? 0;
            if (tasksCompleted === 0) {
                return '—';
            }
            return `${rate.toFixed(0)}%`;
        }

        // Non-rawValue mode: can return null
        const rate = data.metrics?.kpis?.first_try_success_pct ?? 0;
        const tasksCompleted = data.metrics?.elite?.quality?.tasks_completed ?? 0;
        if (tasksCompleted === 0) {
            return null;
        }

        const icon = rate >= 80 ? '✅' : rate >= 60 ? '🟡' : '⚠️';
        return `${icon} ${rate.toFixed(0)}% 1st try`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

/**
 * Elite Efficiency - Routing + Compression combined
 * Format: "⚡ 5→Codex | 30% smaller"
 */
export class EliteEfficiencyWidget implements Widget {
    getDefaultColor(): string { return 'brightYellow'; }
    getDescription(): string { return 'Compression ratio - how much smaller context is after Elite optimization'; }
    getDisplayName(): string { return 'Compression Ratio'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: '🗜️ 30% smaller' };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '30%' : '🗜️ 30% smaller';
        }

        const data = getEliteMetricsWithFreshness();
        const metrics = data.metrics;

        // rawValue mode: ALWAYS return a value (never null) to preserve column alignment
        // Label provides "Compressed:" context, so just show percentage
        if (item.rawValue) {
            if (!metrics) {
                return '—';
            }
            const ratio = metrics.kpis?.compression_ratio ?? 1;
            if (ratio > 0 && ratio < 0.95) {
                return `${Math.round((1 - ratio) * 100)}%`;
            }
            return '—';
        }

        // Non-rawValue mode: can return null
        if (!metrics) {
            return null;
        }

        const ratio = metrics.kpis?.compression_ratio ?? 1;
        if (ratio > 0 && ratio < 0.95) {
            const pctSaved = Math.round((1 - ratio) * 100);
            return `🗜️ ${pctSaved}% smaller`;
        }

        return null;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

// ============================================================================
// LEARNING: Intelligence Metrics
// ============================================================================

/**
 * Elite Learning - Patterns learned and applied
 * Format: "🧠 12 patterns (+3 this session)"
 */
export class EliteLearningWidget implements Widget {
    getDefaultColor(): string { return 'magenta'; }
    getDescription(): string { return 'Patterns learned and applied by Elite'; }
    getDisplayName(): string { return 'Learning Progress'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: '🧠 12 patterns' };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '24' : '🧠 12 patterns';
        }

        const data = getEliteMetricsWithFreshness();
        const intelligence = data.metrics?.elite?.intelligence;
        const learned = intelligence?.patterns_learned ?? 0;
        const applied = intelligence?.patterns_applied ?? 0;

        // rawValue: return placeholder if no data (keeps column alignment)
        if (item.rawValue) {
            if (!intelligence || learned === 0) {
                return '—';
            }
            return `${learned}`;
        }

        if (!intelligence || learned === 0) {
            return null;
        }

        if (applied > 0) {
            return `🧠 ${learned} patterns (${applied} applied)`;
        }
        return `🧠 ${learned} patterns`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

/**
 * Elite Cache Performance - Semantic cache hit rate
 * Format: "💾 84% cache hits"
 */
export class EliteCachePerformanceWidget implements Widget {
    getDefaultColor(): string { return 'blue'; }
    getDescription(): string { return 'Semantic cache hit rate'; }
    getDisplayName(): string { return 'Cache Performance'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: '💾 84% cache hits' };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '84%' : '💾 84% cache hits';
        }

        const data = getEliteMetricsWithFreshness();
        const rate = data.metrics?.kpis?.cache_hit_rate_pct ?? 0;

        if (rate <= 0) {
            return null;
        }

        const formatted = `${rate.toFixed(0)}%`;
        return item.rawValue ? formatted : `💾 ${formatted} cache hits`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
