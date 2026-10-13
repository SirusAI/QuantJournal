"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
    date: Date | undefined;
    setDate: (date: Date | undefined) => void;
    label?: string;
    className?: string;
    highlightedDates?: Date[];
    highlightedDateLabel?: string;
}

export function DatePicker({
    date,
    setDate,
    label,
    className,
    highlightedDates = [],
    highlightedDateLabel,
}: DatePickerProps) {
    const [open, setOpen] = React.useState(false);
    const highlightedDateKeys = React.useMemo(
        () => new Set(highlightedDates.map((highlightedDate) => format(highlightedDate, "yyyy-MM-dd"))),
        [highlightedDates]
    );
    const hasHighlightedDates = highlightedDateKeys.size > 0;

    // Wrapper to handle undefined selection and date-only conversion
    const handleSelect = (selectedDate: Date | undefined) => {
        setDate(selectedDate);
        setOpen(false); // Close popover on selection
    };

    return (
        <div className={cn("grid gap-2", className)}>
            {label && <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{label}</label>}
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn(
                            "w-full justify-start text-left font-normal bg-gray-900 border-gray-600 hover:bg-gray-800 hover:text-white",
                            !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : <span>Pick a date</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-gray-800 border-gray-700 text-white" align="start">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={handleSelect}
                        initialFocus
                        className="p-3"
                        modifiers={hasHighlightedDates ? {
                            savedReview: (day) => highlightedDateKeys.has(format(day, "yyyy-MM-dd")),
                        } : undefined}
                        classNames={{
                            day_selected: "bg-green-600 text-white hover:bg-green-600 hover:text-white focus:bg-green-600 focus:text-white",
                            day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-gray-700 rounded-md",
                            day_today: "bg-gray-700 text-white",
                            head_cell: "text-gray-400 font-normal text-[0.8rem]",
                            caption_label: "font-medium text-white",
                            nav_button: "border-gray-600 hover:bg-gray-700 hover:text-white",
                            table: "w-full border-collapse space-y-1",
                        }}
                    />
                    {hasHighlightedDates && highlightedDateLabel && (
                        <div className="border-t border-gray-700/80 px-4 py-3 text-xs text-gray-300">
                            <span className="inline-flex items-center gap-2">
                                <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_0_3px_rgba(56,189,248,0.18)]" />
                                {highlightedDateLabel}
                            </span>
                        </div>
                    )}
                </PopoverContent>
            </Popover>
        </div>
    );
}
