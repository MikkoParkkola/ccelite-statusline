import * as os from 'node:os';

import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';

// ============================================================================
// Caching - System calls are expensive, cache for 5 seconds
// ============================================================================

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const systemCache = new Map<string, CacheEntry<unknown>>();
const SYSTEM_CACHE_TTL = 5000; // 5 seconds

function getCached<T>(key: string, fetcher: () => T): T {
    const now = Date.now();
    const cached = systemCache.get(key) as CacheEntry<T> | undefined;
    if (cached && (now - cached.timestamp) < SYSTEM_CACHE_TTL) {
        return cached.data;
    }
    const data = fetcher();
    systemCache.set(key, { data, timestamp: now });
    return data;
}

// ============================================================================
// System Metrics (cached)
// ============================================================================

function getCPUUsage(): number {
    return getCached('cpu', () => {
        const cpus = os.cpus();
        if (cpus.length === 0) return 0;

        let totalIdle = 0;
        let totalTick = 0;

        for (const cpu of cpus) {
            for (const type in cpu.times) {
                totalTick += cpu.times[type as keyof typeof cpu.times];
            }
            totalIdle += cpu.times.idle;
        }

        return Math.round(100 - (totalIdle / totalTick * 100));
    });
}

function getMemoryUsage(): { used: number; total: number; percentage: number } {
    return getCached('memory', () => {
        const total = os.totalmem();
        const free = os.freemem();
        const used = total - free;
        return {
            used,
            total,
            percentage: Math.round((used / total) * 100)
        };
    });
}

function formatBytes(bytes: number): string {
    if (bytes >= 1073741824) {
        return `${(bytes / 1073741824).toFixed(1)}G`;
    } else if (bytes >= 1048576) {
        return `${(bytes / 1048576).toFixed(0)}M`;
    }
    return `${(bytes / 1024).toFixed(0)}K`;
}

export class CPUWidget implements Widget {
    getDefaultColor(): string { return 'yellow'; }
    getDescription(): string { return 'Shows current CPU usage percentage'; }
    getDisplayName(): string { return 'CPU Usage'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '45%' : '󰍛 45%';
        }

        const cpu = getCPUUsage();
        const formatted = `${cpu}%`;
        return item.rawValue ? formatted : `󰍛 ${formatted}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

export class MemoryWidget implements Widget {
    getDefaultColor(): string { return 'magenta'; }
    getDescription(): string { return 'Shows current RAM usage'; }
    getDisplayName(): string { return 'Memory Usage'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '12G/32G' : '󰘚 12G/32G';
        }

        const mem = getMemoryUsage();
        const formatted = `${formatBytes(mem.used)}/${formatBytes(mem.total)}`;
        return item.rawValue ? formatted : `󰘚 ${formatted}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

export class MemoryPercentWidget implements Widget {
    getDefaultColor(): string { return 'magenta'; }
    getDescription(): string { return 'Shows RAM usage as percentage'; }
    getDisplayName(): string { return 'Memory %'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '38%' : '󰘚 38%';
        }

        const mem = getMemoryUsage();
        const formatted = `${mem.percentage}%`;
        return item.rawValue ? formatted : `󰘚 ${formatted}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

export class LoadAverageWidget implements Widget {
    getDefaultColor(): string { return 'blue'; }
    getDescription(): string { return 'Shows system load average (1m)'; }
    getDisplayName(): string { return 'Load Average'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '2.4' : '󰊚 2.4';
        }

        const loadavg = os.loadavg();
        const formatted = (loadavg[0] ?? 0).toFixed(1);
        return item.rawValue ? formatted : `󰊚 ${formatted}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}
