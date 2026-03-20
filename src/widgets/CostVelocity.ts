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

interface SessionROI { cost?: number }

function getSessionCost(): number | null {
    try {
        const sessionFile = path.join(os.homedir(), '.claude', 'hooks', 'lib', '.session_roi.json');
        if (fs.existsSync(sessionFile)) {
            const content = fs.readFileSync(sessionFile, 'utf-8');
            const data = JSON.parse(content) as SessionROI;
            return data.cost ?? null;
        }
        return null;
    } catch {
        return null;
    }
}

function getSessionHours(context: RenderContext): number | null {
    // Try to get duration from session start time
    const sessionStart = (context.data as { session?: { started_at?: string } } | undefined)?.session?.started_at;
    if (sessionStart) {
        try {
            const start = new Date(sessionStart);
            const now = new Date();
            const diffMs = now.getTime() - start.getTime();
            if (diffMs > 0) {
                return diffMs / (1000 * 60 * 60);
            }
        } catch {
            // fall through
        }
    }

    // Try to get duration from total_duration_ms
    const durationMs = context.data?.cost?.total_duration_ms;
    if (durationMs && durationMs > 0) {
        return durationMs / (1000 * 60 * 60);
    }

    // Parse sessionDuration string as fallback (e.g. "2h15m")
    const duration = context.sessionDuration;
    if (duration) {
        const dayMatch = /(\d+)d/.exec(duration);
        const hourMatch = /(\d+)h/.exec(duration);
        const minMatch = /(\d+)m/.exec(duration);
        const days = dayMatch?.[1] ? parseInt(dayMatch[1], 10) : 0;
        const hours = hourMatch?.[1] ? parseInt(hourMatch[1], 10) : 0;
        const mins = minMatch?.[1] ? parseInt(minMatch[1], 10) : 0;
        const totalHours = days * 24 + hours + mins / 60;
        if (totalHours > 0) {
            return totalHours;
        }
    }

    return null;
}

export class CostVelocityWidget implements Widget {
    getDefaultColor(): string { return 'green'; }
    getDescription(): string { return 'Shows cost rate ($/hr) based on session cost divided by session duration'; }
    getDisplayName(): string { return 'Cost Velocity'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '4.20' : '$4.20/hr';
        }

        const totalCost = context.data?.cost?.total_cost_usd ?? getSessionCost();
        if (totalCost === null) {
            return item.rawValue ? '—' : null;
        }

        const hours = getSessionHours(context);
        if (!hours || hours <= 0) {
            return item.rawValue ? '—' : null;
        }

        const rate = totalCost / hours;

        // Threshold indicator: green <$3/hr, yellow $3-5/hr, red >=$5/hr
        // UX rationale: $5/hr approaches 5hr block cap ($25). $8 was too generous.
        let indicator = '';
        if (rate >= 5) {
            indicator = '🔴';
        } else if (rate >= 3) {
            indicator = '🟡';
        } else {
            indicator = '🟢';
        }

        const formatted = rate.toFixed(2);

        if (item.rawValue) {
            return formatted;
        }
        return `${indicator} $${formatted}/hr`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}