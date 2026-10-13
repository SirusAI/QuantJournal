"use client";
import { useJournal } from "@/components/journal-runtime";

import { useState } from "react";
import { useRouter } from "@/components/journal-runtime";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowUpCircle, ArrowDownCircle, Trash2 } from "lucide-react";
import { Link } from "@/components/journal-runtime";
import { cn } from "@/lib/utils";
import { DeleteTradeButton } from "@/components/delete-trade-button";

import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { X, Plus, Search, Calendar as CalendarIcon } from "lucide-react";
import { DatePicker } from "@/components/date-picker";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { useMemo } from "react";

interface TradesTableProps {
    trades: any[];
}


export function TradesTable({ trades }: TradesTableProps) {
 const client = useJournal();
 const { addTagToTrade, removeTagFromTrade, addTagToTrades } = client;

    const router = useRouter();
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchSymbol, setSearchSymbol] = useState("");
    const [filterDate, setFilterDate] = useState<string | null>(null);
    const itemsPerPage = 25;

    const filteredTrades = useMemo(() => {
        let filtered = trades;

        if (searchSymbol) {
            filtered = filtered.filter(t =>
                t.symbol.toLowerCase().includes(searchSymbol.toLowerCase())
            );
        }

        if (filterDate) {
            filtered = filtered.filter(t => {
                const tradeDate = new Date(t.date).toISOString().split('T')[0];
                return tradeDate === filterDate;
            });
        }

        return filtered;
    }, [trades, searchSymbol, filterDate]);

    const totalPages = Math.ceil(filteredTrades.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedTrades = filteredTrades.slice(startIndex, startIndex + itemsPerPage);

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredTrades.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredTrades.map(t => t.id));
        }
    };

    const toggleSelect = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(sid => sid !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedIds.length} trades?`)) return;
        setLoading(true);

        try {
            const res = await client.deleteTrades(selectedIds);

            if (res.ok) {
                setSelectedIds([]);
                router.refresh();
            } else {
                alert("Failed to delete trades");
            }
        } catch (e) {
            console.error(e);
            alert("Error deleting trades");
        } finally {
            setLoading(false);
        }
    };

    const handleBulkAddTag = async (tag: string) => {
        setLoading(true);
        await addTagToTrades(selectedIds, tag);
        setSelectedIds([]);
        router.refresh();
        setLoading(false);
    };

    const handleRemoveTag = async (tradeId: string, tagId: string) => {
        await removeTagFromTrade(tradeId, tagId);
        router.refresh();
    };

    const formatPnl = (pnl: number) => {
        const sign = pnl >= 0 ? '+' : '-';
        const formatted = Math.abs(pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `${sign}$${formatted}`;
    };

    const clearFilters = () => {
        setSearchSymbol("");
        setFilterDate(null);
    };

    return (
        <div className="space-y-4 text-white">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2 border-b border-gray-800 pb-4">
                <div className="flex items-center gap-3">
                    <div className="relative w-48">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <Input
                            placeholder="Search Ticker..."
                            value={searchSymbol}
                            onChange={(e) => setSearchSymbol(e.target.value)}
                            className="bg-gray-800 border-gray-700 pl-9 text-white focus:ring-sky-500 h-9 text-xs"
                        />
                    </div>
                    <div className="w-48">
                        <DatePicker
                            date={filterDate ? new Date(filterDate + "T00:00:00") : undefined}
                            setDate={(d) => setFilterDate(d ? format(d, "yyyy-MM-dd") : null)}
                        />
                    </div>
                    {(searchSymbol || filterDate) && (
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="text-gray-400 hover:text-white h-9 px-2">
                            Clear
                        </Button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {selectedIds.length > 0 && (
                        <div className="flex items-center gap-2 p-1.5 bg-red-900/20 rounded border border-red-900/50">
                            <span className="text-xs text-red-200 font-bold px-2">{selectedIds.length} selected</span>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleBulkDelete}
                                disabled={loading}
                                className="h-7 text-[10px] uppercase font-bold"
                            >
                                <Trash2 className="w-3.5 h-3.5 mr-1" />
                                Delete
                            </Button>
                            <Select onValueChange={handleBulkAddTag} disabled={loading}>
                                <SelectTrigger className="h-7 text-[10px] bg-emerald-900/40 border-emerald-800 text-emerald-200">
                                    <div className="flex items-center gap-1">
                                        <Plus className="w-3 h-3" />
                                        <span>Add Tag</span>
                                    </div>
                                </SelectTrigger>
                                <SelectContent position="popper" className="bg-gray-800 border-gray-700 text-white">
                                    {Array.from(new Set<string>(trades.flatMap(t => t.tags?.map((tag: { name: string }) => tag.name) ?? []))).map(tag => (
                                        <SelectItem key={tag} value={tag} className="text-xs">{tag}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
            </div>

            <div className="rounded-md border border-gray-700 bg-gray-800 shadow-xl overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="border-gray-700 hover:bg-transparent bg-gray-900/50">
                            <TableHead className="w-[40px]" suppressHydrationWarning>
                                <Checkbox
                                    checked={filteredTrades.length > 0 && selectedIds.length === filteredTrades.length}
                                    onCheckedChange={toggleSelectAll}
                                    aria-label="Select all"
                                    className="border-gray-500"
                                />
                            </TableHead>
                            <TableHead className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">Date</TableHead>
                            <TableHead className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">Symbol</TableHead>
                            <TableHead className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">Side</TableHead>
                            <TableHead className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">Entry Price</TableHead>
                            <TableHead className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">Exit Price</TableHead>
                            <TableHead className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">Executions</TableHead>
                            <TableHead className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">Volume</TableHead>
                            <TableHead className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">P / L</TableHead>
                            <TableHead className="text-gray-500 text-[10px] font-bold uppercase tracking-wider w-[200px]">Tags</TableHead>
                            <TableHead className="text-gray-500 text-[10px] font-bold uppercase tracking-wider text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedTrades.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={11} className="text-center py-20 text-gray-500 italic">
                                    No trades found.
                                </TableCell>
                            </TableRow>
                        )}
                        {paginatedTrades.map((trade) => {
                            const pnl = Number(trade.netPl);
                            const isWin = pnl > 0;
                            const isLoss = pnl < 0;
                            const isLong = trade.direction === "LONG";
                            const isSelected = selectedIds.includes(trade.id);
                            const volume = trade.volume;

                            const sortedExecs = [...(trade.executions || [])].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
                            const entryPrice = sortedExecs.length > 0 ? sortedExecs[0].price : 0;
                            const exitPrice = sortedExecs.length > 1 ? sortedExecs[sortedExecs.length - 1].price : (sortedExecs.length === 1 ? sortedExecs[0].price : 0);

                            return (
                                <TableRow key={trade.id} className={cn("border-gray-700 hover:bg-gray-700/50 transition", isSelected && "bg-gray-700/30")}>
                                    <TableCell suppressHydrationWarning>
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => toggleSelect(trade.id)}
                                            aria-label={`Select trade ${trade.symbol}`}
                                            className="border-gray-500"
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium whitespace-nowrap text-zinc-300">
                                        {new Date(trade.date).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="font-bold text-white">{trade.symbol}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center space-x-2">
                                            {isLong ? (
                                                <ArrowUpCircle className="w-4 h-4 text-green-500" />
                                            ) : (
                                                <ArrowDownCircle className="w-4 h-4 text-red-500" />
                                            )}
                                            <span className={cn(
                                                "text-[10px] font-black tracking-tight px-1.5 py-0.5 rounded",
                                                isLong ? "text-green-500/80" : "text-red-500/80"
                                            )}>
                                                {trade.direction}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-zinc-300">${entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="text-zinc-300">${exitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="text-zinc-400">{trade._count?.executions || 0}</TableCell>
                                    <TableCell className="text-zinc-300 font-mono text-xs">{volume.toLocaleString()}</TableCell>
                                    <TableCell className={cn(
                                        "font-bold",
                                        isWin ? "text-green-500" : isLoss ? "text-red-500" : "text-gray-400"
                                    )}>
                                        {formatPnl(pnl)}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-2">

                                            <div className="flex flex-wrap gap-1">
                                                {trade.tags?.map((tag: any) => (
                                                    <Badge key={tag.id} variant="secondary" className="px-1 py-0 h-5 text-[10px] bg-gray-700 text-zinc-300 hover:bg-gray-600 gap-1 pr-0.5 group">
                                                        {tag.name}
                                                        <button
                                                            onClick={() => handleRemoveTag(trade.id, tag.id)}
                                                            className="hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                                                        >
                                                            <X className="w-2.5 h-2.5" />
                                                        </button>
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right flex justify-end gap-2">
                                        <Button asChild variant="ghost" size="sm" className="h-8 hover:bg-gray-700 text-sky-400 font-bold text-xs">
                                            <Link href={`/journal/${trade.id}`}>View Details</Link>
                                        </Button>
                                        <DeleteTradeButton id={trade.id} />
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            <div className="flex justify-end pt-2">
                <div className="flex items-center gap-4 bg-gray-800 p-1.5 rounded-lg border border-gray-700 shadow-lg">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="h-8 px-3 hover:bg-gray-700 disabled:opacity-20 text-xs font-bold"
                    >
                        Prev
                    </Button>
                    <span className="text-xs font-bold text-gray-500 px-2 border-x border-gray-700">
                        Page <span className="text-white">{currentPage}</span> of {totalPages || 1}
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="h-8 px-3 hover:bg-gray-700 disabled:opacity-20 text-xs font-bold"
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
}
