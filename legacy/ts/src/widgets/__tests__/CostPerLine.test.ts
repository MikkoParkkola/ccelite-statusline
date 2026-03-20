import * as child_process from 'node:child_process';
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
import { CostPerLineWidget } from '../CostPerLine';

vi.mock('node:fs', () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn()
}));

vi.mock('node:child_process', () => ({ execSync: vi.fn() }));

function renderWithCostAndLines(
    totalCostUsd: number,
    linesAdded: number,
    linesRemoved: number,
    rawValue = false
) {
    const widget = new CostPerLineWidget();
    const context: RenderContext = {
        data: {
            cost: {
                total_cost_usd: totalCostUsd,
                total_lines_added: linesAdded,
                total_lines_removed: linesRemoved
            }
        }
    };
    const item: WidgetItem = {
        id: 'cost-per-line',
        type: 'cost-per-line',
        rawValue
    };

    return widget.render(item, context, DEFAULT_SETTINGS);
}

function renderPreview(rawValue = false) {
    const widget = new CostPerLineWidget();
    const context: RenderContext = { isPreview: true };
    const item: WidgetItem = {
        id: 'cost-per-line',
        type: 'cost-per-line',
        rawValue
    };

    return widget.render(item, context, DEFAULT_SETTINGS);
}

function renderNoCost(rawValue = false) {
    const widget = new CostPerLineWidget();
    const context: RenderContext = {};
    const item: WidgetItem = {
        id: 'cost-per-line',
        type: 'cost-per-line',
        rawValue
    };

    return widget.render(item, context, DEFAULT_SETTINGS);
}

describe('CostPerLineWidget', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('preview mode', () => {
        it('should render preview', () => {
            expect(renderPreview()).toBe('$0.023/line');
        });

        it('should render preview with raw value', () => {
            expect(renderPreview(true)).toBe('0.023');
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

    describe('threshold indicators', () => {
        it('should show green for efficient cost (<$0.01/line)', () => {
            // $1 / 200 lines = $0.005/line
            const result = renderWithCostAndLines(1, 100, 100);
            expect(result).toBe('🟢 $0.005/line');
        });

        it('should show yellow for moderate cost ($0.01-$0.05/line)', () => {
            // $2 / 100 lines = $0.020/line
            const result = renderWithCostAndLines(2, 50, 50);
            expect(result).toBe('🟡 $0.020/line');
        });

        it('should show red for expensive cost (>=$0.05/line)', () => {
            // $5 / 50 lines = $0.100/line
            const result = renderWithCostAndLines(5, 25, 25);
            expect(result).toBe('🔴 $0.100/line');
        });

        it('should show yellow at exactly $0.01/line', () => {
            // $1 / 100 lines = $0.010/line
            const result = renderWithCostAndLines(1, 50, 50);
            expect(result).toBe('🟡 $0.010/line');
        });

        it('should show red at exactly $0.05/line', () => {
            // $5 / 100 lines = $0.050/line
            const result = renderWithCostAndLines(5, 50, 50);
            expect(result).toBe('🔴 $0.050/line');
        });
    });

    describe('raw value mode', () => {
        it('should render cost only without indicator', () => {
            const result = renderWithCostAndLines(1, 100, 100, true);
            expect(result).toBe('0.005');
        });
    });

    describe('zero lines changed', () => {
        it('should render dash when no lines changed', () => {
            const widget = new CostPerLineWidget();
            const context: RenderContext = {
                data: {
                    cost: {
                        total_cost_usd: 5,
                        total_lines_added: 0,
                        total_lines_removed: 0
                    }
                }
            };
            const item: WidgetItem = {
                id: 'cost-per-line',
                type: 'cost-per-line'
            };

            expect(widget.render(item, context, DEFAULT_SETTINGS)).toBe('—');
        });
    });

    describe('git diff fallback', () => {
        it('should use git diff when no lines metadata', () => {
            (child_process.execSync as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
                ' 3 files changed, 15 insertions(+), 7 deletions(-)\n'
            );

            const widget = new CostPerLineWidget();
            const context: RenderContext = {
                data: {
                    cost: { total_cost_usd: 0.22 },
                    cwd: '/some/project'
                }
            };
            const item: WidgetItem = {
                id: 'cost-per-line',
                type: 'cost-per-line'
            };

            // $0.22 / 22 lines = $0.010/line
            const result = widget.render(item, context, DEFAULT_SETTINGS);
            expect(result).toBe('🟡 $0.010/line');
        });

        it('should use workspace.current_dir for git diff', () => {
            (child_process.execSync as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
                ' 1 file changed, 10 insertions(+)\n'
            );

            const widget = new CostPerLineWidget();
            const context: RenderContext = {
                data: {
                    cost: { total_cost_usd: 0.05 },
                    workspace: { current_dir: '/some/workspace' }
                }
            };
            const item: WidgetItem = {
                id: 'cost-per-line',
                type: 'cost-per-line'
            };

            // $0.05 / 10 lines = $0.005/line
            const result = widget.render(item, context, DEFAULT_SETTINGS);
            expect(result).toBe('🟢 $0.005/line');
        });

        it('should render dash when git diff fails', () => {
            (child_process.execSync as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
                throw new Error('not a git repo');
            });

            const widget = new CostPerLineWidget();
            const context: RenderContext = {
                data: {
                    cost: { total_cost_usd: 5 },
                    cwd: '/not/a/repo'
                }
            };
            const item: WidgetItem = {
                id: 'cost-per-line',
                type: 'cost-per-line'
            };

            expect(widget.render(item, context, DEFAULT_SETTINGS)).toBe('—');
        });
    });

    describe('cost from session file fallback', () => {
        it('should read cost from .session_roi.json when no context cost', () => {
            (fs.existsSync as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
            (fs.readFileSync as unknown as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify({ cost: 2 }));

            const widget = new CostPerLineWidget();
            const context: RenderContext = {
                data: {
                    cost: {
                        total_lines_added: 100,
                        total_lines_removed: 100
                    }
                }
            };
            const item: WidgetItem = {
                id: 'cost-per-line',
                type: 'cost-per-line'
            };

            // $2 / 200 lines = $0.010/line
            const result = widget.render(item, context, DEFAULT_SETTINGS);
            expect(result).toBe('🟡 $0.010/line');
        });
    });

    describe('widget metadata', () => {
        it('should have correct default color', () => {
            const widget = new CostPerLineWidget();
            expect(widget.getDefaultColor()).toBe('green');
        });

        it('should support raw values', () => {
            const widget = new CostPerLineWidget();
            expect(widget.supportsRawValue()).toBe(true);
        });

        it('should support colors', () => {
            const widget = new CostPerLineWidget();
            const item: WidgetItem = { id: 'cost-per-line', type: 'cost-per-line' };
            expect(widget.supportsColors(item)).toBe(true);
        });
    });
});