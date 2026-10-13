"use client";
import { useJournal } from "@/components/journal-runtime";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { DateRange } from "react-day-picker";
import { startOfYear, subDays, subMonths, subYears } from "date-fns";

export type PeriodValue =
    | "1week"
    | "1month"
    | "2months"
    | "3months"
    | "6months"
    | "9months"
    | "ytd"
    | "1year"
    | "2years"
    | "3years"
    | "all"
    | "custom";

export const PERIOD_LABELS: Record<PeriodValue, string> = {
    "1week": "1 Week",
    "1month": "1 Month",
    "2months": "2 Months",
    "3months": "3 Months",
    "6months": "6 Months",
    "9months": "9 Months",
    "ytd": "YTD",
    "1year": "1 Year",
    "2years": "2 Years",
    "3years": "3 Years",
    "all": "All Time",
    "custom": "Custom",
};

interface PeriodSelectorProps {
    onSelect: (range: DateRange | undefined) => void;
    value?: PeriodValue;
    onValueChange?: (value: PeriodValue) => void;
    defaultValue?: PeriodValue;
}

function getNewYorkToday() {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "numeric",
        day: "numeric",
    }).formatToParts(new Date());

    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return new Date(Number(values.year), Number(values.month) - 1, Number(values.day));
}

export function PeriodSelector({
    onSelect,
    value,
    onValueChange,
    defaultValue,
}: PeriodSelectorProps) {
    const client = useJournal();
    const handleValueChange = (nextValue: string) => {
        const period = nextValue as PeriodValue;
        onValueChange?.(period);

        if (period === "custom") return;

        const today = client.referenceDate ? new Date(client.referenceDate + "T00:00:00") : getNewYorkToday();
        let from: Date | undefined;
        const to: Date = today;

        switch (period) {
            case "1week":
                from = subDays(today, 7);
                break;
            case "1month":
                from = subMonths(today, 1);
                break;
            case "2months":
                from = subMonths(today, 2);
                break;
            case "3months":
                from = subMonths(today, 3);
                break;
            case "6months":
                from = subMonths(today, 6);
                break;
            case "9months":
                from = subMonths(today, 9);
                break;
            case "ytd":
                from = startOfYear(today);
                break;
            case "1year":
                from = subYears(today, 1);
                break;
            case "2years":
                from = subYears(today, 2);
                break;
            case "3years":
                from = subYears(today, 3);
                break;
            case "all":
                onSelect(undefined);
                return;
            default:
                return;
        }

        if (from) {
            onSelect({ from, to });
        }
    };

    return (
        <Select
            value={value}
            defaultValue={value === undefined ? defaultValue : undefined}
            onValueChange={handleValueChange}
        >
            <SelectTrigger
                aria-label="Select report period"
                className="w-[140px] bg-gray-800 border-gray-700 text-white"
            >
                <SelectValue placeholder="Select Period" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 text-white">
                <SelectItem value="1week">1 Week</SelectItem>
                <SelectItem value="1month">1 Month</SelectItem>
                <SelectItem value="2months">2 Months</SelectItem>
                <SelectItem value="3months">3 Months</SelectItem>
                <SelectItem value="6months">6 Months</SelectItem>
                <SelectItem value="9months">9 Months</SelectItem>
                <SelectItem value="ytd">YTD</SelectItem>
                <SelectItem value="1year">1 Year</SelectItem>
                <SelectItem value="2years">2 Years</SelectItem>
                <SelectItem value="3years">3 Years</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
        </Select>
    );
}
