import * as child_process from 'node:child_process';
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

function getLinesChanged(context: RenderContext): number | null {
    // Primary: use cost metadata from Claude Code if available
    const linesAdded = context.data?.cost?.total_lines_added;
    const linesRemoved = context.data?.cost?.total_lines_removed;
    if (linesAdded !== undefined && linesRemoved !== undefined) {
        const total = linesAdded + linesRemoved;
        return total > 0 ? total : null;
    }

    // Fallback: run git diff --stat from the working directory
    const cwd = context.data?.workspace?.current_dir ?? context.data?.cwd;
    if (cwd) {
        try {
            const output = child_process.execSync('git diff --stat HEAD 2>/dev/null', {
                cwd,
                timeout: 2000,
                encoding: 'utf-8'
            });
            // Last line of git diff --stat looks like: "3 files changed, 15 insertions(+), 7 deletions(-)"
            const summaryMatch = /(\d+) insertions?\(\+\)/.exec(output);
            const deletionsMatch = /(\d+) deletions?\(-\)/.exec(output);
            const insertions = summaryMatch?.[1] ? parseInt(summaryMatch[1], 10) : 0;
            const deletions = deletionsMatch?.[1] ? parseInt(deletionsMatch[1], 10) : 0;
            const total = insertions + deletions;
            return total > 0 ? total : null;
        } catch {
            return null;
        }
    }

    return null;
}

export class CostPerLineWidget implements Widget {
    getDefaultColor(): string { return 'green'; }
    getDescription(): string { return 'Shows cost efficiency: session cost divided by lines of code changed'; }
    getDisplayName(): string { return 'Cost Per Line'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '0.023' : '$0.023/line';
        }

        const totalCost = context.data?.cost?.total_cost_usd ?? getSessionCost();
        if (totalCost === null) {
            return item.rawValue ? '—' : null;
        }

        const linesChanged = getLinesChanged(context);
        if (!linesChanged) {
            return item.rawValue ? '—' : '—';
        }

        const costPerLine = totalCost / linesChanged;

        // Threshold indicator: green <$0.01/line, yellow <$0.05/line, red >=0.05
        let indicator = '';
        if (costPerLine >= 0.05) {
            indicator = '🔴';
        } else if (costPerLine >= 0.01) {
            indicator = '🟡';
        } else {
            indicator = '🟢';
        }

        const formatted = costPerLine.toFixed(3);

        if (item.rawValue) {
            return formatted;
        }
        return `${indicator} $${formatted}/line`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}