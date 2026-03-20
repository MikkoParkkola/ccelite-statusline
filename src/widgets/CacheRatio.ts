import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';

export class CacheRatioWidget implements Widget {
    getDefaultColor(): string { return 'cyan'; }
    getDescription(): string { return 'Shows cache hit ratio: cached tokens as a percentage of input tokens'; }
    getDisplayName(): string { return 'Cache Ratio'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '72%' : 'Cache: 72%';
        }

        if (!context.tokenMetrics) {
            return item.rawValue ? '—' : 'Cache: —';
        }

        const { cachedTokens, inputTokens } = context.tokenMetrics;

        if (inputTokens <= 0) {
            return item.rawValue ? '—' : 'Cache: —';
        }

        const ratio = (cachedTokens / inputTokens) * 100;
        const rounded = Math.round(ratio);

        // Threshold indicator: green >=60%, yellow >=30%, red <30%
        let indicator = '';
        if (ratio >= 60) {
            indicator = '🟢';
        } else if (ratio >= 30) {
            indicator = '🟡';
        } else {
            indicator = '🔴';
        }

        if (item.rawValue) {
            return `${rounded}%`;
        }
        return `${indicator} Cache: ${rounded}%`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}