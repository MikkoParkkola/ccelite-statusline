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

function getLatestROI(): ROIEstimate | null {
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

export class ROIWidget implements Widget {
    getDefaultColor(): string { return 'brightGreen'; }
    getDescription(): string { return 'Shows ROI multiplier from session value tracking (e.g., 42×)'; }
    getDisplayName(): string { return 'ROI Multiplier'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '42×' : '📈 42×';
        }

        const roi = getLatestROI();
        const roiValue = roi?.actual_roi ?? roi?.estimated_roi;

        // rawValue mode: ALWAYS return a value (never null)
        if (item.rawValue) {
            if (roiValue === undefined || roiValue <= 0) return '—';
            const formatted = roiValue >= 100
                ? `${Math.round(roiValue)}×`
                : `${roiValue.toFixed(1)}×`;
            return formatted;
        }

        // Full mode: can return null
        if (!roi) {
            return null;
        }

        if (roiValue === undefined || roiValue <= 0) {
            return null;
        }

        const formatted = roiValue >= 100
            ? `${Math.round(roiValue)}×`
            : `${roiValue.toFixed(1)}×`;

        return `📈 ROI: ${formatted}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

export class SessionNPVWidget implements Widget {
    getDefaultColor(): string { return 'cyan'; }
    getDescription(): string { return 'Shows estimated session NPV (Net Present Value)'; }
    getDisplayName(): string { return 'Session NPV'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '$1.2K' : 'NPV: $1.2K';
        }

        const roi = getLatestROI();
        const value = roi?.actual_value ?? roi?.estimated_value;

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
        if (!roi) {
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
