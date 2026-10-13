"use client";

import { useEffect, useState } from "react";
import { TradeDetailView } from "@/components/trade-detail-view";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface TradeDetailItemProps {
    trade: any;
}

export function TradeDetailItem({ trade }: TradeDetailItemProps) {
    const [chartData, setChartData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadChart() {
            try {
                const data: never[] = [];
                setChartData(data || []);
            } catch (error) {
                console.error("Failed to fetch chart data:", error);
            } finally {
                setIsLoading(false);
            }
        }
        loadChart();
    }, [trade.symbol, trade.date]);

    if (isLoading) {
        return (
            <Card className="bg-gray-800 border-gray-700 p-20 flex items-center justify-center text-white min-h-[600px]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-yellow-500" />
                    <p className="text-gray-400 font-medium">Loading trade details for {trade.symbol}...</p>
                </div>
            </Card>
        );
    }

    return (
        <div className="border-b border-gray-800 pb-16 last:border-0 last:pb-0">
            <TradeDetailView trade={trade} chartData={chartData} isListItem={true} />
        </div>
    );
}
