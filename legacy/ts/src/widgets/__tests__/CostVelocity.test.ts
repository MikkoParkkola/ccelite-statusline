import * as fs from 'node:fs';
import {
    beforeEach,
    describe,
    expect,
    it,
    vi
} from 'vitest';

import type {
    RenderContext,
    WidgetItem
} from '../../types';
import { DEFAULT_SETTINGS } from '../../types/Settings';
import { CostVelocityWidget } from '../CostVelocity';

vi.mock('node:fs', () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn()
}));

function renderWithCostAndDuration(
    totalCostUsd: number,
    durationMs: number,
    rawValue = false
) {
    const widget = new CostVelocityWidget();
    const context: RenderContext = {
        data: {
            cost: {
                total_cost_usd: totalCostUsd,
                total_duration_ms: durationMs
            }
        }
    };
    const item: WidgetItem = {
        id: 'cost-velocity',
        type: 'cost-velocity',
        rawValue
    };

    return widget.render(item, context, DEFAULT_SETTINGS);
}

function renderWithSessionStart(
    totalCostUsd: number,
    startedAt: string,
    rawValue = false
) {
    const widget = new CostVelocityWidget();
    const context: RenderContext = {
        data: {
            cost: { total_cost_usd: totalCostUsd },
            session: { started_at: startedAt }
        } as RenderContext['data']
    };
    const item: WidgetItem = {
        id: 'cost-velocity',
        type: 'cost-velocity',
        rawValue
    };

    return widget.render(item, context, DEFAULT_SETTINGS);
}

function renderWithSessionDuration(
    totalCostUsd: number,
    sessionDuration: string,
    rawValue = false
) {
    const widget = new CostVelocityWidget();
    const context: RenderContext = {
        data: { cost: { total_cost_usd: totalCostUsd } },
        sessionDuration
    };
    const item: WidgetItem = {
        id: 'cost-velocity',
        type: 'cost-velocity',
        rawValue
    };

    return widget.render(item, context, DEFAULT_SETTINGS);
}

function renderPreview(rawValue = false) {
    const widget = new CostVelocityWidget();
    const context: RenderContext = { isPreview: true };
    const item: WidgetItem = {
        id: 'cost-velocity',
        type: 'cost-velocity',
        rawValue
    };

    return widget.render(item, context, DEFAULT_SETTINGS);
}

function renderNoCost(rawValue = false) {
    const widget = new CostVelocityWidget();
    const context: RenderContext = {};
    const item: WidgetItem = {
        id: 'cost-velocity',
        type: 'cost-velocity',
        rawValue
    };

    return widget.render(item, context, DEFAULT_SETTINGS);
}

describe('CostVelocityWidget', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('preview mode', () => {
        it('should render preview', () => {
            expect(renderPreview()).toBe('$4.20/hr');
        });

        it('should render preview with raw value', () => {
            expect(renderPreview(true)).toBe('4.20');
        });
    });

    describe('no data available', () => {
        it('should return null when no cost data', () => {
            expect(renderNoCost()).toBeNull();
        });

        it('should return dash with raw value when no cost data', () => {
            expect(renderNoCost(true)).toBe('—');
        });
    });

    describe('cost with total_duration_ms', () => {
        it('should calculate rate from cost and duration_ms', () => {
            // $5 over 1 hour (3600000 ms) = $5.00/hr
            const result = renderWithCostAndDuration(5, 3600000);
            expect(result).toBe('🔴 $5.00/hr');
        });

        it('should show green for low rate (<$3/hr)', () => {
            // $1 over 1 hour = $1.00/hr
            const result = renderWithCostAndDuration(1, 3600000);
            expect(result).toBe('🟢 $1.00/hr');
        });

        it('should show yellow for medium rate ($3-5/hr)', () => {
            // $4 over 1 hour = $4.00/hr
            const result = renderWithCostAndDuration(4, 3600000);
            expect(result).toBe('🟡 $4.00/hr');
        });

        it('should show red for high rate (>=$5/hr)', () => {
            // $10 over 1 hour = $10.00/hr
            const result = renderWithCostAndDuration(10, 3600000);
            expect(result).toBe('🔴 $10.00/hr');
        });

        it('should return raw value when rawValue is true', () => {
            const result = renderWithCostAndDuration(5, 3600000, true);
            expect(result).toBe('5.00');
        });
    });

    describe('cost with sessionDuration string', () => {
        it('should parse hours and minutes', () => {
            // $6 over 2h = $3.00/hr
            const result = renderWithSessionDuration(6, '2h0m');
            expect(result).toBe('🟡 $3.00/hr');
        });

        it('should parse days, hours, and minutes', () => {
            // $240 over 1d0h0m (24h) = $10.00/hr
            const result = renderWithSessionDuration(240, '1d0h0m');
            expect(result).toBe('🔴 $10.00/hr');
        });

        it('should parse minutes only', () => {
            // $1 over 30m (0.5h) = $2.00/hr
            const result = renderWithSessionDuration(1, '30m');
            expect(result).toBe('🟢 $2.00/hr');
        });
    });

    describe('cost from session file fallback', () => {
        it('should read cost from .session_roi.json when no context cost', () => {
            (fs.existsSync as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
            (fs.readFileSync as unknown as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify({ cost: 3 }));

            const widget = new CostVelocityWidget();
            const context: RenderContext = { data: { cost: { total_duration_ms: 3600000 } } };
            const item: WidgetItem = {
                id: 'cost-velocity',
                type: 'cost-velocity'
            };

            const result = widget.render(item, context, DEFAULT_SETTINGS);
            expect(result).toBe('🟡 $3.00/hr');
        });
    });

    describe('edge cases', () => {
        it('should return null when cost exists but no duration', () => {
            const widget = new CostVelocityWidget();
            const context: RenderContext = { data: { cost: { total_cost_usd: 5 } } };
            const item: WidgetItem = {
                id: 'cost-velocity',
                type: 'cost-velocity'
            };

            expect(widget.render(item, context, DEFAULT_SETTINGS)).toBeNull();
        });

        it('should return null when duration is zero', () => {
            expect(renderWithCostAndDuration(5, 0)).toBeNull();
        });
    });

    describe('widget metadata', () => {
        it('should have correct default color', () => {
            const widget = new CostVelocityWidget();
            expect(widget.getDefaultColor()).toBe('green');
        });

        it('should support raw values', () => {
            const widget = new CostVelocityWidget();
            expect(widget.supportsRawValue()).toBe(true);
        });

        it('should support colors', () => {
            const widget = new CostVelocityWidget();
            const item: WidgetItem = { id: 'cost-velocity', type: 'cost-velocity' };
            expect(widget.supportsColors(item)).toBe(true);
        });
    });
});