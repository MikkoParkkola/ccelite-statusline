import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    CustomKeybind,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { getContextConfig } from '../utils/model-context';

export class ContextPercentageWidget implements Widget {
    getDefaultColor(): string { return 'blue'; }
    getDescription(): string { return 'Shows percentage of context window used or remaining'; }
    getDisplayName(): string { return 'Context %'; }
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
            const previewValue = isInverse ? '90.7% ctx free' : '9.3% ctx used';
            return item.rawValue ? previewValue : `📊 ${previewValue}`;
        } else if (context.tokenMetrics) {
            const modelId = context.data?.model?.id;
            const contextConfig = getContextConfig(modelId);
            const usedPercentage = Math.min(100, (context.tokenMetrics.contextLength / contextConfig.maxTokens) * 100);
            const displayPercentage = isInverse ? (100 - usedPercentage) : usedPercentage;
            // Self-documenting: "9.3% ctx used" clarifies what the percentage means
            const suffix = isInverse ? 'ctx free' : 'ctx used';
            return item.rawValue ? `${displayPercentage.toFixed(1)}% ${suffix}` : `📊 ${displayPercentage.toFixed(1)}% ${suffix}`;
        }
        // Return placeholder when no data available (better than empty)
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