import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    CustomKeybind,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { getContextConfig } from '../utils/model-context';

export class ContextPercentageUsableWidget implements Widget {
    getDefaultColor(): string { return 'green'; }
    getDescription(): string { return 'Shows percentage of usable context window used or remaining (80% of max before auto-compact)'; }
    getDisplayName(): string { return 'Context % (usable)'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        const isInverse = item.metadata?.inverse === 'true';
        const modifiers: string[] = [];

        if (isInverse) {
            modifiers.push('remaining');
        }

        return {
            displayText: this.getDisplayName(),
            modifierText: modifiers.length > 0 ? `(${modifiers.join(', ')})` : undefined
        };
    }

    handleEditorAction(action: string, item: WidgetItem): WidgetItem | null {
        if (action === 'toggle-inverse') {
            const currentState = item.metadata?.inverse === 'true';
            return {
                ...item,
                metadata: {
                    ...item.metadata,
                    inverse: (!currentState).toString()
                }
            };
        }
        return null;
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        const isInverse = item.metadata?.inverse === 'true';

        if (context.isPreview) {
            // Compact preview: integer + warning indicator
            const previewValue = isInverse ? '12%' : '88%⚠️';
            return item.rawValue ? previewValue : `📊 ${previewValue}`;
        } else if (context.tokenMetrics) {
            const modelId = context.data?.model?.id;
            const contextConfig = getContextConfig(modelId);
            const usedPercentage = Math.min(100, (context.tokenMetrics.contextLength / contextConfig.usableTokens) * 100);
            const displayPercentage = isInverse ? (100 - usedPercentage) : usedPercentage;

            // Compact display: integer % + warning indicator based on thresholds
            // For "to limit" mode (isInverse=false): high % = danger
            // For "safe" mode (isInverse=true): low % = danger
            const roundedPct = Math.round(displayPercentage);
            let indicator = '';

            if (isInverse) {
                // Safe mode: low % = bad (running out of space)
                if (displayPercentage < 10) indicator = '🔴';
                else if (displayPercentage < 20) indicator = '⚠️';
            } else {
                // To limit mode: high % = bad (approaching limit)
                if (displayPercentage > 90) indicator = '🔴';
                else if (displayPercentage > 75) indicator = '⚠️';
            }

            return item.rawValue ? `${roundedPct}%${indicator}` : `📊 ${roundedPct}%${indicator}`;
        }
        // Return placeholder when no data available
        return item.rawValue ? '—' : '📊 —';
    }

    getCustomKeybinds(): CustomKeybind[] {
        return [
            { key: 'l', label: '(l)eft/remaining', action: 'toggle-inverse' }
        ];
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}