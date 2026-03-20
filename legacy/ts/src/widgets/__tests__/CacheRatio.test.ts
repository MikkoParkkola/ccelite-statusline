import {
    describe,
    expect,
    it
} from 'vitest';

import type {
    RenderContext,
    WidgetItem
} from '../../types';
import { DEFAULT_SETTINGS } from '../../types/Settings';
import { CacheRatioWidget } from '../CacheRatio';

function render(
    cachedTokens: number,
    inputTokens: number,
    rawValue = false
) {
    const widget = new CacheRatioWidget();
    const context: RenderContext = {
        tokenMetrics: {
            inputTokens,
            outputTokens: 0,
            cachedTokens,
            totalTokens: inputTokens,
            contextLength: 0
        }
    };
    const item: WidgetItem = {
        id: 'cache-ratio',
        type: 'cache-ratio',
        rawValue
    };

    return widget.render(item, context, DEFAULT_SETTINGS);
}

function renderNoMetrics(rawValue = false) {
    const widget = new CacheRatioWidget();
    const context: RenderContext = {};
    const item: WidgetItem = {
        id: 'cache-ratio',
        type: 'cache-ratio',
        rawValue
    };

    return widget.render(item, context, DEFAULT_SETTINGS);
}

function renderPreview(rawValue = false) {
    const widget = new CacheRatioWidget();
    const context: RenderContext = { isPreview: true };
    const item: WidgetItem = {
        id: 'cache-ratio',
        type: 'cache-ratio',
        rawValue
    };

    return widget.render(item, context, DEFAULT_SETTINGS);
}

describe('CacheRatioWidget', () => {
    describe('preview mode', () => {
        it('should render preview', () => {
            expect(renderPreview()).toBe('Cache: 72%');
        });

        it('should render preview with raw value', () => {
            expect(renderPreview(true)).toBe('72%');
        });
    });

    describe('no token metrics', () => {
        it('should render dash when no metrics available', () => {
            expect(renderNoMetrics()).toBe('Cache: —');
        });

        it('should render dash with raw value when no metrics', () => {
            expect(renderNoMetrics(true)).toBe('—');
        });
    });

    describe('zero input tokens', () => {
        it('should render dash when input tokens are zero', () => {
            expect(render(0, 0)).toBe('Cache: —');
        });

        it('should render dash with raw value when input tokens are zero', () => {
            expect(render(0, 0, true)).toBe('—');
        });
    });

    describe('threshold indicators', () => {
        it('should show green indicator for high cache ratio (>=60%)', () => {
            expect(render(72000, 100000)).toBe('🟢 Cache: 72%');
        });

        it('should show green indicator at exactly 60%', () => {
            expect(render(60000, 100000)).toBe('🟢 Cache: 60%');
        });

        it('should show yellow indicator for medium cache ratio (>=30%, <60%)', () => {
            expect(render(45000, 100000)).toBe('🟡 Cache: 45%');
        });

        it('should show yellow indicator at exactly 30%', () => {
            expect(render(30000, 100000)).toBe('🟡 Cache: 30%');
        });

        it('should show red indicator for low cache ratio (<30%)', () => {
            expect(render(10000, 100000)).toBe('🔴 Cache: 10%');
        });

        it('should show red indicator at 0% cached', () => {
            expect(render(0, 100000)).toBe('🔴 Cache: 0%');
        });
    });

    describe('raw value mode', () => {
        it('should render percentage only for high ratio', () => {
            expect(render(72000, 100000, true)).toBe('72%');
        });

        it('should render percentage only for low ratio', () => {
            expect(render(10000, 100000, true)).toBe('10%');
        });
    });

    describe('rounding', () => {
        it('should round to nearest integer', () => {
            // 33333/100000 = 33.333% -> rounds to 33%
            expect(render(33333, 100000)).toBe('🟡 Cache: 33%');
        });

        it('should round up at 0.5', () => {
            // 50500/100000 = 50.5% -> rounds to 51%
            expect(render(50500, 100000)).toBe('🟡 Cache: 51%');
        });
    });

    describe('widget metadata', () => {
        it('should have correct default color', () => {
            const widget = new CacheRatioWidget();
            expect(widget.getDefaultColor()).toBe('cyan');
        });

        it('should support raw values', () => {
            const widget = new CacheRatioWidget();
            expect(widget.supportsRawValue()).toBe(true);
        });

        it('should support colors', () => {
            const widget = new CacheRatioWidget();
            const item: WidgetItem = { id: 'cache-ratio', type: 'cache-ratio' };
            expect(widget.supportsColors(item)).toBe(true);
        });
    });
});