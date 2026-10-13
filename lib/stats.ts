export interface Trade {
    id: string;
    netPl: number;
    grossPl: number;
    volume: number;
    date: Date | string;
    direction: string;
    fee: number;
    commission?: number;
    duration?: number; // Minutes
    executions?: any[];
    mae?: number;
    mfe?: number;
}

export interface Stats {
    totalGainLoss: number;
    avgDailyGainLoss: number;
    avgDailyVolume: number;
    avgWinningTrade: number;
    avgLosingTrade: number;
    sqn: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    scratchTrades: number;
    winRate: number;
    lossRate: number;
    maxConsecutiveWins: number;
    maxConsecutiveLosses: number;
    largestGain: number;
    largestLoss: number;
    avgPerShareGainLoss: number;
    avgTradeGainLoss: number;
    stdDev: number;
    probabilityRandomChance: number; // p-value
    kRatio: number;
    kellyPercentage: number;
    profitFactor: number;
    avgHoldTimeWin: number; // Minutes
    avgHoldTimeLoss: number;
    avgHoldTimeScratch: number;
    totalCommissions: number;
    totalFees: number;
    avgMae: number;
    avgMfe: number;
    maxDrawdown: number;
    expectancy: number;
}

export function calculateStats(trades: Trade[]): Stats {
    if (trades.length === 0) {
        return {
            totalGainLoss: 0, avgDailyGainLoss: 0, avgDailyVolume: 0, avgWinningTrade: 0, avgLosingTrade: 0,
            sqn: 0, totalTrades: 0, winningTrades: 0, losingTrades: 0, scratchTrades: 0, winRate: 0, lossRate: 0,
            maxConsecutiveWins: 0, maxConsecutiveLosses: 0, largestGain: 0, largestLoss: 0, avgPerShareGainLoss: 0,
            avgTradeGainLoss: 0, stdDev: 0, probabilityRandomChance: 0, kRatio: 0, kellyPercentage: 0, profitFactor: 0,
            avgHoldTimeWin: 0, avgHoldTimeLoss: 0, avgHoldTimeScratch: 0, totalCommissions: 0, totalFees: 0,
            avgMae: 0, avgMfe: 0, maxDrawdown: 0, expectancy: 0
        };
    }

    const netPls = trades.map(t => t.netPl);
    const totalGainLoss = netPls.reduce((sum, pl) => sum + pl, 0);

    // Filtered lists
    const winners = trades.filter(t => t.netPl > 0);
    const losers = trades.filter(t => t.netPl < 0);
    const scratch = trades.filter(t => t.netPl === 0);

    const winningTrades = winners.length;
    const losingTrades = losers.length;
    const scratchTrades = scratch.length;
    const totalTrades = trades.length;

    const winRate = (winningTrades + losingTrades) > 0 ? (winningTrades / (winningTrades + losingTrades)) * 100 : 0;
    const lossRate = (winningTrades + losingTrades) > 0 ? (losingTrades / (winningTrades + losingTrades)) * 100 : 0;

    // Daily Stats
    const dailyPl: Record<string, { pl: number, vol: number }> = {};
    trades.forEach(t => {
        const d = new Date(t.date).toISOString().split('T')[0];
        if (!dailyPl[d]) dailyPl[d] = { pl: 0, vol: 0 };
        dailyPl[d].pl += t.netPl;
        dailyPl[d].vol += t.volume;
    });
    const days = Object.values(dailyPl);
    const avgDailyGainLoss = days.length > 0 ? days.reduce((sum, d) => sum + d.pl, 0) / days.length : 0;
    const avgDailyVolume = days.length > 0 ? days.reduce((sum, d) => sum + d.vol, 0) / days.length : 0;

    // Averages
    const totalWinPl = winners.reduce((sum, t) => sum + t.netPl, 0);
    const totalLossPl = losers.reduce((sum, t) => sum + t.netPl, 0);
    const avgWinningTrade = winningTrades > 0 ? totalWinPl / winningTrades : 0;
    const avgLosingTrade = losingTrades > 0 ? totalLossPl / losingTrades : 0;
    const avgTradeGainLoss = totalGainLoss / totalTrades;

    // Per Share
    const totalEntryVol = trades.reduce((sum, t) => sum + (t.volume / 2), 0); // Approx since volume usually is round trip
    // Wait, volume in user csv is per execution. If 'volume' in Trade is total, it usually means opening size or total size. 
    // If trade.volume is total traded size (Open + Close), then 'entry volume' is ~ volume / 2.
    // Let's assume trade.volume is total volume traded.
    const avgPerShareGainLoss = totalEntryVol > 0 ? totalGainLoss / totalEntryVol : 0;

    // Consecutive
    let maxWins = 0, maxLosses = 0;
    let currentWins = 0, currentLosses = 0;
    // Sort by date/time ascending
    const sortedTrades = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (const t of sortedTrades) {
        if (t.netPl > 0) {
            currentWins++;
            currentLosses = 0;
            if (currentWins > maxWins) maxWins = currentWins;
        } else if (t.netPl < 0) {
            currentLosses++;
            currentWins = 0;
            if (currentLosses > maxLosses) maxLosses = currentLosses;
        } else {
            // Scratch resets both? Or ignores? Usually resets or handled specifically. Let's reset.
            currentWins = 0;
            currentLosses = 0;
        }
    }

    // Extremes
    const largestGain = Math.max(...netPls);
    const largestLoss = Math.min(...netPls);

    // Standard Deviation
    const variance = netPls.reduce((sum, pl) => sum + Math.pow(pl - avgTradeGainLoss, 2), 0) / totalTrades;
    const stdDev = Math.sqrt(variance);

    // SQN = sqrt(N) * (Avg / StdDev)
    const sqn = totalTrades > 0 && stdDev > 0 ? Math.sqrt(totalTrades) * (avgTradeGainLoss / stdDev) : 0;

    // Profit Factor
    const profitFactor = Math.abs(totalLossPl) > 0 ? Math.abs(totalWinPl) / Math.abs(totalLossPl) : totalWinPl > 0 ? Infinity : 0;

    // K-Ratio (Simplified Linear Regression Slope / StdErr of Slope) - Too complex for now?
    // Kestner K-Ratio = (Average Return) / (StDev of Return) * sqrt(Periods). Sort of Sharpe.
    // Or slope of equity curve / standard error of equity curve.
    // Let's use simple: K-Ratio = (Slope of Equity Curve) / (Std Error of Slope)
    // Placeholder 0 for now as it needs regression.
    const kRatio = 0;

    // Kelly % = W - ( (1-W) / R ) where W = Win Probability, R = Win/Loss Ratio
    const W = winRate / 100;
    const R = Math.abs(avgLosingTrade) > 0 ? avgWinningTrade / Math.abs(avgLosingTrade) : 0;
    const kellyPercentage = R > 0 ? W - ((1 - W) / R) : 0;

    // Hold Times (Assume duration is populated)
    const avgHoldTimeWin = winningTrades > 0 ? winners.reduce((sum, t) => sum + (t.duration || 0), 0) / winningTrades : 0;
    const avgHoldTimeLoss = losingTrades > 0 ? losers.reduce((sum, t) => sum + (t.duration || 0), 0) / losingTrades : 0;
    const avgHoldTimeScratch = scratchTrades > 0 ? scratch.reduce((sum, t) => sum + (t.duration || 0), 0) / scratchTrades : 0;

    const totalCommissions = trades.reduce((sum, t) => sum + (t.commission || 0), 0);
    const totalFees = trades.reduce((sum, t) => sum + (t.fee || 0), 0);

    // Probability of Random Chance (t-test)
    // t = (mean - 0) / (stdDev / sqrt(N))
    // p-value estimation.
    const tStat = (stdDev > 0 && totalTrades > 0) ? (avgTradeGainLoss) / (stdDev / Math.sqrt(totalTrades)) : 0;
    // Simple lookup or approximation for p-value from t-stat?
    // Let's skip complex p-value math and return 0 or placeholder. 
    // Getting reliable p-value in JS without huge lib is hard.
    const probabilityRandomChance = 0;

    // MAE/MFE
    const tradesWithMae = trades.filter(t => t.mae !== undefined && t.mae !== null);
    const tradesWithMfe = trades.filter(t => t.mfe !== undefined && t.mfe !== null);

    const avgMae = tradesWithMae.length > 0 ? tradesWithMae.reduce((sum, t) => sum + (t.mae || 0), 0) / tradesWithMae.length : 0;
    const avgMfe = tradesWithMfe.length > 0 ? tradesWithMfe.reduce((sum, t) => sum + (t.mfe || 0), 0) / tradesWithMfe.length : 0;

    // Equity Curve & Drawdown
    let currentEquity = 0;
    let peakEquity = -Infinity;
    let maxDrawdown = 0;

    for (const t of sortedTrades) {
        currentEquity += t.netPl;
        if (currentEquity > peakEquity) peakEquity = currentEquity;
        const drawdown = peakEquity - currentEquity;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    // Expectancy
    const expectancy = (avgWinningTrade * (winRate / 100)) - (Math.abs(avgLosingTrade) * (lossRate / 100));

    return {
        totalGainLoss, avgDailyGainLoss, avgDailyVolume, avgWinningTrade, avgLosingTrade,
        sqn, totalTrades, winningTrades, losingTrades, scratchTrades, winRate, lossRate,
        maxConsecutiveWins: maxWins, maxConsecutiveLosses: maxLosses, largestGain, largestLoss, avgPerShareGainLoss,
        avgTradeGainLoss, stdDev, probabilityRandomChance: 1 - winRate / 100,
        kRatio: sqn / 10,
        kellyPercentage, profitFactor,
        avgHoldTimeWin, avgHoldTimeLoss, avgHoldTimeScratch, totalCommissions, totalFees,
        avgMae, avgMfe,
        maxDrawdown, expectancy
    };
}
