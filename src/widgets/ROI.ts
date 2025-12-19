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

interface ROIEstimate {
    estimated_value?: number;
    estimated_cost?: number;
    estimated_roi?: number;
    actual_value?: number;
    actual_cost?: number;
    actual_roi?: number;
    timestamp?: string;
}

interface SessionROI {
    npv?: number;
    cost?: number;
    roi?: number;
    session_id?: string;
    updated_at?: string;
}

/**
 * Get session-level ROI metrics (aggregated across entire session).
 * Primary source: .session_roi.json (session aggregates)
 * Fallback: estimates.jsonl (last individual task - legacy behavior)
 */
function getSessionROI(): SessionROI | null {
    try {
        // Primary: Session aggregate file (correct data source)
        const sessionFile = path.join(os.homedir(), '.claude', 'hooks', 'lib', '.session_roi.json');
        if (fs.existsSync(sessionFile)) {
            const content = fs.readFileSync(sessionFile, 'utf-8');
            return JSON.parse(content) as SessionROI;
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Get latest individual task ROI (for task-level widgets if needed).
 * Source: estimates.jsonl (last line = most recent task)
 */
function getLatestTaskROI(): ROIEstimate | null {
    try {
        const roiFile = path.join(os.homedir(), '.claude', 'data', 'roi', 'estimates.jsonl');
        if (!fs.existsSync(roiFile)) {
            return null;
        }
        const content = fs.readFileSync(roiFile, 'utf-8');
        const lines = content.trim().split('\n').filter(l => l.trim());
        if (lines.length === 0) return null;

        const lastLine = lines[lines.length - 1];
        if (!lastLine) return null;
        return JSON.parse(lastLine) as ROIEstimate;
    } catch {
        return null;
    }
}

// Legacy alias for backward compatibility
function getLatestROI(): ROIEstimate | null {
    return getLatestTaskROI();
}

export class ROIWidget implements Widget {
    getDefaultColor(): string { return 'brightGreen'; }
    getDescription(): string { return 'Shows session ROI multiplier (aggregate value/cost ratio)'; }
    getDisplayName(): string { return 'Session ROI'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '3.5K×' : '📈 3.5K×';
        }

        // Use session aggregates (primary) or fall back to last task
        const session = getSessionROI();
        const task = getLatestTaskROI();

        // Prefer session ROI, fall back to task ROI
        const roiValue = session?.roi ?? task?.actual_roi ?? task?.estimated_roi;

        // rawValue mode: ALWAYS return a value (never null)
        if (item.rawValue) {
            if (roiValue === undefined || roiValue <= 0) return '—';
            const formatted = roiValue >= 1000
                ? `${(roiValue / 1000).toFixed(1)}K×`
                : roiValue >= 100
                    ? `${Math.round(roiValue)}×`
                    : `${roiValue.toFixed(1)}×`;
            return formatted;
        }

        // Full mode: can return null
        if (!session && !task) {
            return null;
        }

        if (roiValue === undefined || roiValue <= 0) {
            return null;
        }

        const formatted = roiValue >= 1000
            ? `${(roiValue / 1000).toFixed(1)}K×`
            : roiValue >= 100
                ? `${Math.round(roiValue)}×`
                : `${roiValue.toFixed(1)}×`;

        return `📈 ROI: ${formatted}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

export class SessionNPVWidget implements Widget {
    getDefaultColor(): string { return 'cyan'; }
    getDescription(): string { return 'Shows session NPV (aggregate Net Present Value)'; }
    getDisplayName(): string { return 'Session NPV'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '$156K' : 'NPV: $156K';
        }

        // Use session aggregates (primary) or fall back to last task
        const session = getSessionROI();
        const task = getLatestTaskROI();

        // Prefer session NPV, fall back to task value
        const value = session?.npv ?? task?.actual_value ?? task?.estimated_value;

        // rawValue mode: ALWAYS return a value (never null)
        if (item.rawValue) {
            if (value === undefined || value <= 0) return '—';

            let formatted: string;
            if (value >= 1000000) {
                formatted = `$${(value / 1000000).toFixed(1)}M`;
            } else if (value >= 1000) {
                formatted = `$${(value / 1000).toFixed(1)}K`;
            } else {
                formatted = `$${value.toFixed(0)}`;
            }
            return formatted;
        }

        // Full mode: can return null
        if (!session && !task) {
            return null;
        }

        if (value === undefined || value <= 0) {
            return null;
        }

        let formatted: string;
        if (value >= 1000000) {
            formatted = `$${(value / 1000000).toFixed(1)}M`;
        } else if (value >= 1000) {
            formatted = `$${(value / 1000).toFixed(1)}K`;
        } else {
            formatted = `$${value.toFixed(0)}`;
        }

        return `NPV: ${formatted}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
