# rawValue Null Returns Fix Guide

**Status**: Files corrupted by automated fix script. Manual restoration needed.

## Problem

Widgets supporting rawValue can return null, breaking statusline layout.

## Solution Pattern

### WRONG (Current)
```typescript
render(item, context, settings) {
    if (context.isPreview) {
        return item.rawValue ? 'value' : 'icon value';
    }

    const data = getData();
    if (!data) return null;  // ❌ Breaks layout in rawValue mode

    const formatted = format(data);
    return item.rawValue ? formatted : `icon ${formatted}`;
}
```

### CORRECT (Target)
```typescript
render(item, context, settings) {
    if (context.isPreview) {
        return item.rawValue ? 'value' : 'icon value';
    }

    const data = getData();

    // rawValue mode: ALWAYS return a value (never null)
    if (item.rawValue) {
        if (!data) return '—';  // ✅ Guaranteed string
        const formatted = format(data);
        return formatted;
    }

    // Full mode: can return null
    if (!data) return null;
    const formatted = format(data);
    return `icon ${formatted}`;
}
```

## Files Needing Fix

1. ✅ **ROI.ts** - FIXED (2 widgets)
2. ✅ **CodexSavings.ts** - FIXED (4 widgets)
3. ❌ **EliteImpact.ts** - CORRUPTED (13 widgets)
4. ❌ **QualityMetrics.ts** - CORRUPTED (6 widgets)
5. ❌ **EliteMetrics.ts** - CORRUPTED (4 widgets)

## Recovery Steps

### Option 1: Restore from Source
If you have the original files, restore:
- EliteImpact.ts (13 widgets)
- QualityMetrics.ts (6 widgets)
- EliteMetrics.ts (4 widgets)

### Option 2: Manual Fix
For each render() method in the corrupted files:

1. Find the pattern:
   ```typescript
   const data = getData();
   if (!data) return null;
   return item.rawValue ? formatted : `icon ${formatted}`;
   ```

2. Replace with:
   ```typescript
   const data = getData();

   // rawValue mode: ALWAYS return a value (never null)
   if (item.rawValue) {
       if (!data) return '—';
       return formatted;
   }

   // Full mode: can return null
   if (!data) return null;
   return `icon ${formatted}`;
   ```

## Verification

After fixing, verify with:
```bash
cd /Users/mikko/github/ccelite-statusline/src/widgets

for file in EliteImpact.ts QualityMetrics.ts EliteMetrics.ts ROI.ts CodexSavings.ts; do
    echo "=== $file ==="
    echo "  rawValue mode comments: $(grep -c '// rawValue mode:' $file)"
    echo "  Full mode comments: $(grep -c '// Full mode:' $file)"
    echo "  Danger: ternary at end: $(grep -c 'return item.rawValue ?' $file)"
done
```

Expected results:
- Each file should have comments equal to widget count
- "Danger: ternary at end" should be 0 for all files

## Files Status

- EliteImpact.ts: 768 lines (corrupted, was ~638)
- QualityMetrics.ts: 483 lines (corrupted, was ~423)
- EliteMetrics.ts: 381 lines (corrupted, was ~341)
- ROI.ts: ✅ CORRECT
- CodexSavings.ts: ✅ CORRECT
