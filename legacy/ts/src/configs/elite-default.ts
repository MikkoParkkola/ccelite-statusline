/**
 * ELITE Default Configuration v20 "Bulletproof"
 *
 * 3-line MINIMAL design using ONLY widgets that NEVER fail:
 * - custom-text, disk-space, cpu, memory, load (OS calls)
 * - git-branch, git-changes, git-worktree (git calls)
 * - hooks-count, mcp-count (config file reads)
 *
 * NO widgets that depend on Claude Code input JSON!
 */

import type { Settings } from '../types/Settings';

export const ELITE_DEFAULT_CONFIG: Settings = {
    version: 3,
    lines: [
        // Line 1: IDENTITY + SYSTEM (guaranteed from OS)
        [
            { id: 'L1-1', type: 'custom-text', customText: '◆ ELITE', color: 'hex:f9e2af', backgroundColor: 'hex:11111b', bold: true },
            { id: 'L1-2', type: 'disk-space', color: 'hex:89dceb', backgroundColor: 'hex:181825' },
            { id: 'L1-3', type: 'cpu', color: 'hex:fab387', backgroundColor: 'hex:1e1e2e' },
            { id: 'L1-4', type: 'memory-percent', color: 'hex:f5c2e7', backgroundColor: 'hex:313244' },
            { id: 'L1-5', type: 'load-average', color: 'hex:bac2de', backgroundColor: 'hex:45475a' }
        ],
        // Line 2: GIT (guaranteed from git commands)
        [
            { id: 'L2-1', type: 'custom-text', customText: '⚡ Git', color: 'hex:fab387', backgroundColor: 'hex:11111b' },
            { id: 'L2-2', type: 'git-branch', color: 'hex:fab387', backgroundColor: 'hex:181825' },
            { id: 'L2-3', type: 'git-changes', color: 'hex:f38ba8', backgroundColor: 'hex:1e1e2e' },
            { id: 'L2-4', type: 'git-worktree', color: 'hex:f9e2af', backgroundColor: 'hex:313244' },
            { id: 'L2-5', type: 'custom-text', customText: '🚀', color: 'hex:a6e3a1', backgroundColor: 'hex:45475a' }
        ],
        // Line 3: INFRA (guaranteed from config files)
        [
            { id: 'L3-1', type: 'custom-text', customText: '🔧 Infra', color: 'hex:89dceb', backgroundColor: 'hex:11111b' },
            { id: 'L3-2', type: 'hooks-count', color: 'hex:89dceb', backgroundColor: 'hex:181825' },
            { id: 'L3-3', type: 'hooks-status', color: 'hex:a6e3a1', backgroundColor: 'hex:1e1e2e' },
            { id: 'L3-4', type: 'mcp-count', color: 'hex:b4befe', backgroundColor: 'hex:313244' },
            { id: 'L3-5', type: 'mcp-status', color: 'hex:a6e3a1', backgroundColor: 'hex:45475a' }
        ]
    ],
    flexMode: 'full',
    compactThreshold: 50,
    colorLevel: 3,
    defaultSeparator: '',
    defaultPadding: ' ',
    inheritSeparatorColors: true,
    globalBold: false,
    powerline: {
        enabled: true,
        theme: '',
        separators: [''],
        separatorInvertBackground: [true],
        startCaps: [''],
        endCaps: [''],
        autoAlign: false
    }
};