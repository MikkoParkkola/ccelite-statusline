export { ModelWidget } from './Model';
export { OutputStyleWidget } from './OutputStyle';
export { GitBranchWidget } from './GitBranch';
export { GitChangesWidget } from './GitChanges';
export { GitWorktreeWidget } from './GitWorktree';
export { TokensInputWidget } from './TokensInput';
export { TokensOutputWidget } from './TokensOutput';
export { TokensCachedWidget } from './TokensCached';
export { TokensTotalWidget } from './TokensTotal';
export { ContextLengthWidget } from './ContextLength';
export { ContextPercentageWidget } from './ContextPercentage';
export { ContextPercentageUsableWidget } from './ContextPercentageUsable';
export { SessionClockWidget } from './SessionClock';
export { SessionCostWidget } from './SessionCost';
export { TerminalWidthWidget } from './TerminalWidth';
export { VersionWidget } from './Version';
export { CustomTextWidget } from './CustomText';
export { CustomCommandWidget } from './CustomCommand';
export { BlockTimerWidget } from './BlockTimer';
export { CurrentWorkingDirWidget } from './CurrentWorkingDir';
export { ClaudeSessionIdWidget } from './ClaudeSessionId';

// Elite widgets - Cost & efficiency metrics
export { CostVelocityWidget } from './CostVelocity';
export { CostPerLineWidget } from './CostPerLine';
export { CacheRatioWidget } from './CacheRatio';

// Elite widgets - ROI tracking
export { ROIWidget, SessionNPVWidget } from './ROI';

// Elite widgets - System health
export { CPUWidget, LoadAverageWidget, MemoryPercentWidget, MemoryWidget } from './SystemHealth';

// Elite widgets - Hooks status
export { HooksBreakdownWidget, HooksCountWidget, HooksStatusWidget } from './HooksStatus';

// Elite widgets - MCP status
export { MCPCountWidget, MCPNamesWidget, MCPStatusWidget } from './MCPStatus';

// Elite widgets - Codex savings
export { CodexEfficiencyWidget, CodexRoutedWidget, CodexSavingsWidget, CodexTokensSavedWidget } from './CodexSavings';

// Elite widgets - Elite metrics (v17.1)
export { AnnualROIWidget, CacheHitRateWidget, LearningPatternsWidget, PredictionAccuracyWidget } from './EliteMetrics';

// Elite widgets - Quality metrics (v17.1)
export { DiskSpaceWidget, DiskUsagePercentWidget, ProjectNameWidget, SecurityScoreWidget, TechDebtWidget, TestsPercentageWidget } from './QualityMetrics';

