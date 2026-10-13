"use client";

import { createChart, ColorType, SeriesMarker, Time, LineStyle } from 'lightweight-charts';
import React, { useEffect, useRef } from 'react';

export function CumulativePnlChart({ data }: { data: { time: string, value: number }[] }) {
    const chartContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!chartContainerRef.current) return;
        if (data.length === 0) return;

        const chart = createChart(chartContainerRef.current, {
            localization: { locale: "en-US" },
            layout: {
                background: { type: ColorType.Solid, color: '#1f2937' }, // gray-800
                textColor: '#9CA3AF', // gray-400
            },
            width: chartContainerRef.current.clientWidth,
            height: 400,
            grid: {
                vertLines: { color: '#374151' }, // gray-700
                horzLines: { color: '#374151' },
            },
            timeScale: {
                borderVisible: false,
                timeVisible: true,
            },
            leftPriceScale: {
                visible: true,
                borderVisible: false,
            },
            rightPriceScale: {
                visible: false,
            }
        });

        const baselineSeries = chart.addBaselineSeries({
            priceScaleId: 'left',
            baseValue: { type: 'price', price: 0 },
            topLineColor: '#22c55e', // green-500
            topFillColor1: 'rgba(34, 197, 94, 0.4)',
            topFillColor2: 'rgba(34, 197, 94, 0.05)',
            bottomLineColor: '#ef4444', // red-500
            bottomFillColor1: 'rgba(239, 68, 68, 0.05)',
            bottomFillColor2: 'rgba(239, 68, 68, 0.4)',
            lineWidth: 3,
            crosshairMarkerVisible: true,
            lastValueVisible: false,
            priceLineVisible: false,
        });

        // Add a prominent white line at the 0 level
        baselineSeries.createPriceLine({
            price: 0,
            color: '#FFFFFF',
            lineWidth: 1,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: false,
            title: '',
        });

        // Ensure data is sorted by time ascending and unique
        const uniqueDataMap = new Map();
        [...data]
            .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
            .forEach(item => uniqueDataMap.set(item.time, item.value));

        const sortedUniqueData = Array.from(uniqueDataMap.entries()).map(([time, value]) => ({
            time: time as Time,
            value: value as number
        }));

        baselineSeries.setData(sortedUniqueData);

        // Add markers for each data point
        const markers: SeriesMarker<Time>[] = sortedUniqueData.map(item => ({
            time: item.time,
            position: 'inBar',
            color: item.value >= 0 ? '#22c55e' : '#ef4444',
            shape: 'circle',
            size: 0.5,
        }));
        baselineSeries.setMarkers(markers);

        chart.timeScale().fitContent();

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [data]);

    return (
        <div ref={chartContainerRef} className="w-full h-full" />
    );
}
