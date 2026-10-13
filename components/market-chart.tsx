"use client";

import { createChart, ColorType, CrosshairMode, IChartApi, ISeriesApi } from 'lightweight-charts';
import { memo, useEffect, useRef } from 'react';

interface MarketChartProps {
    data: { time: number; open: number; high: number; low: number; close: number }[];
    trades?: { time: number; side: string; price: number }[]; // For markers
}

const EMPTY_TRADES: NonNullable<MarketChartProps['trades']> = [];

function MarketChart({ data, trades = EMPTY_TRADES }: MarketChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const handleResize = () => {
            chartRef.current?.applyOptions({ width: chartContainerRef.current?.clientWidth || 0 });
        };

        /**
         * Robustly converts a UTC timestamp to a "fake" UTC timestamp 
         * that represents the Eastern Time components.
         */
        const etFormatter = new Intl.DateTimeFormat('en-US', {
            year: 'numeric', month: 'numeric', day: 'numeric',
            hour: 'numeric', minute: 'numeric', second: 'numeric',
            hour12: false, timeZone: 'America/New_York'
        });
        const adjustToET = (utcSeconds: number) => {
            const date = new Date(utcSeconds * 1000);

            const etSegments = etFormatter.formatToParts(date);

            const getPart = (type: string) => etSegments.find(p => p.type === type)?.value;

            const year = parseInt(getPart('year')!);
            const month = parseInt(getPart('month')!) - 1;
            const day = parseInt(getPart('day')!);
            const hour = parseInt(getPart('hour')!);
            const minute = parseInt(getPart('minute')!);
            const second = parseInt(getPart('second')!);

            const etAsUtcEpoch = Date.UTC(year, month, day, hour, minute, second);
            return etAsUtcEpoch / 1000;
        };

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#111827' }, // Gray-900 matching dashboard
                textColor: '#D1D5DB', // Gray-300
            },
            grid: {
                vertLines: { color: '#374151' },
                horzLines: { color: '#374151' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 300,
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
            },
            localization: {
                timeFormatter: (time: number) => {
                    const date = new Date(time * 1000);
                    return date.getUTCHours().toString().padStart(2, '0') + ':' +
                        date.getUTCMinutes().toString().padStart(2, '0');
                }
            }
        });

        chartRef.current = chart;

        // Add Extended Hours Background Shading
        const bgSeries = chart.addHistogramSeries({
            priceScaleId: 'bg',
            priceFormat: { type: 'custom', minMove: 0.01, formatter: () => '' },
            color: 'rgba(255, 255, 255, 0.08)',
        });

        chart.priceScale('bg').applyOptions({
            scaleMargins: { top: 0, bottom: 0 },
            borderVisible: false,
        });

        if (data.length > 0) {
            const bgData = data
                .map(c => {
                    const adjustedTime = adjustToET(c.time);
                    const date = new Date(adjustedTime * 1000);
                    const hour = date.getUTCHours();
                    const minute = date.getUTCMinutes();
                    const tradeTime = hour * 60 + minute;

                    // 9:30 AM = 570 mins, 4:00 PM = 960 mins
                    const isExtended = tradeTime < 570 || tradeTime >= 960;

                    if (isExtended) {
                        return { time: adjustedTime as any, value: 1 };
                    }
                    return null;
                })
                .filter(d => d !== null)
                .sort((a, b) => (a!.time as number) - (b!.time as number));

            bgSeries.setData(bgData as any);
        }

        const candlestickSeries = chart.addCandlestickSeries({
            upColor: '#22c55e', // Tailwind green-500
            downColor: '#ef4444', // Tailwind red-500
            borderVisible: false,
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
        });

        // Sort data by time just in case
        const sortedData = [...data]
            .map(c => ({ ...c, time: adjustToET(c.time) as any }))
            .sort((a, b) => a.time - b.time);
        // Lightweight charts expects Unix timestamp (seconds) or YYYY-MM-DD
        // Our mock data is Unix Seconds.

        candlestickSeries.setData(sortedData);

        // Add Markers for Trades
        const markers: any[] = trades.map(t => {
            const isBuy = t.side === 'BUY' || t.side === 'B' || t.side === 'Buy';
            return {
                time: adjustToET(t.time),
                position: isBuy ? 'belowBar' : 'aboveBar',
                color: isBuy ? '#22c55e' : '#ef4444',
                shape: isBuy ? 'arrowUp' : 'arrowDown',
                text: t.side + ' @ ' + t.price,
            };
        });

        candlestickSeries.setMarkers(markers);

        chart.timeScale().fitContent();

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [data, trades]);

    return <div ref={chartContainerRef} className="w-full h-full" />;
}

// Server refreshes recreate arrays even when only a trade's tags changed.
// Compare chart values so these refreshes preserve the chart and its viewport.
export default memo(MarketChart, (previous, next) => {
    const previousTrades = previous.trades ?? EMPTY_TRADES;
    const nextTrades = next.trades ?? EMPTY_TRADES;
    return (previous.data === next.data || (
        previous.data.length === next.data.length && previous.data.every((bar, index) => {
            const other = next.data[index];
            return bar.time === other.time && bar.open === other.open && bar.high === other.high &&
                bar.low === other.low && bar.close === other.close;
        })
    )) && (previousTrades === nextTrades || (
        previousTrades.length === nextTrades.length && previousTrades.every((trade, index) => {
            const other = nextTrades[index];
            return trade.time === other.time && trade.side === other.side && trade.price === other.price;
        })
    ));
});