// 🚀 REVOLUTIONARY WIDGETS - Jaw-dropping metrics (v3.0.0)
export {
    // v3.5.0: 🎮 GAMIFICATION WIDGETS - 90% productivity boost [AmplifAI 2025]
    AchievementWidget,
    AnnualRunRateWidget,
    // v3.7.0: 🚀 META-INTELLIGENCE WIDGETS - Higher-order insights
    BreakthroughMeterWidget,
    BugPreventionWidget,
    // v3.2.0: Observability + Innovation widgets
    CacheHealthWidget,
    CacheSavingsWidget,           // ⚡ Elite:94% - Combined health of all elite features
    CircuitHealthWidget,
    CoffeeToCodeWidget,
    CompetitiveMultiplierWidget,
    ContextMasteryWidget,
    ContextUsageWidget,
    DailyChallengeWidget,
    // v3.8.1: 💰 ELITE SAVINGS - Total billable tokens saved
    EliteSavingsWidget,
    // v4.1.0: 🔧 ELITE FEATURE VISIBILITY - Surface hidden innovations
    EliteScoreWidget,
    EvolutionVectorWidget,
    FTEEquivalenceWidget,
    FlowStateWidget,
    // v3.8.0: 💡 HELP/ONBOARDING - For novice users
    HelpLegendWidget,
    HourlyRateWidget,
    KeystrokeValueWidget,
    LifetimeWealthWidget,
    TimeDilationWidget,
    PredictionAccuracyWidget as PredictionAccuracyWidgetV2,
    StreakFireWidget,
    SessionFortuneWidget,
    TasksVelocityWidget,
    SessionsMilestoneWidget,
    TelemetryInsightsWidget,
    // NEW: 5 more revolutionary widgets
    NeuralRoutingWidget,
    LearningVelocityWidget,
    MoonshotProgressWidget,
    TimeWarpWidget,
    TokenRateWidget,
    TrendAnalysisWidget,
    UnifiedAILearningWidget,
    UnifiedGamificationWidget,
    UnifiedLimitsWidget,
    UnifiedProductivityWidget,
    UnifiedQuotaWidget,
    UnifiedSavingsWidget,
    UnifiedStreakWidget,
    UnifiedTeamComparisonWidget,
    // v3.3.0: 🧠 SMART UNIFIED WIDGETS - Multiple metrics in one
    UnifiedValueWidget,
    // v3.4.0: 📊 QUOTA & LIMITS WIDGETS
    SessionQuotaWidget,
    WeeklyQuotaWidget,
    OpusQuotaWidget,
    // v3.6.1: 📊 PRACTICAL METRICS - Rate limit pace, token rate, cache savings
    QuotaPaceWidget,
    LevelXPWidget,
    PowerUpWidget,
    MomentumWidget,
    // v3.6.0: 📣 PERSONALIZED INSIGHTS FEED - Hyper-personalization
    PersonalizedInsightsWidget,        // 🔄 CB:34✓ - Circuit breaker status summary
    IntelligenceLevelWidget     // 🧠 L4:Neural+Cache+Learn - Active AI features
} from './RevolutionaryWidgets';

// v5.0.0: Rate limit widgets (CC 2.1.80 stdin rate_limits field)
export { Rate5hWidget, Rate7dWidget, RateResetWidget } from './RateLimits';

// v3.9.0: 📊 ELITE IMPACT - Comprehensive elite framework measurement
// 4 categories: Cost Reduction, Speed, Quality, Intelligence
export {
    EliteAttributionWidget,
    EliteBugsPreventedWidget,
    EliteCacheHitWidget,
    EliteCompressionRatioWidget,
    // Quality
    EliteFirstTryWidget,
    // Cost Reduction
    EliteImpactCostWidget,
    EliteLatencySavedWidget,
    // Intelligence
    ElitePatternsWidget,
    ElitePredictionWidget,
    EliteRoutingCountWidget,
    EliteSecurityWidget,
    // Speed
    EliteSpeedupWidget,
    EliteTotalValueWidget,
    // Comparison
    EliteVsBaselineWidget,
    TotalSavingsWidget
} from './EliteImpact';

// v4.0.0: 🎯 ELITE VALUE SUMMARY - Actionable, Fresh, Concrete
// UX Best Practices 2025: 3-second rule, progressive disclosure, freshness indicators
export {        // "🚀 Saved $2.30 + 5m + 2 bugs"

    // Actionable
    EliteActionWidget,         // "🧠 12 patterns"
    EliteCachePerformanceWidget,      // "✅ 95% 1st try"
    EliteEfficiencyWidget,           // "💡 Cache 84% - prompts are consistent"

    // Freshness
    EliteFreshnessWidget,        // "5m faster"
    EliteIssuesBlockedWidget,       // "⚡ 5→Codex | 30% smaller"

    // Intelligence
    EliteLearningWidget, // "⚠️ Data 2h old" (hidden when fresh)

    // Concrete Value
    EliteMoneySavedWidget,     // One-liner: "💎 $205 saved (3 bugs blocked) 🟢"
    EliteQuickWinsWidget,        // "🟢 now" or "🔴 2h ago"
    EliteStalenessWarningWidget,    // "🛡️ 3 issues blocked"
    EliteSuccessRateWidget,       // "$2.34 saved"
    EliteTimeSavedWidget,  // "💾 84% cache hits"
    // Primary Summary
    EliteValueSummaryWidget
} from './EliteValueSummary';