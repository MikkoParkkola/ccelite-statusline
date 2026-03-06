import { z } from 'zod';

export const StatusJSONSchema = z.looseObject({
    hook_event_name: z.string().optional(),
    session_id: z.string().optional(),
    transcript_path: z.string().optional(),
    cwd: z.string().optional(),
    model: z.object({
        id: z.string().optional(),
        display_name: z.string().optional()
    }).optional(),
    workspace: z.object({
        current_dir: z.string().optional(),
        project_dir: z.string().optional()
    }).optional(),
    version: z.string().optional(),
    output_style: z.object({ name: z.string().optional() }).optional(),
    cost: z.object({
        total_cost_usd: z.number().optional(),
        total_duration_ms: z.number().optional(),
        total_api_duration_ms: z.number().optional(),
        total_lines_added: z.number().optional(),
        total_lines_removed: z.number().optional()
    }).optional(),
    // Added in v2.1.6 (2026-01-13)
    context_window: z.object({
        used_percentage: z.number().optional(),
        remaining_percentage: z.number().optional()
    }).optional(),
    // Quota/usage fields (check if provided by Claude Code)
    usage: z.object({
        five_hour_utilization: z.number().optional(),
        seven_day_utilization: z.number().optional(),
        five_hour_resets_at: z.string().optional(),
        seven_day_resets_at: z.string().optional()
    }).optional()
});

export type StatusJSON = z.infer<typeof StatusJSONSchema>;