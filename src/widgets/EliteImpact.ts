/**
 * Elite Impact Widgets - Comprehensive Elite Framework Measurement
 *
 * CRITICAL DISTINCTION:
 * - BASELINE: Claude Code's built-in prompt caching (Anthropic's API) - FREE
 * - ELITE: Our 13+ optimization phases ON TOP of baseline
 *
 * Elite Framework contributes to 4 categories:
 * 1. COST REDUCTION: Routing, compression, semantic cache
 * 2. SPEED: Parallel execution, prediction, latency savings
 * 3. QUALITY: 1-shot success, bug prevention, rework prevention
 * 4. INTELLIGENCE: Learning, adaptation, predictions
 *
 * All widgets show proper labels with units.
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
// Data Reader
// ============================================================================

interface EliteMetrics {
    session_id?: string;
    timestamp?: string;
    session_duration_seconds?: number;
    baseline?: {
        cache_read_tokens?: number;
        baseline_cost_saved_usd?: number;
    };
    elite?: {
        cost_reduction?: {
            compression_ratio?: number;
            compression_cost_saved_usd?: number;
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
    attribution_pct?: {
        cost_reduction?: number;
        speed?: number;
        quality?: number;
    };
}

function getEliteMetrics(): EliteMetrics | null {
    try {
        const metricsFile = path.join(os.homedir(), '.claude', 'data', 'elite', 'metrics.json');
        if (fs.existsSync(metricsFile)) {
            const content = fs.readFileSync(metricsFile, 'utf-8');
            return JSON.parse(content) as EliteMetrics;
        }
        return null;
    } catch {
        return null;
    }
}

function formatCost(cost: number): string {
    if (cost >= 1000) {
        return `$${(cost / 1000).toFixed(1)}K`;
    } else if (cost >= 1) {
        // Smart decimals: only show .XX if there are cents
        const rounded = Math.round(cost * 100) / 100;
        if (rounded === Math.floor(rounded)) {
            return `$${Math.floor(rounded)}`;  // Whole dollars: $35
        }
        return `$${rounded.toFixed(2)}`;  // Has cents: $35.50
    } else if (cost >= 0.01) {
        return `$${cost.toFixed(2)}`;
    } else {
        return `$${cost.toFixed(3)}`;
    }
}

function formatTokens(tokens: number): string {
    if (tokens >= 1000000) {
        return `${(tokens / 1000000).toFixed(1)}M`;
    } else if (tokens >= 1000) {
        return `${(tokens / 1000).toFixed(1)}K`;
    }
    return `${tokens}`;
}

function formatTime(ms: number): string {
    if (ms >= 60000) {
        return `${(ms / 60000).toFixed(1)}min`;
    } else if (ms >= 1000) {
        return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${Math.round(ms)}ms`;
}

// ============================================================================
// COST REDUCTION WIDGETS
// ============================================================================

/**
 * Elite Cost Saved (NOT baseline)
 * Label: "Elite $X.XX" - Cost saved by elite framework specifically
 */
export class EliteImpactCostWidget implements Widget {
    getDefaultColor(): string { return 'green'; }
    getDescription(): string { return 'Cost saved by Elite Framework (compression + routing + cache) - excludes Claude Code baseline'; }
    getDisplayName(): string { return 'Elite Cost Saved'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: 'Elite $0.02' };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '$0.02' : 'Elite $0.02';
        }

        const metrics = getEliteMetrics();
        const eliteCost = metrics?.totals?.cost_saved_usd ?? 0;

        // rawValue mode: ALWAYS return a value (never null)
        if (item.rawValue) {
            if (eliteCost <= 0) return '—';
            return formatCost(eliteCost);
        }

        // Full mode: can return null
        if (eliteCost <= 0) {
            return null;
        }

        const formatted = formatCost(eliteCost);
        return `Elite ${formatted}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

/**
 * Elite Value Breakdown - shows Elite-specific contributions
 * C: Cost saved ($) from routing/compression/semantic-cache
 * Q: Bugs/issues prevented by hooks and validation gates
 * Example: "C:$35 Q:5"
 */
export class EliteTotalValueWidget implements Widget {
    getDefaultColor(): string { return 'brightGreen'; }
    getDescription(): string { return 'Elite value: C=Cost saved ($), Q=Bugs prevented'; }
    getDisplayName(): string { return 'Elite Value Breakdown'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: 'C:$35 Q:5' };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? 'C:$35 Q:5' : 'Value $1.4K';
        }

        const metrics = getEliteMetrics();

        // Elite-specific metrics only
        const costSaved = metrics?.totals?.cost_saved_usd ?? 0;
        const bugsPrevent = metrics?.elite?.quality?.bugs_detected_pre_commit ?? 0;
        const secIssues = metrics?.elite?.quality?.security_issues_prevented ?? 0;
        const totalBugs = bugsPrevent + secIssues;

        // rawValue mode: Show Elite-specific breakdown
        if (item.rawValue) {
            const parts: string[] = [];
            if (costSaved > 0) parts.push(`C:${formatCost(costSaved)}`);
            if (totalBugs > 0) parts.push(`Q:${totalBugs}`);
            return parts.length > 0 ? parts.join(' ') : '—';
        }

        // Full mode: show total value
        const totalValue = metrics?.totals?.total_elite_value_usd ?? 0;
        if (totalValue <= 0) return null;
        return `Value ${formatCost(totalValue)}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

