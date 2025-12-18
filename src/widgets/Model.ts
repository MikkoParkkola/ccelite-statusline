import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';

export class ModelWidget implements Widget {
    getDefaultColor(): string { return 'cyan'; }
    getDescription(): string { return 'Displays the Claude model name (e.g., Claude 3.5 Sonnet)'; }
    getDisplayName(): string { return 'Model'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? 'Opus 4.5' : 'Model: Opus 4.5';
        }

        // Try display_name first, then parse from id
        let modelName = context.data?.model?.display_name;
        if (!modelName && context.data?.model?.id) {
            // Parse model name from id like "claude-opus-4-5-20250929" -> "Opus 4.5"
            const id = context.data.model.id;
            if (id.includes('opus')) {
                modelName = id.includes('4-5') || id.includes('4.5') ? 'Opus 4.5' : 'Opus';
            } else if (id.includes('sonnet')) {
                modelName = id.includes('4-5') || id.includes('4.5') ? 'Sonnet 4.5' : 'Sonnet';
            } else if (id.includes('haiku')) {
                modelName = 'Haiku';
            } else {
                modelName = 'Claude';
            }
        }

        if (modelName) {
            return item.rawValue ? modelName : `Model: ${modelName}`;
        }
        // Return placeholder when no model data available
        return item.rawValue ? '—' : 'Model: —';
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}