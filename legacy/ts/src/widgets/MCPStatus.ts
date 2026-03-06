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

interface MCPServer {
    command: string;
    args?: string[];
}

interface ClaudeSettings {
    mcpServers?: Record<string, MCPServer>;
}

function countMCPServers(): { count: number; names: string[] } {
    try {
        const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
        if (!fs.existsSync(settingsPath)) {
            return { count: 0, names: [] };
        }

        const content = fs.readFileSync(settingsPath, 'utf-8');
        const settings = JSON.parse(content) as ClaudeSettings;

        if (!settings.mcpServers) {
            return { count: 0, names: [] };
        }

        const names = Object.keys(settings.mcpServers);
        return { count: names.length, names };
    } catch {
        return { count: 0, names: [] };
    }
}

export class MCPCountWidget implements Widget {
    getDefaultColor(): string { return 'blue'; }
    getDescription(): string { return 'Shows number of configured MCP servers'; }
    getDisplayName(): string { return 'MCP Servers'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '12' : '󰒋 12';
        }

        const mcp = countMCPServers();
        if (mcp.count === 0) {
            return null;
        }

        const formatted = `${mcp.count}`;
        return item.rawValue ? formatted : `󰒋 ${formatted}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

export class MCPStatusWidget implements Widget {
    getDefaultColor(): string { return 'brightBlue'; }
    getDescription(): string { return 'Shows MCP servers status indicator'; }
    getDisplayName(): string { return 'MCP Status'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '12 ✓' : '󰒋 12 ✓';
        }

        const mcp = countMCPServers();
        if (mcp.count === 0) {
            return item.rawValue ? '0' : '󰒋 0';
        }

        const formatted = `${mcp.count} ✓`;
        return item.rawValue ? formatted : `󰒋 ${formatted}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

export class MCPNamesWidget implements Widget {
    getDefaultColor(): string { return 'gray'; }
    getDescription(): string { return 'Shows MCP server names (truncated list)'; }
    getDisplayName(): string { return 'MCP Names'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? 'seq,pcs,srv' : '󰒋 seq,pcs,srv';
        }

        const mcp = countMCPServers();
        if (mcp.count === 0) {
            return null;
        }

        // Abbreviate names: take first 3 chars of each, max 5 servers
        const abbrevNames = mcp.names
            .slice(0, 5)
            .map(n => n.slice(0, 3).toLowerCase())
            .join(',');

        const suffix = mcp.count > 5 ? '+' : '';
        const formatted = `${abbrevNames}${suffix}`;
        return item.rawValue ? formatted : `󰒋 ${formatted}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
