import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetItemType
} from '../types/Widget';
import * as widgets from '../widgets';

// Create widget registry
const widgetRegistry = new Map<WidgetItemType, Widget>([
    // Core widgets
    ['model', new widgets.ModelWidget()],
    ['output-style', new widgets.OutputStyleWidget()],
    ['git-branch', new widgets.GitBranchWidget()],
    ['git-changes', new widgets.GitChangesWidget()],
    ['git-worktree', new widgets.GitWorktreeWidget()],
    ['current-working-dir', new widgets.CurrentWorkingDirWidget()],
    ['tokens-input', new widgets.TokensInputWidget()],
    ['tokens-output', new widgets.TokensOutputWidget()],
    ['tokens-cached', new widgets.TokensCachedWidget()],
    ['tokens-total', new widgets.TokensTotalWidget()],
    ['context-length', new widgets.ContextLengthWidget()],
    ['context-percentage', new widgets.ContextPercentageWidget()],
    ['context-percentage-usable', new widgets.ContextPercentageUsableWidget()],
    ['session-clock', new widgets.SessionClockWidget()],
    ['session-cost', new widgets.SessionCostWidget()],
    ['block-timer', new widgets.BlockTimerWidget()],
    ['terminal-width', new widgets.TerminalWidthWidget()],
    ['version', new widgets.VersionWidget()],
    ['custom-text', new widgets.CustomTextWidget()],
    ['custom-command', new widgets.CustomCommandWidget()],
    ['claude-session-id', new widgets.ClaudeSessionIdWidget()],

    // Elite widgets - Cost & efficiency metrics
    ['cost-velocity', new widgets.CostVelocityWidget()],
    ['cost-per-line', new widgets.CostPerLineWidget()],
    ['cache-ratio', new widgets.CacheRatioWidget()],

    // Elite widgets - ROI tracking
    ['roi', new widgets.ROIWidget()],
    ['session-npv', new widgets.SessionNPVWidget()],

    // Elite widgets - System health
    ['cpu', new widgets.CPUWidget()],
    ['memory', new widgets.MemoryWidget()],
    ['memory-percent', new widgets.MemoryPercentWidget()],
    ['load-average', new widgets.LoadAverageWidget()],

    // Elite widgets - Hooks status
    ['hooks-count', new widgets.HooksCountWidget()],
    ['hooks-status', new widgets.HooksStatusWidget()],
    ['hooks-breakdown', new widgets.HooksBreakdownWidget()],

    // Elite widgets - MCP status
    ['mcp-count', new widgets.MCPCountWidget()],
    ['mcp-status', new widgets.MCPStatusWidget()],
    ['mcp-names', new widgets.MCPNamesWidget()],

    // Elite widgets - Codex savings
    ['codex-routed', new widgets.CodexRoutedWidget()],
    ['codex-savings', new widgets.CodexSavingsWidget()],
    ['codex-tokens-saved', new widgets.CodexTokensSavedWidget()],
    ['codex-efficiency', new widgets.CodexEfficiencyWidget()],

    // Elite widgets - Elite metrics (v17.1)
    ['annual-roi', new widgets.AnnualROIWidget()],
    ['cache-hit-rate', new widgets.CacheHitRateWidget()],
    ['learning-patterns', new widgets.LearningPatternsWidget()],
    ['prediction-accuracy', new widgets.PredictionAccuracyWidget()],

    // Elite widgets - Quality metrics (v17.1)
    ['disk-space', new widgets.DiskSpaceWidget()],
    ['disk-usage-percent', new widgets.DiskUsagePercentWidget()],
    ['tests-percentage', new widgets.TestsPercentageWidget()],
    ['security-score', new widgets.SecurityScoreWidget()],
    ['tech-debt', new widgets.TechDebtWidget()],
    ['project-name', new widgets.ProjectNameWidget()],

    // 🚀 REVOLUTIONARY WIDGETS - Jaw-dropping metrics (v3.0.0)
    ['lifetime-wealth', new widgets.LifetimeWealthWidget()],
    ['time-dilation', new widgets.TimeDilationWidget()],
    ['bug-prevention', new widgets.BugPreventionWidget()],
    ['competitive-multiplier', new widgets.CompetitiveMultiplierWidget()],
    ['hourly-rate', new widgets.HourlyRateWidget()],
    ['prediction-accuracy-v2', new widgets.PredictionAccuracyWidgetV2()],
    ['streak-fire', new widgets.StreakFireWidget()],
    ['annual-run-rate', new widgets.AnnualRunRateWidget()],
    ['flow-state', new widgets.FlowStateWidget()],
    ['session-fortune', new widgets.SessionFortuneWidget()],
    ['fte-equivalence', new widgets.FTEEquivalenceWidget()],
    ['tasks-velocity', new widgets.TasksVelocityWidget()],
    ['sessions-milestone', new widgets.SessionsMilestoneWidget()],
    ['telemetry-insights', new widgets.TelemetryInsightsWidget()],
    ['keystroke-value', new widgets.KeystrokeValueWidget()],
    // NEW: 5 more revolutionary widgets
    ['neural-routing', new widgets.NeuralRoutingWidget()],
    ['learning-velocity', new widgets.LearningVelocityWidget()],
    ['context-mastery', new widgets.ContextMasteryWidget()],
    ['moonshot-progress', new widgets.MoonshotProgressWidget()],
    ['coffee-to-code', new widgets.CoffeeToCodeWidget()],
    // v3.2.0: Observability + Innovation widgets
    ['cache-health', new widgets.CacheHealthWidget()],
    ['trend-analysis', new widgets.TrendAnalysisWidget()],
    // v3.3.0: 🧠 SMART UNIFIED WIDGETS - Multiple metrics in one
    ['unified-value', new widgets.UnifiedValueWidget()],
    ['unified-productivity', new widgets.UnifiedProductivityWidget()],
    ['unified-ai-learning', new widgets.UnifiedAILearningWidget()],
    ['unified-streak', new widgets.UnifiedStreakWidget()],
    ['unified-savings', new widgets.UnifiedSavingsWidget()],
    ['unified-team', new widgets.UnifiedTeamComparisonWidget()],
    // v5.0.0: Rate limit widgets (CC 2.1.80 stdin rate_limits field)
    ['rate-5h', new widgets.Rate5hWidget()],
    ['rate-7d', new widgets.Rate7dWidget()],
    ['rate-reset', new widgets.RateResetWidget()],

    // v3.4.0: 📊 QUOTA & LIMITS WIDGETS
    ['session-quota', new widgets.SessionQuotaWidget()],
    ['weekly-quota', new widgets.WeeklyQuotaWidget()],
    ['unified-quota', new widgets.UnifiedQuotaWidget()],
    ['opus-quota', new widgets.OpusQuotaWidget()],
    ['context-usage', new widgets.ContextUsageWidget()],
    ['unified-limits', new widgets.UnifiedLimitsWidget()],
    // v3.6.1: 📊 PRACTICAL METRICS - Rate limit pace, token rate, cache savings
    ['quota-pace', new widgets.QuotaPaceWidget()],
    ['token-rate', new widgets.TokenRateWidget()],
    ['cache-savings', new widgets.CacheSavingsWidget()],
    // v3.5.0: 🎮 GAMIFICATION WIDGETS
    ['achievements', new widgets.AchievementWidget()],
    ['level-xp', new widgets.LevelXPWidget()],
    ['daily-challenge', new widgets.DailyChallengeWidget()],
    ['power-ups', new widgets.PowerUpWidget()],
    ['momentum', new widgets.MomentumWidget()],
    ['unified-game', new widgets.UnifiedGamificationWidget()],
    // v3.6.0: 📣 PERSONALIZED INSIGHTS FEED
    ['personal-feed', new widgets.PersonalizedInsightsWidget()],
    // v3.7.0: 🚀 META-INTELLIGENCE WIDGETS - Higher-order insights
    ['breakthrough-meter', new widgets.BreakthroughMeterWidget()],
    ['time-warp', new widgets.TimeWarpWidget()],
    ['evolution-vector', new widgets.EvolutionVectorWidget()],

    // v3.8.0: 💡 HELP/ONBOARDING - For novice users
    ['help-legend', new widgets.HelpLegendWidget()],

    // v3.8.1: 💰 ELITE SAVINGS - Total billable tokens saved vs normal Claude
    ['elite-savings', new widgets.EliteSavingsWidget()],

    // v3.9.0: 📊 ELITE IMPACT - Comprehensive elite framework measurement
    ['elite-cost', new widgets.EliteImpactCostWidget()],
    ['elite-value', new widgets.EliteTotalValueWidget()],
    // ['elite-compression', new widgets.EliteCompressionRatioWidget()],
    // ['elite-routing-count', new widgets.EliteRoutingCountWidget()],
    // ['elite-speedup', new widgets.EliteSpeedupWidget()],
    // ['elite-latency-saved', new widgets.EliteLatencySavedWidget()],
    // ['elite-prediction', new widgets.ElitePredictionWidget()],
    // ['elite-first-try', new widgets.EliteFirstTryWidget()],
    // ['elite-bugs', new widgets.EliteBugsPreventedWidget()],
    // ['elite-security', new widgets.EliteSecurityWidget()],
    // ['elite-patterns', new widgets.ElitePatternsWidget()],
    // ['elite-cache-hit', new widgets.EliteCacheHitWidget()],
    // ['elite-vs-baseline', new widgets.EliteVsBaselineWidget()],
    // ['elite-attribution', new widgets.EliteAttributionWidget()],
    // ['total-savings', new widgets.TotalSavingsWidget()],

    // v4.0.0: 🎯 ELITE VALUE SUMMARY - Actionable, Fresh, Concrete
    ['elite-summary', new widgets.EliteValueSummaryWidget()],
    ['elite-quick-wins', new widgets.EliteQuickWinsWidget()],
    ['elite-action', new widgets.EliteActionWidget()],
    ['elite-freshness', new widgets.EliteFreshnessWidget()],
    ['elite-staleness', new widgets.EliteStalenessWarningWidget()],
    ['elite-money-saved', new widgets.EliteMoneySavedWidget()],
    ['elite-time-saved', new widgets.EliteTimeSavedWidget()],
    ['elite-issues-blocked', new widgets.EliteIssuesBlockedWidget()],
    ['elite-success-rate', new widgets.EliteSuccessRateWidget()],
    ['elite-efficiency', new widgets.EliteEfficiencyWidget()],
    ['elite-learning', new widgets.EliteLearningWidget()],
    ['elite-cache-perf', new widgets.EliteCachePerformanceWidget()],

    // v4.1.0: 🔧 ELITE FEATURE VISIBILITY - Surface hidden innovations
    ['elite-score', new widgets.EliteScoreWidget()],
    ['circuit-health', new widgets.CircuitHealthWidget()],
    ['intelligence-level', new widgets.IntelligenceLevelWidget()]
]);

export function getWidget(type: WidgetItemType): Widget | null {
    return widgetRegistry.get(type) ?? null;
}

export function getAllWidgetTypes(settings: Settings): WidgetItemType[] {
    const allTypes = Array.from(widgetRegistry.keys());

    // Add separator types based on settings
    if (!settings.powerline.enabled) {
        if (!settings.defaultSeparator) {
            allTypes.push('separator');
        }
        allTypes.push('flex-separator');
    }

    return allTypes;
}

export function isKnownWidgetType(type: string): boolean {
    return widgetRegistry.has(type)
        || type === 'separator'
        || type === 'flex-separator';
}