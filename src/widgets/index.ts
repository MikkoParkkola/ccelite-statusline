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

// Elite widgets - ROI tracking
export { ROIWidget, SessionNPVWidget } from './ROI';

// Elite widgets - System health
export { CPUWidget, MemoryWidget, MemoryPercentWidget, LoadAverageWidget } from './SystemHealth';

// Elite widgets - Hooks status
export { HooksCountWidget, HooksStatusWidget, HooksBreakdownWidget } from './HooksStatus';

// Elite widgets - MCP status
export { MCPCountWidget, MCPStatusWidget, MCPNamesWidget } from './MCPStatus';

// Elite widgets - Codex savings
export { CodexRoutedWidget, CodexSavingsWidget, CodexTokensSavedWidget, CodexEfficiencyWidget } from './CodexSavings';

// Elite widgets - Elite metrics (v17.1)
export { AnnualROIWidget, CacheHitRateWidget, LearningPatternsWidget, PredictionAccuracyWidget } from './EliteMetrics';

// Elite widgets - Quality metrics (v17.1)
export { DiskSpaceWidget, DiskUsagePercentWidget, TestsPercentageWidget, SecurityScoreWidget, TechDebtWidget, ProjectNameWidget } from './QualityMetrics';

// 🚀 REVOLUTIONARY WIDGETS - Jaw-dropping metrics (v3.0.0)
export {
    LifetimeWealthWidget,
    TimeDilationWidget,
    BugPreventionWidget,
    CompetitiveMultiplierWidget,
    HourlyRateWidget,
    PredictionAccuracyWidget as PredictionAccuracyWidgetV2,
    StreakFireWidget,
    AnnualRunRateWidget,
    FlowStateWidget,
    SessionFortuneWidget,
    FTEEquivalenceWidget,
    TasksVelocityWidget,
    SessionsMilestoneWidget,
    TelemetryInsightsWidget,
    KeystrokeValueWidget,
    // NEW: 5 more revolutionary widgets
    NeuralRoutingWidget,
    LearningVelocityWidget,
    ContextMasteryWidget,
    MoonshotProgressWidget,
    CoffeeToCodeWidget,
    // v3.2.0: Observability + Innovation widgets
    CacheHealthWidget,
    TrendAnalysisWidget,
    // v3.3.0: 🧠 SMART UNIFIED WIDGETS - Multiple metrics in one
    UnifiedValueWidget,
    UnifiedProductivityWidget,
    UnifiedAILearningWidget,
    UnifiedStreakWidget,
    UnifiedSavingsWidget,
    UnifiedTeamComparisonWidget,
    // v3.4.0: 📊 QUOTA & LIMITS WIDGETS
    SessionQuotaWidget,
    WeeklyQuotaWidget,
    UnifiedQuotaWidget,
    OpusQuotaWidget,
    ContextUsageWidget,
    UnifiedLimitsWidget,
    // v3.6.1: 📊 PRACTICAL METRICS - Rate limit pace, token rate, cache savings
    QuotaPaceWidget,
    TokenRateWidget,
    CacheSavingsWidget,
    // v3.5.0: 🎮 GAMIFICATION WIDGETS - 90% productivity boost [AmplifAI 2025]
    AchievementWidget,
    LevelXPWidget,
    DailyChallengeWidget,
    PowerUpWidget,
    MomentumWidget,
    UnifiedGamificationWidget,
    // v3.6.0: 📣 PERSONALIZED INSIGHTS FEED - Hyper-personalization
    PersonalizedInsightsWidget,
    // v3.7.0: 🚀 META-INTELLIGENCE WIDGETS - Higher-order insights
    BreakthroughMeterWidget,
    TimeWarpWidget,
    EvolutionVectorWidget,
    // v3.8.0: 💡 HELP/ONBOARDING - For novice users
    HelpLegendWidget,
    // v3.8.1: 💰 ELITE SAVINGS - Total billable tokens saved
    EliteSavingsWidget,
    // v4.1.0: 🔧 ELITE FEATURE VISIBILITY - Surface hidden innovations
    EliteScoreWidget,           // ⚡ Elite:94% - Combined health of all elite features
    CircuitHealthWidget,        // 🔄 CB:34✓ - Circuit breaker status summary
    IntelligenceLevelWidget     // 🧠 L4:Neural+Cache+Learn - Active AI features
} from './RevolutionaryWidgets';

// v3.9.0: 📊 ELITE IMPACT - Comprehensive elite framework measurement
// 4 categories: Cost Reduction, Speed, Quality, Intelligence
export {
    // Cost Reduction
    EliteImpactCostWidget,
    EliteTotalValueWidget,
    EliteCompressionRatioWidget,
    EliteRoutingCountWidget,
    // Speed
    EliteSpeedupWidget,
    EliteLatencySavedWidget,
    ElitePredictionWidget,
    // Quality
    EliteFirstTryWidget,
    EliteBugsPreventedWidget,
    EliteSecurityWidget,
    // Intelligence
    ElitePatternsWidget,
    EliteCacheHitWidget,
    // Comparison
    EliteVsBaselineWidget,
    EliteAttributionWidget,
    TotalSavingsWidget
} from './EliteImpact';

// v4.0.0: 🎯 ELITE VALUE SUMMARY - Actionable, Fresh, Concrete
// UX Best Practices 2025: 3-second rule, progressive disclosure, freshness indicators
export {
    // Primary Summary
    EliteValueSummaryWidget,     // One-liner: "💎 $205 saved (3 bugs blocked) 🟢"
    EliteQuickWinsWidget,        // "🚀 Saved $2.30 + 5m + 2 bugs"

    // Actionable
    EliteActionWidget,           // "💡 Cache 84% - prompts are consistent"

    // Freshness
    EliteFreshnessWidget,        // "🟢 now" or "🔴 2h ago"
    EliteStalenessWarningWidget, // "⚠️ Data 2h old" (hidden when fresh)

    // Concrete Value
    EliteMoneySavedWidget,       // "$2.34 saved"
    EliteTimeSavedWidget,        // "5m faster"
    EliteIssuesBlockedWidget,    // "🛡️ 3 issues blocked"
    EliteSuccessRateWidget,      // "✅ 95% 1st try"
    EliteEfficiencyWidget,       // "⚡ 5→Codex | 30% smaller"

    // Intelligence
    EliteLearningWidget,         // "🧠 12 patterns"
    EliteCachePerformanceWidget  // "💾 84% cache hits"
} from './EliteValueSummary';