/**
 * Compression Ratio
 * Label: "Comp 0.70×" - How much prompts are compressed
 */
export class EliteCompressionRatioWidget implements Widget {
    getDefaultColor(): string { return 'yellow'; }
    getDescription(): string { return 'Compression ratio achieved by Elite (lower = more compression)'; }
    getDisplayName(): string { return 'Compression Ratio'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: 'Comp 0.70×' };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '0.70×' : 'Comp 0.70×';
        }

        const metrics = getEliteMetrics();
        const ratio = metrics?.kpis?.compression_ratio ?? 1.0;

        // rawValue mode: ALWAYS return a value (never null)
        if (item.rawValue) {
            if (ratio >= 1.0) return '—';
            return `${ratio.toFixed(2)}×`;
        }

        // Full mode: can return null
        if (ratio >= 1.0) {
            return null;
        }

        const formatted = `${ratio.toFixed(2)}×`;
        return `Comp ${formatted}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

/**
 * Routing Count (Codex + Haiku)
 * Label: "Route 5" - Tasks routed to cheaper models
 */
export class EliteRoutingCountWidget implements Widget {
    getDefaultColor(): string { return 'cyan'; }
    getDescription(): string { return 'Tasks routed to cheaper models (Codex/Haiku instead of Sonnet)'; }
    getDisplayName(): string { return 'Routing Count'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: 'Route 5' };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '5' : 'Route 5';
        }

        const metrics = getEliteMetrics();
        const count = metrics?.kpis?.routing_count ?? 0;

        // rawValue mode: ALWAYS return a value (never null)
        if (item.rawValue) {
            if (count <= 0) return '—';
            return `${count}`;
        }

        // Full mode: can return null
        if (count <= 0) {
            return null;
        }

        return `Route ${count}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

// ============================================================================
// SPEED WIDGETS
// ============================================================================

/**
 * Parallel Speedup
 * Label: "Speed 4.2×" - Parallel execution speedup factor
 */
export class EliteSpeedupWidget implements Widget {
    getDefaultColor(): string { return 'brightCyan'; }
    getDescription(): string { return 'Parallel execution speedup factor (sequential time / parallel time)'; }
    getDisplayName(): string { return 'Parallel Speedup'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: 'Speed 4.2×' };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '4.2×' : 'Speed 4.2×';
        }

        const metrics = getEliteMetrics();
        const speedup = metrics?.kpis?.parallel_speedup ?? 1.0;

        // rawValue mode: ALWAYS return a value (never null)
        if (item.rawValue) {
            if (speedup <= 1.0) return '—';
            return `${speedup.toFixed(1)}×`;
        }

        // Full mode: can return null
        if (speedup <= 1.0) {
            return null;
        }

        const formatted = `${speedup.toFixed(1)}×`;
        return `Speed ${formatted}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

/**
 * Latency Saved
 * Label: "Save 80ms" - Time saved by caching and predictions
 */
export class EliteLatencySavedWidget implements Widget {
    getDefaultColor(): string { return 'brightYellow'; }
    getDescription(): string { return 'Latency saved by predictions and caching'; }
    getDisplayName(): string { return 'Latency Saved'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: 'Save 80ms' };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '80ms' : 'Save 80ms';
        }

        const metrics = getEliteMetrics();
        const latency = metrics?.elite?.speed?.latency_saved_ms ?? 0;

        // rawValue mode: ALWAYS return a value (never null)
        if (item.rawValue) {
            if (latency <= 0) return '—';
            return formatTime(latency);
        }

        // Full mode: can return null
        if (latency <= 0) {
            return null;
        }

        const formatted = formatTime(latency);
        return `Save ${formatted}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

