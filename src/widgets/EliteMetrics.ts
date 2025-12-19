/**
 * Elite Metrics Widgets - v17.1 Dashboard Features
 *
 * Widgets for elite_sdk metrics:
 * - AnnualROI: Shows annual ROI value ($685K from roi_report.json)
 * - CacheHitRate: Shows cache hit percentage
 * - LearningPatterns: Shows count of learned patterns
 * - PredictionAccuracy: Shows prediction accuracy percentage
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
// Data Readers
// ============================================================================

interface ROIReport {
    annual_value?: number;
    monthly_value?: number;
    total_value?: number;
    cumulative_value?: number;
    roi_multiplier?: number;
    sessions_tracked?: number;
    data_days?: number;
    data_points?: number;
    insufficient_data?: boolean;
    timestamp?: string;
}

function getROIReport(): ROIReport | null {
    try {
        // Try elite_sdk roi_report.json first
        const reportFile = path.join(os.homedir(), '.claude', 'data', 'metrics', 'roi_report.json');
        if (fs.existsSync(reportFile)) {
            const content = fs.readFileSync(reportFile, 'utf-8');
            return JSON.parse(content) as ROIReport;
        }

        // Fallback to estimates.jsonl and calculate annual
        const estimatesFile = path.join(os.homedir(), '.claude', 'data', 'roi', 'estimates.jsonl');
        if (fs.existsSync(estimatesFile)) {
            const content = fs.readFileSync(estimatesFile, 'utf-8');
            const lines = content.trim().split('\n').filter(l => l.trim());

            // Sum up all values from the past 30 days to extrapolate annual
            let totalValue = 0;
            const now = Date.now();
            const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

            for (const line of lines) {
                try {
                    const entry = JSON.parse(line);
                    const entryTime = entry.timestamp ? new Date(entry.timestamp).getTime() : now;
                    if (entryTime > thirtyDaysAgo) {
                        totalValue += entry.actual_value ?? entry.estimated_value ?? 0;
                    }
                } catch {
                    // Skip invalid lines
                }
            }

            // Extrapolate to annual (monthly * 12)
            const annualValue = totalValue * 12;
            return { annual_value: annualValue, sessions_tracked: lines.length };
        }

        return null;
    } catch {
        return null;
    }
}

interface CacheMetrics {
    total_requests?: number;
    total_queries?: number;  // Alternative field name
    cache_hits?: number;
    hit_rate?: number;
    cache_hit_rate?: number;  // Alternative field name (as decimal 0-1)
    latency_saved_ms?: number;
}

function getCacheMetrics(): CacheMetrics | null {
    try {
        // Try cache_metrics.jsonl
        const metricsFile = path.join(os.homedir(), '.claude', 'data', 'meta_learning', 'cache_metrics.jsonl');
        if (fs.existsSync(metricsFile)) {
            const content = fs.readFileSync(metricsFile, 'utf-8');
            const lines = content.trim().split('\n').filter(l => l.trim());
            if (lines.length === 0) return null;

            // Parse last line for latest metrics
            const lastLine = lines[lines.length - 1];
            if (!lastLine) return null;
            return JSON.parse(lastLine) as CacheMetrics;
        }

        // Try alternative location
        const altFile = path.join(os.homedir(), '.claude', 'data', 'cache_stats.json');
        if (fs.existsSync(altFile)) {
            const content = fs.readFileSync(altFile, 'utf-8');
            return JSON.parse(content) as CacheMetrics;
        }

        return null;
    } catch {
        return null;
    }
}

interface LearningData {
    patterns_count?: number;
    patterns?: unknown[];
    abstractions?: unknown[];
    rules?: unknown[];
}

function getLearningPatterns(): number {
    try {
        let totalPatterns = 0;

        // Check patterns.json
        const patternsFile = path.join(os.homedir(), '.claude', 'data', 'learning', 'patterns.json');
        if (fs.existsSync(patternsFile)) {
            const content = fs.readFileSync(patternsFile, 'utf-8');
            const data = JSON.parse(content) as LearningData;
            totalPatterns += data.patterns_count ?? data.patterns?.length ?? 0;
        }

        // Check abstractions
        const abstractionsFile = path.join(os.homedir(), '.claude', 'data', 'learning', 'abstractions.json');
        if (fs.existsSync(abstractionsFile)) {
            const content = fs.readFileSync(abstractionsFile, 'utf-8');
            const data = JSON.parse(content) as LearningData;
            totalPatterns += data.abstractions?.length ?? 0;
        }

        // Check user learnings directory
        const userLearningsDir = path.join(os.homedir(), '.claude', 'data', 'learning', 'user');
        if (fs.existsSync(userLearningsDir) && fs.statSync(userLearningsDir).isDirectory()) {
            const files = fs.readdirSync(userLearningsDir);
            totalPatterns += files.filter(f => f.endsWith('.json') || f.endsWith('.jsonl')).length;
        }

        return totalPatterns;
    } catch {
        return 0;
    }
}

interface PredictionData {
    accuracy?: number;
    total_predictions?: number;
    correct_predictions?: number;
}

function getPredictionAccuracy(): number | null {
    try {
        const predFile = path.join(os.homedir(), '.claude', 'data', 'learned_predictions.json');
        if (fs.existsSync(predFile)) {
            const content = fs.readFileSync(predFile, 'utf-8');
            const data = JSON.parse(content) as PredictionData;

            if (data.accuracy !== undefined) {
                return data.accuracy;
            }

            if (data.total_predictions && data.correct_predictions) {
                return (data.correct_predictions / data.total_predictions) * 100;
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

function formatMoney(value: number): string {
    if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
        return `$${(value / 1000).toFixed(0)}K`;
    } else {
        return `$${value.toFixed(0)}`;
    }
}

// ============================================================================
// Widget Implementations
// ============================================================================

/**
 * Annual ROI Widget - Shows annual value from elite_sdk ROI tracking
 * Example output: "$685K" or "Annual: $685K"
 */
