import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPnlSpecial } from "@/lib/utils";
import { Stats } from "@/lib/stats";

interface StatsGridProps {
    stats: Stats;
}

export function StatsGrid({ stats }: StatsGridProps) {
    const Row = ({ label, value, subtext }: { label: string, value: string | number, subtext?: string }) => (
        <div className="flex items-center justify-between py-3 border-b border-gray-700 last:border-0">
            <span className="text-zinc-400 font-medium">{label}</span>
            <div className="text-right">
                <span className="text-white font-bold block">{value}</span>
                {subtext && <span className="text-xs text-zinc-500 block">{subtext}</span>}
            </div>
        </div>
    );

    return (
        <Card className="bg-gray-800 border-gray-700 text-white">
            <CardHeader className="border-b border-gray-700">
                <CardTitle>Detailed Statistics</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-700">
                    {/* Column 1 */}
                    <div className="p-6 space-y-1">
                        <Row label="Total Gain/Loss" value={formatPnlSpecial(stats.totalGainLoss)} />
                        <Row label="Average Daily Gain/Loss" value={formatPnlSpecial(stats.avgDailyGainLoss)} />
                        <Row label="Average Trade Gain/Loss" value={formatPnlSpecial(stats.avgTradeGainLoss)} />
                        <Row label="Total Number of Trades" value={stats.totalTrades} />
                        <Row label="Average Hold Time (scratch)" value={`${stats.avgHoldTimeScratch.toFixed(1)}m`} />
                        <Row label="Number of Scratch Trades" value={stats.scratchTrades} />
                        <Row label="Trade P&L Std Dev" value={formatCurrency(stats.stdDev)} />
                        <Row label="Kelly Percentage" value={`${(stats.kellyPercentage * 100).toFixed(1)}%`} />
                        <Row label="Total Commissions" value={formatCurrency(stats.totalCommissions)} />
                        <Row label="Average Position MAE" value={formatPnlSpecial(-stats.avgMae)} />
                    </div>
                    {/* Column 2 */}
                    <div className="p-6 space-y-1">
                        <Row label="Largest Gain" value={formatPnlSpecial(stats.largestGain)} />
                        <Row label="Average Daily Volume" value={stats.avgDailyVolume.toLocaleString()} />
                        <Row label="Average Winning Trade" value={formatPnlSpecial(stats.avgWinningTrade)} />
                        <Row label="Number of Winning Trades" value={`${stats.winningTrades} (${stats.winRate.toFixed(1)}%)`} />
                        <Row label="Average Hold Time (winning)" value={`${stats.avgHoldTimeWin.toFixed(1)}m`} />
                        <Row label="Max Consecutive Wins" value={stats.maxConsecutiveWins} />
                        <Row label="System Quality Number (SQN)" value={stats.sqn.toFixed(2)} />
                        <Row label="K-Ratio" value={stats.kRatio.toFixed(2)} />
                        <Row label="Total Fees" value={formatCurrency(stats.totalFees)} />
                        <Row label="Average Position MFE" value={formatPnlSpecial(stats.avgMfe)} />
                    </div>
                    {/* Column 3 */}
                    <div className="p-6 space-y-1">
                        <Row label="Largest Loss" value={formatPnlSpecial(stats.largestLoss)} />
                        <Row label="Avg Per-Share Gain/Loss" value={formatPnlSpecial(stats.avgPerShareGainLoss)} />
                        <Row label="Average Losing Trade" value={formatPnlSpecial(stats.avgLosingTrade)} />
                        <Row label="Number of Losing Trades" value={`${stats.losingTrades} (${stats.lossRate.toFixed(1)}%)`} />
                        <Row label="Average Hold Time (losing)" value={`${stats.avgHoldTimeLoss.toFixed(1)}m`} />
                        <Row label="Max Consecutive Losses" value={stats.maxConsecutiveLosses} />
                        <Row label="Probability of Random Chance" value={`${(stats.probabilityRandomChance * 100).toFixed(2)}%`} />
                        <Row label="Profit Factor" value={stats.profitFactor.toFixed(2)} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
