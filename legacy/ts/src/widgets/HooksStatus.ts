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

interface HookConfig {
    type: string;
    matcher?: string;
    command: string;
    timeout?: number;
}

interface ClaudeSettings { hooks?: Record<string, HookConfig[]> }

function countHooks(): { total: number; byEvent: Record<string, number> } {
    try {
        const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
        if (!fs.existsSync(settingsPath)) {
            return { total: 0, byEvent: {} };
        }

        const content = fs.readFileSync(settingsPath, 'utf-8');
        const settings = JSON.parse(content) as ClaudeSettings;

        if (!settings.hooks) {
            return { total: 0, byEvent: {} };
        }

        const byEvent: Record<string, number> = {};
        let total = 0;

        for (const [event, hooks] of Object.entries(settings.hooks)) {
            if (Array.isArray(hooks)) {
                byEvent[event] = hooks.length;
                total += hooks.length;
            }
        }

        return { total, byEvent };
    } catch {
        return { total: 0, byEvent: {} };
    }
}

export class HooksCountWidget implements Widget {
    getDefaultColor(): string { return 'cyan'; }
    getDescription(): string { return 'Shows total number of registered hooks'; }
    getDisplayName(): string { return 'Hooks Count'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '41' : ' 41';
        }

        const hooks = countHooks();
        if (hooks.total === 0) {
            return null;
        }

        const formatted = `${hooks.total}`;
        return item.rawValue ? formatted : ` ${formatted}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

export class HooksStatusWidget implements Widget {
    getDefaultColor(): string { return 'brightGreen'; }
    getDescription(): string { return 'Shows hooks health status indicator'; }
    getDisplayName(): string { return 'Hooks Status'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '✓' : ' ✓';
        }

        const hooks = countHooks();
        if (hooks.total === 0) {
            return item.rawValue ? '○' : ' ○';
        }

        // Check if hooks are healthy (file exists and has content)
        const indicator = hooks.total > 0 ? '✓' : '○';
        return item.rawValue ? indicator : ` ${indicator}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

export class HooksBreakdownWidget implements Widget {
    getDefaultColor(): string { return 'gray'; }
    getDescription(): string { return 'Shows hooks breakdown by event type (compact)'; }
    getDisplayName(): string { return 'Hooks Breakdown'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? 'S:4 Pre:7 Post:6' : ' S:4 Pre:7 Post:6';
        }

        const hooks = countHooks();
        if (hooks.total === 0) {
            return null;
        }

        // Build compact breakdown
        const parts: string[] = [];
        if (hooks.byEvent.SessionStart)
            parts.push(`S:${hooks.byEvent.SessionStart}`);
        if (hooks.byEvent.PreToolUse)
            parts.push(`Pre:${hooks.byEvent.PreToolUse}`);
        if (hooks.byEvent.PostToolUse)
            parts.push(`Post:${hooks.byEvent.PostToolUse}`);

        if (parts.length === 0) {
            return null;
        }

        const formatted = parts.join(' ');
        return item.rawValue ? formatted : ` ${formatted}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}