export class AnnualROIWidget implements Widget {
    getDefaultColor(): string { return 'brightGreen'; }
    getDescription(): string { return 'Shows annual ROI value from elite_sdk metrics (e.g., $685K)'; }
    getDisplayName(): string { return 'Annual ROI'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '$685K/yr' : '💎 $685K/yr';
        }

        const report = getROIReport();

        // Check for insufficient data flag
        if (report?.insufficient_data) {
            // Not enough historical data to project annual value
            // Show cumulative if available, otherwise hide
            const cumulative = report.cumulative_value;
            if (item.rawValue) {
                return cumulative && cumulative > 0 ? `~${formatMoney(cumulative)}` : '—';
            }
            // In full mode, don't show unreliable projections
            return null;
        }

        const value = report?.annual_value ?? (report?.monthly_value ? report.monthly_value * 12 : null);
        const formatted = value && value > 0 ? formatMoney(value) : null;

        // rawValue mode: ALWAYS return a value (never null)
        if (item.rawValue) {
            return formatted ? `${formatted}/yr` : '—';
        }

        // Full mode: can return null
        if (!formatted) {
            return null;
        }
        return `💎 Projected: ${formatted}/yr`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

/**
 * Cache Hit Rate Widget - Shows cache hit percentage
 * Example output: "84%" or "Cache: 84%"
 */
export class CacheHitRateWidget implements Widget {
    getDefaultColor(): string { return 'cyan'; }
    getDescription(): string { return 'Shows cache hit rate percentage'; }
    getDisplayName(): string { return 'Cache Hit Rate'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '84%' : '⚡ 84%';
        }

        // Try to get rate from various sources
        let rate: number | null = null;

        const metrics = getCacheMetrics();
        if (metrics) {
            // Priority 1: Calculate from actual counts (most reliable)
            const total = metrics.total_requests ?? metrics.total_queries ?? 0;
            const hits = metrics.cache_hits ?? 0;
            if (total > 0 && hits > 0) {
                rate = (hits / total) * 100;
            }
            // Priority 2: Use hit_rate field (stored as percentage 0-100)
            else if (metrics.hit_rate !== undefined && metrics.hit_rate >= 0) {
                // hit_rate is stored as percentage (0-100), clamp to valid range
                rate = Math.min(100, Math.max(0, metrics.hit_rate));
            }
            // Priority 3: cache_hit_rate (typically decimal 0-1, convert to percentage)
            else if (metrics.cache_hit_rate !== undefined && metrics.cache_hit_rate >= 0) {
                // cache_hit_rate is decimal (0-1), convert to percentage
                rate = metrics.cache_hit_rate > 1
                    ? Math.min(100, metrics.cache_hit_rate)  // Already percentage, clamp
                    : metrics.cache_hit_rate * 100;          // Convert from decimal
            }
        }

        // Fallback: calculate from tokenMetrics if available
        if (rate === null && context.tokenMetrics) {
            const cached = context.tokenMetrics.cachedTokens ?? 0;
            const input = context.tokenMetrics.inputTokens ?? 1;
            if (input > 0) {
                rate = Math.round((cached / input) * 100);
            }
        }

        const formatted = rate !== null ? `${Math.round(rate)}%` : null;

        // rawValue mode: ALWAYS return a value (never null)
        if (item.rawValue) {
            return formatted ?? '—';
        }

        // Full mode: can return null
        if (!formatted) {
            return null;
        }
        return `⚡ Cache: ${formatted}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

/**
 * Learning Patterns Widget - Shows count of learned patterns
 * Example output: "142" or "🧠 142"
 */
export class LearningPatternsWidget implements Widget {
    getDefaultColor(): string { return 'magenta'; }
    getDescription(): string { return 'Shows count of learned patterns from elite_sdk'; }
    getDisplayName(): string { return 'Learning Patterns'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '142' : '🧠 142';
        }

        const count = getLearningPatterns();
        const formatted = count > 0 ? count.toString() : null;

        // rawValue mode: ALWAYS return a value (never null)
        if (item.rawValue) {
            return formatted ?? '—';
        }

        // Full mode: can return null
        if (!formatted) {
            return null;
        }
        return `🧠 Learned: ${formatted}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

/**
 * Prediction Accuracy Widget - Shows prediction accuracy percentage
 * Example output: "94%" or "🎯 94%"
 */
export class PredictionAccuracyWidget implements Widget {
    getDefaultColor(): string { return 'brightCyan'; }
    getDescription(): string { return 'Shows prediction accuracy from elite_sdk learning'; }
    getDisplayName(): string { return 'Prediction Accuracy'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '94%' : '🎯 94%';
        }

        const accuracy = getPredictionAccuracy();
        if (accuracy === null) {
            // Return fallback to maintain column alignment
            return item.rawValue ? '—' : '🎯 —';
        }

        const formatted = `${Math.round(accuracy)}%`;
        return item.rawValue ? formatted : `🎯 Accuracy: ${formatted}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
