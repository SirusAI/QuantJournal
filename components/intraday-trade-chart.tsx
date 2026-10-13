"use client";

import { createChart, ColorType, IChartApi, ISeriesApi, Time, LineStyle } from 'lightweight-charts';
import React, { useEffect, useRef } from 'react';

export interface Execution {
    time: string | number | Date;
    side: string;
    price: number;
    quantity: number;
}

interface IntradayTradeChartProps {
    symbol: string;
    executions: Execution[];
    candles?: { time: number; open: number; high: number; low: number; close: number }[];
}

export function IntradayTradeChart({ symbol, executions, candles }: IntradayTradeChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        /**
         * Robustly converts a UTC timestamp to a "fake" UTC timestamp 
         * that represents the Eastern Time components.
         * e.g. 21:00 UTC -> 16:00 UTC (so chart shows 16:00)
         */
        const adjustToET = (utcSeconds: number) => {
            const date = new Date(utcSeconds * 1000);

            const etSegments = new Intl.DateTimeFormat('en-US', {
                year: 'numeric', month: 'numeric', day: 'numeric',
                hour: 'numeric', minute: 'numeric', second: 'numeric',
                hour12: false, timeZone: 'America/New_York'
            }).formatToParts(date);

            const getPart = (type: string) => etSegments.find(p => p.type === type)?.value;

            // Date.UTC expects 0-indexed month
            const year = parseInt(getPart('year')!);
            const month = parseInt(getPart('month')!) - 1;
            const day = parseInt(getPart('day')!);
            const hour = parseInt(getPart('hour')!);
            const minute = parseInt(getPart('minute')!);
            const second = parseInt(getPart('second')!);

            // Construct epoch as if these were UTC components
            const etAsUtcEpoch = Date.UTC(year, month, day, hour, minute, second);
            return etAsUtcEpoch / 1000;
        };

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#111827' }, // gray-900
                textColor: '#9CA3AF',
            },
            width: chartContainerRef.current.clientWidth,
            height: 400,
            grid: {
                vertLines: { color: '#1f2937' },
                horzLines: { color: '#1f2937' },
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                borderVisible: false,
            },
            rightPriceScale: {
                borderVisible: false,
            },
            localization: {
                timeFormatter: (time: number) => {
                    // Time here is the Unix timestamp we shifted
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
            color: 'rgba(255, 255, 255, 0.08)', // Lighter background for PM/AH
        });

        chart.priceScale('bg').applyOptions({
            scaleMargins: { top: 0, bottom: 0 },
            borderVisible: false,
        });

        if (candles && candles.length > 0) {
            const bgData = candles
                .map(c => {
                    const adjustedTime = adjustToET(c.time);
                    const date = new Date(adjustedTime * 1000);
                    const hour = date.getUTCHours();
                    const minute = date.getUTCMinutes();
                    const tradeTime = hour * 60 + minute;

                    // 9:30 AM = 570 mins, 4:00 PM = 960 mins
                    const isExtended = tradeTime < 570 || tradeTime >= 960;

                    if (isExtended) {
                        return { time: adjustedTime as Time, value: 1 };
                    }
                    return null;
                })
                .filter(d => d !== null)
                .sort((a, b) => (a!.time as number) - (b!.time as number));

            bgSeries.setData(bgData as any);
        }

        let mainSeries: ISeriesApi<any>;

        if (candles && candles.length > 0) {
            mainSeries = chart.addCandlestickSeries({
                upColor: '#10b981',
                downColor: '#ef4444',
                borderVisible: false,
                wickUpColor: '#10b981',
                wickDownColor: '#ef4444',
            });
            const adjustedCandles = candles.map(c => ({
                ...c,
                time: adjustToET(c.time) as Time
            })).sort((a, b) => (a.time as number) - (b.time as number));
            mainSeries.setData(adjustedCandles);
        } else {
            mainSeries = chart.addLineSeries({
                color: '#34d399', // emerald-400
                lineWidth: 2,
                lineStyle: LineStyle.Solid,
            });

            // Fallback: Convert executions to points for the price line
            // Since we only have execution prices, we'll create a "step" line connecting them
            const data = executions
                .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
                .map(ex => ({
                    time: adjustToET(new Date(ex.time).getTime() / 1000) as Time,
                    value: Number(ex.price),
                }));
            mainSeries.setData(data);
        }

        // Add markers for Buys and Sells
        const markers = executions.map(ex => {
            const isBuy = ex.side === 'BUY' || ex.side === 'B' || ex.side === 'Buy';
            return {
                time: adjustToET(new Date(ex.time).getTime() / 1000) as Time,
                position: isBuy ? 'belowBar' : 'aboveBar' as any,
                color: isBuy ? '#10b981' : '#ef4444',
                shape: isBuy ? 'arrowUp' : 'arrowDown' as any,
                text: `${ex.side} ${ex.quantity}@${Number(ex.price).toFixed(2)}`,
            };
        });

        mainSeries.setMarkers(markers);

        chart.timeScale().fitContent();

        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [executions, candles]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white uppercase tracking-widest text-[11px]">{symbol} Execution Chart</h3>
                {!candles && <span className="text-[10px] text-zinc-500 italic">Historical data not loaded, showing execution flow only</span>}
            </div>
            <div ref={chartContainerRef} className="w-full h-[400px] rounded-lg overflow-hidden border border-gray-800 shadow-2xl" />
        </div>
    );
}
