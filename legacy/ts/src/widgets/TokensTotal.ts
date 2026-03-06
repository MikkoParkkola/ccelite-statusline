import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { formatTokens } from '../utils/renderer';

export class TokensTotalWidget implements Widget {
    getDefaultColor(): string { return 'cyan'; }
    getDescription(): string { return 'Shows total token count (input + output + cache) for the current session'; }
    getDisplayName(): string { return 'Tokens Total'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? '30.6K tok' : 'Total: 30.6K tok';
        } else if (context.tokenMetrics) {
            const tokens = formatTokens(context.tokenMetrics.totalTokens);
            return item.rawValue ? `${tokens} tok` : `Total: ${tokens} tok`;
        }
        return item.rawValue ? '—' : 'Total: —';
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}