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

interface SessionMetrics {
    codex_routed_count?: number;
    codex_tokens_saved?: number;
    codex_cost_saved?: number;
    total_tasks_routed?: number;
}

function getCodexMetrics(): SessionMetrics {
    try {
        const metricsFile = path.join(os.homedir(), '.claude', 'data', 'session_metrics.json');
        if (!fs.existsSync(metricsFile)) {
            return {};
        }

        const content = fs.readFileSync(metricsFile, 'utf-8');
        return JSON.parse(content) as SessionMetrics;
    } catch {
        return {};
    }
}

export class CodexRoutedWidget implements Widget {
    getDefaultColor(): string { return 'brightCyan'; }
    getDescription(): string { return 'Shows number of tasks routed to Codex'; }
    getDisplayName(): string { return 'Codex Routed'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '7' : '⚡ 7';
        }

        const metrics = getCodexMetrics();
        const count = metrics.codex_routed_count ?? metrics.total_tasks_routed;

        // rawValue mode: ALWAYS return a value (never null)
        if (item.rawValue) {
            if (!count || count === 0) return '—';
            return `${count}`;
        }

        // Full mode: can return null
        if (!count || count === 0) {
            return null;
        }

        const formatted = `${count}`;
        return `⚡ ${formatted}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

export class CodexSavingsWidget implements Widget {
    getDefaultColor(): string { return 'green'; }
    getDescription(): string { return 'Shows estimated cost savings from Codex routing'; }
    getDisplayName(): string { return 'Codex Savings'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '$2.40' : '💰 $2.40';
        }

        const metrics = getCodexMetrics();
        const savings = metrics.codex_cost_saved;

        // rawValue mode: ALWAYS return a value (never null)
        if (item.rawValue) {
            if (!savings || savings <= 0) return '—';
            return `$${savings.toFixed(2)}`;
        }

        // Full mode: can return null
        if (!savings || savings <= 0) {
            return null;
        }

        const formatted = `$${savings.toFixed(2)}`;
        return `💰 ${formatted}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

export class CodexTokensSavedWidget implements Widget {
    getDefaultColor(): string { return 'yellow'; }
    getDescription(): string { return 'Shows tokens saved by Codex routing'; }
    getDisplayName(): string { return 'Codex Tokens Saved'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '45K' : '🎯 45K';
        }

        const metrics = getCodexMetrics();
        const tokens = metrics.codex_tokens_saved;

        // rawValue mode: ALWAYS return a value (never null)
        if (item.rawValue) {
            if (!tokens || tokens <= 0) return '—';

            let formatted: string;
            if (tokens >= 1000000) {
                formatted = `${(tokens / 1000000).toFixed(1)}M`;
            } else if (tokens >= 1000) {
                formatted = `${(tokens / 1000).toFixed(0)}K`;
            } else {
                formatted = `${tokens}`;
            }
            return formatted;
        }

        // Full mode: can return null
        if (!tokens || tokens <= 0) {
            return null;
        }

        let formatted: string;
        if (tokens >= 1000000) {
            formatted = `${(tokens / 1000000).toFixed(1)}M`;
        } else if (tokens >= 1000) {
            formatted = `${(tokens / 1000).toFixed(0)}K`;
        } else {
            formatted = `${tokens}`;
        }

        return `🎯 ${formatted}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

export class CodexEfficiencyWidget implements Widget {
    getDefaultColor(): string { return 'brightGreen'; }
    getDescription(): string { return 'Shows Codex routing efficiency (tasks/savings)'; }
    getDisplayName(): string { return 'Codex Efficiency'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '7 tasks' : '⚡ 7 tasks ($2.40 saved)';
        }

        const metrics = getCodexMetrics();
        const count = metrics.codex_routed_count ?? metrics.total_tasks_routed ?? 0;
        const savings = metrics.codex_cost_saved ?? 0;

        // rawValue mode: ALWAYS return a value (never null)
        // Use "N tasks" format - label provides context (GPT-5:)
        if (item.rawValue) {
            if (count === 0) return '—';
            return `${count} tasks`;
        }

        // Full mode: can return null
        if (count === 0) {
            return null;
        }

        // Full mode includes icon and savings info
        const formatted = `${count} tasks`;
        const savingsStr = savings > 0 ? ` ($${savings.toFixed(2)} saved)` : '';
        return `⚡ ${formatted}${savingsStr}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