/**
 * Prediction Accuracy
 * Label: "Pred 85%" - How accurate predictions are
 */
export class ElitePredictionWidget implements Widget {
    getDefaultColor(): string { return 'magenta'; }
    getDescription(): string { return 'Prediction accuracy percentage'; }
    getDisplayName(): string { return 'Prediction Accuracy'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: 'Pred 85%' };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '85%' : 'Pred 85%';
        }

        const metrics = getEliteMetrics();
        const accuracy = metrics?.kpis?.prediction_accuracy_pct ?? 0;

        // rawValue mode: ALWAYS return a value (never null)
        if (item.rawValue) {
            if (accuracy <= 0) return '—';
            return `${accuracy.toFixed(0)}%`;
        }

        // Full mode: can return null
        if (accuracy <= 0) {
            return null;
        }

        return `Pred ${accuracy.toFixed(0)}%`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

// ============================================================================
// QUALITY WIDGETS
// ============================================================================

/**
 * First Try Success Rate
 * Label: "1st 95%" - Percentage of tasks completed on first try
 */
export class EliteFirstTryWidget implements Widget {
    getDefaultColor(): string { return 'brightGreen'; }
    getDescription(): string { return 'First-try success rate (tasks completed without rework)'; }
    getDisplayName(): string { return '1st Try Success'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: '1st 95%' };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '95%' : '1st 95%';
        }

        const metrics = getEliteMetrics();
        const rate = metrics?.kpis?.first_try_success_pct ?? 0;

        // rawValue mode: ALWAYS return a value (never null)
        if (item.rawValue) {
            if (rate <= 0) return '—';
            return `${rate.toFixed(0)}%`;
        }

        // Full mode: can return null
        if (rate <= 0) {
            return null;
        }

        return `1st ${rate.toFixed(0)}%`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

/**
 * Bugs Prevented
 * Label: "Bugs 3" - Bugs caught before commit
 */
export class EliteBugsPreventedWidget implements Widget {
    getDefaultColor(): string { return 'red'; }
    getDescription(): string { return 'Bugs detected and prevented before commit'; }
    getDisplayName(): string { return 'Bugs Prevented'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: 'Bugs 3' };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '3' : 'Bugs 3';
        }

        const metrics = getEliteMetrics();
        const bugs = metrics?.elite?.quality?.bugs_detected_pre_commit ?? 0;

        // rawValue mode: ALWAYS return a value (never null)
        if (item.rawValue) {
            if (bugs <= 0) return '—';
            return `${bugs}`;
        }

        // Full mode: can return null
        if (bugs <= 0) {
            return null;
        }

        return `Bugs ${bugs}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

/**
 * Security Issues Prevented
 * Label: "Sec 1" - Security vulnerabilities prevented
 */
export class EliteSecurityWidget implements Widget {
    getDefaultColor(): string { return 'brightRed'; }
    getDescription(): string { return 'Security vulnerabilities detected and prevented'; }
    getDisplayName(): string { return 'Security Prevented'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: 'Sec 1' };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '1' : 'Sec 1';
        }

        const metrics = getEliteMetrics();
        const security = metrics?.elite?.quality?.security_issues_prevented ?? 0;

        // rawValue mode: ALWAYS return a value (never null)
        if (item.rawValue) {
            if (security <= 0) return '—';
            return `${security}`;
        }

        // Full mode: can return null
        if (security <= 0) {
            return null;
        }

        return `Sec ${security}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

// ============================================================================
// INTELLIGENCE WIDGETS
// ============================================================================

/**
 * Patterns Learned
 * Label: "Learn 12" - Patterns learned from interactions
 */
