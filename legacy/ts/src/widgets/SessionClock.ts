import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';

export class SessionClockWidget implements Widget {
    getDefaultColor(): string { return 'yellow'; }
    getDescription(): string { return 'Shows elapsed time since current session started'; }
    getDisplayName(): string { return 'Session Clock'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '2h15m' : '⏱️ 2h15m';
        }

        // Get raw duration and format it more precisely
        let duration = context.sessionDuration ?? '0m';

        // If duration is "24h+" or similar placeholder, try to get actual value
        // from session start time if available
        if (duration.includes('+') || duration === '0m') {
            const sessionStart = (context.data as { session?: { started_at?: string } })?.session?.started_at;
            if (sessionStart) {
                duration = this.formatDuration(sessionStart);
            }
        }

        // Clean up format: "2hr 15m" → "2h15m" for consistency
        duration = duration.replace(/hr?\s*/gi, 'h').replace(/\s+/g, '');

        return item.rawValue ? duration : `⏱️ ${duration}`;
    }

    private formatDuration(startTime: string): string {
        try {
            const start = new Date(startTime);
            const now = new Date();
            const diffMs = now.getTime() - start.getTime();

            if (diffMs <= 0)
                return '0m';

            const totalMins = Math.floor(diffMs / (1000 * 60));
            const days = Math.floor(totalMins / (24 * 60));
            const hours = Math.floor((totalMins % (24 * 60)) / 60);
            const mins = totalMins % 60;

            if (days > 0) {
                return hours > 0 ? `${days}d${hours}h` : `${days}d`;
            }
            if (hours > 0) {
                return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
            }
            return `${mins}m`;
        } catch {
            return '—';
        }
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}