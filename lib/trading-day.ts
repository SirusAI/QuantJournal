export const NEW_YORK_TIME_ZONE = "America/New_York";

type DateTimePart = "year" | "month" | "day" | "hour" | "minute" | "second";

function getDateTimeParts(date: Date, timeZone: string): Record<DateTimePart, string> {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });

    const parts = formatter.formatToParts(date);

    return {
        year: parts.find((part) => part.type === "year")?.value ?? "0000",
        month: parts.find((part) => part.type === "month")?.value ?? "00",
        day: parts.find((part) => part.type === "day")?.value ?? "00",
        hour: parts.find((part) => part.type === "hour")?.value ?? "00",
        minute: parts.find((part) => part.type === "minute")?.value ?? "00",
        second: parts.find((part) => part.type === "second")?.value ?? "00",
    };
}

export function isValidDateKey(value: string | null | undefined): value is string {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function addDaysToDateKey(dateKey: string, days: number): string {
    const [year, month, day] = dateKey.split("-").map(Number);
    const nextDate = new Date(Date.UTC(year, month - 1, day + days));
    const nextYear = String(nextDate.getUTCFullYear());
    const nextMonth = String(nextDate.getUTCMonth() + 1).padStart(2, "0");
    const nextDay = String(nextDate.getUTCDate()).padStart(2, "0");
    return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function getDateKeyInTimeZone(date: Date, timeZone = NEW_YORK_TIME_ZONE): string {
    const parts = getDateTimeParts(date, timeZone);
    return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getTimeZoneOffset(dateKey: string, timeString: string, timeZone = NEW_YORK_TIME_ZONE): string {
    const referenceDate = new Date(`${dateKey}T${timeString}Z`);
    const timeZoneParts = getDateTimeParts(referenceDate, timeZone);
    const tzMinutes = (Number(timeZoneParts.hour) * 60) + Number(timeZoneParts.minute);
    const utcMinutes = (referenceDate.getUTCHours() * 60) + referenceDate.getUTCMinutes();

    let offsetMinutes = tzMinutes - utcMinutes;
    if (offsetMinutes > 720) offsetMinutes -= 1440;
    if (offsetMinutes < -720) offsetMinutes += 1440;

    const sign = offsetMinutes >= 0 ? "+" : "-";
    const absoluteMinutes = Math.abs(offsetMinutes);
    const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, "0");
    const minutes = String(absoluteMinutes % 60).padStart(2, "0");

    return `${sign}${hours}:${minutes}`;
}

export function getDayBoundsInTimeZone(dateKey: string, timeZone = NEW_YORK_TIME_ZONE): { start: Date; end: Date } {
    const nextDateKey = addDaysToDateKey(dateKey, 1);
    const startOffset = getTimeZoneOffset(dateKey, "00:00:00", timeZone);
    const endOffset = getTimeZoneOffset(nextDateKey, "00:00:00", timeZone);

    return {
        start: new Date(`${dateKey}T00:00:00${startOffset}`),
        end: new Date(`${nextDateKey}T00:00:00${endOffset}`),
    };
}

export function getNewYorkDayKey(date: Date): string {
    return getDateKeyInTimeZone(date, NEW_YORK_TIME_ZONE);
}

export function getNewYorkDayBounds(dateKey: string): { start: Date; end: Date } {
    return getDayBoundsInTimeZone(dateKey, NEW_YORK_TIME_ZONE);
}

export function formatTimeInTimeZone(date: Date, timeZone = NEW_YORK_TIME_ZONE): string {
    const parts = getDateTimeParts(date, timeZone);
    return `${parts.hour}:${parts.minute}:${parts.second}`;
}

export function formatDateForDisplay(dateKey: string): string {
    return new Date(`${dateKey}T12:00:00Z`).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: NEW_YORK_TIME_ZONE,
    });
}

export function getMinutesSinceMidnightInTimeZone(date: Date, timeZone = NEW_YORK_TIME_ZONE): number {
    const parts = getDateTimeParts(date, timeZone);
    return (Number(parts.hour) * 60) + Number(parts.minute);
}

export function getMinutesSinceMarketOpen(date: Date, timeZone = NEW_YORK_TIME_ZONE): number {
    return getMinutesSinceMidnightInTimeZone(date, timeZone) - ((9 * 60) + 30);
}
