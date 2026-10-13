"use client";

import { lazyClient as dynamic } from "@/components/journal-runtime";

const MarketChart = dynamic(() => import('@/components/market-chart'), {
    ssr: false,
    loading: () => <div className="h-full w-full flex items-center justify-center text-gray-500">Loading Chart...</div>
});

export function MarketChartWrapper(props: any) {
    return <MarketChart {...props} />;
}
