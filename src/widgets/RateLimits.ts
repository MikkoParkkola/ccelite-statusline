import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';

// Format ISO 8601 timestamp as relative duration (e.g., "2h15m")
function formatRelativeReset(isoDate: string): string {
    try {
        const reset = new Date(isoDate);
        const now = new Date();
        const diffMs = reset.getTime() - now.getTime();

        if (diffMs <= 0)
            return 'now';

        const totalMins = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(totalMins / 60);
        const mins = totalMins % 60;

        if (hours < 1)
            return `${mins}m`;
        if (hours < 24)
            return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;

        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        return remainingHours > 0 ? `${days}d${remainingHours}h` : `${days}d`;
    } catch {
        return '?';
    }
}

// Color coding: green (<50%), yellow (50-80%), red (>80%), bold red (>95%)
function rateColorIcon(pct: number): string {
    if (pct > 95)
        return '\u001b[1;31m\u25cf\u001b[0m'; // bold red dot
    if (pct > 80)
        return '\u{1F534}'; // red
    if (pct >= 50)
        return '\u{1F7E1}'; // yellow
    return '\u{1F7E2}'; // green
}

// ============================================================================
// RATE LIMIT 5H - Shows 5-hour window usage from stdin rate_limits field
// ============================================================================

export class Rate5hWidget implements Widget {
    getDefaultColor(): string { return 'cyan'; }
    getDescription(): string { return '5-hour rate limit usage percentage (from CC 2.1.80 rate_limits field)'; }
    getDisplayName(): string { return 'Rate 5h'; }
    getEditorDisplay(): WidgetEditorDisplay {
        return { displayText: 'Rate 5h' };
    }

    render(item: WidgetItem, context: RenderContext, _settings: Settings): string | null {
        if (context.isPreview)
            return item.rawValue ? '42%' : `${rateColorIcon(42)} 5h 42%`;

        const rl = context.data?.rate_limits?.five_hour;
        if (!rl)
            return null;

        const pct = Math.round(rl.used_percentage);
        const icon = rateColorIcon(pct);

        return item.rawValue
            ? `${pct}%`
            : `${icon} 5h ${pct}%`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(): boolean { return true; }
}

// ============================================================================
// RATE LIMIT 7D - Shows 7-day window usage from stdin rate_limits field
// ============================================================================

export class Rate7dWidget implements Widget {
    getDefaultColor(): string { return 'blue'; }
    getDescription(): string { return '7-day rate limit usage percentage (from CC 2.1.80 rate_limits field)'; }
    getDisplayName(): string { return 'Rate 7d'; }
    getEditorDisplay(): WidgetEditorDisplay {
        return { displayText: 'Rate 7d' };
    }

    render(item: WidgetItem, context: RenderContext, _settings: Settings): string | null {
        if (context.isPreview)
            return item.rawValue ? '65%' : `${rateColorIcon(65)} 7d 65%`;

        const rl = context.data?.rate_limits?.seven_day;
        if (!rl)
            return null;

        const pct = Math.round(rl.used_percentage);
        const icon = rateColorIcon(pct);

        return item.rawValue
            ? `${pct}%`
            : `${icon} 7d ${pct}%`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(): boolean { return true; }
}

// ============================================================================
// RATE RESET - Shows time until next reset (picks the sooner of 5h/7d)
// ============================================================================

export class RateResetWidget implements Widget {
    getDefaultColor(): string { return 'gray'; }
    getDescription(): string { return 'Time until next rate limit reset (from CC 2.1.80 rate_limits field)'; }
    getDisplayName(): string { return 'Rate Reset'; }
    getEditorDisplay(): WidgetEditorDisplay {
        return { displayText: 'Rate Reset' };
    }

    render(item: WidgetItem, context: RenderContext, _settings: Settings): string | null {
        if (context.isPreview)
            return item.rawValue ? '2h15m' : '\u21bb 2h15m';

        const rl = context.data?.rate_limits;
        if (!rl)
            return null;

        // Collect available reset times, pick the soonest
        const resets: { label: string; iso: string }[] = [];
        if (rl.five_hour?.resets_at)
            resets.push({ label: '5h', iso: rl.five_hour.resets_at });
        if (rl.seven_day?.resets_at)
            resets.push({ label: '7d', iso: rl.seven_day.resets_at });

        if (resets.length === 0)
            return null;

        // Sort by soonest reset
        resets.sort((a, b) => new Date(a.iso).getTime() - new Date(b.iso).getTime());
        const soonest = resets[0]!;
        const rel = formatRelativeReset(soonest.iso);

        return item.rawValue
            ? rel
            : `\u21bb ${rel}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(): boolean { return true; }
}