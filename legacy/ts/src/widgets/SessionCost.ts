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

interface SessionROI {
    cost?: number;
}

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

export class SessionCostWidget implements Widget {
    getDefaultColor(): string { return 'green'; }
    getDescription(): string { return 'Shows the total session cost in USD'; }
    getDisplayName(): string { return 'Session Cost'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '$43.76' : 'Cost: $43.76';
        }

        // Primary: context data from Claude Code, fallback: session_roi.json
        const totalCost = context.data?.cost?.total_cost_usd ?? getSessionCost();
        if (totalCost === undefined || totalCost === null) {
            return item.rawValue ? '—' : null;
        }

        // Format the cost to 2 decimal places
        const formattedCost = `$${totalCost.toFixed(2)}`;

        return item.rawValue ? formattedCost : `Cost: ${formattedCost}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}