export class ElitePatternsWidget implements Widget {
    getDefaultColor(): string { return 'brightMagenta'; }
    getDescription(): string { return 'Patterns learned from interactions for future optimization'; }
    getDisplayName(): string { return 'Patterns Learned'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: 'Learn 12' };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '12' : 'Learn 12';
        }

        const metrics = getEliteMetrics();
        const patterns = metrics?.elite?.intelligence?.patterns_learned ?? 0;

        // rawValue mode: ALWAYS return a value (never null)
        if (item.rawValue) {
            if (patterns <= 0) return '—';
            return `${patterns}`;
        }

        // Full mode: can return null
        if (patterns <= 0) {
            return null;
        }

        return `Learn ${patterns}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

/**
 * Cache Hit Rate
 * Label: "Cache 84%" - Semantic cache hit percentage
 */
export class EliteCacheHitWidget implements Widget {
    getDefaultColor(): string { return 'brightBlue'; }
    getDescription(): string { return 'Semantic cache hit rate (our cache, not Anthropic baseline)'; }
    getDisplayName(): string { return 'Cache Hit Rate'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: 'Cache 84%' };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '84%' : 'Cache 84%';
        }

        const metrics = getEliteMetrics();
        const rate = metrics?.kpis?.cache_hit_rate_pct ?? 0;

        // rawValue mode: ALWAYS return a value (never null)
        if (item.rawValue) {
            if (rate <= 0) return '—';
            return `${rate.toFixed(0)}%`;
        }

        // Full mode: can return null
        if (rate <= 0) {
            return null;
        }

        return `Cache ${rate.toFixed(0)}%`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

// ============================================================================
// COMPARISON WIDGETS
// ============================================================================

/**
 * Elite vs Baseline
 * Label: "E:$0.03/B:$0.04" - Side by side comparison
 */
export class EliteVsBaselineWidget implements Widget {
    getDefaultColor(): string { return 'white'; }
    getDescription(): string { return 'Elite vs Baseline cost savings comparison'; }
    getDisplayName(): string { return 'Elite vs Baseline'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: 'E:$0.03/B:$0.04' };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return 'E:$0.03/B:$0.04';
        }

        const metrics = getEliteMetrics();
        const eliteCost = metrics?.totals?.cost_saved_usd ?? 0;
        const baselineCost = metrics?.totals?.baseline_cost_saved_usd ?? 0;

        if (eliteCost <= 0 && baselineCost <= 0) {
            return null;
        }

        const eliteStr = formatCost(eliteCost).replace('$', '');
        const baselineStr = formatCost(baselineCost).replace('$', '');
        return `E:$${eliteStr}/B:$${baselineStr}`;
    }

    supportsRawValue(): boolean { return false; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

/**
 * Attribution Breakdown
 * Label: "Cost:45%/Speed:5%/Quality:50%" - Which category contributes most
 */
export class EliteAttributionWidget implements Widget {
    getDefaultColor(): string { return 'brightWhite'; }
    getDescription(): string { return 'Value attribution by category (Cost/Speed/Quality)'; }
    getDisplayName(): string { return 'Attribution'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: 'C:45%/S:5%/Q:50%' };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return 'C:45%/S:5%/Q:50%';
        }

        const metrics = getEliteMetrics();
        const attr = metrics?.attribution_pct;

        if (!attr) {
            return null;
        }

        const cost = Math.round(attr.cost_reduction ?? 0);
        const speed = Math.round(attr.speed ?? 0);
        const quality = Math.round(attr.quality ?? 0);

        if (cost === 0 && speed === 0 && quality === 0) {
            return null;
        }

        return `C:${cost}%/S:${speed}%/Q:${quality}%`;
    }

    supportsRawValue(): boolean { return false; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

/**
 * Total Combined Savings
 * Label: "Total $200.09" - Elite + Baseline combined
 */
export class TotalSavingsWidget implements Widget {
    getDefaultColor(): string { return 'brightGreen'; }
    getDescription(): string { return 'Total combined savings (Elite + Claude Code baseline)'; }
    getDisplayName(): string { return 'Total Savings'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: 'Total $200.09' };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '$200.09' : 'Total $200.09';
        }

        const metrics = getEliteMetrics();
        const total = metrics?.totals?.combined_value_usd ?? 0;

        // rawValue mode: ALWAYS return a value (never null)
        if (item.rawValue) {
            if (total <= 0) return '—';
            return formatCost(total);
        }

        // Full mode: can return null
        if (total <= 0) {
            return null;
        }

        const formatted = formatCost(total);
        return `Total ${formatted}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
