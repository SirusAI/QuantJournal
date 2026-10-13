"use client";
import { useJournal } from "@/components/journal-runtime";

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { MarketChartPanel } from "@/components/market-chart-panel";
import {
    ArrowUpCircle,
    ArrowDownCircle,
    ChevronLeft,
    Clock,
    DollarSign,
    Activity,
    Tag as TagIcon,
    ChevronDown,
    ChevronUp
} from "lucide-react";
import { Link } from "@/components/journal-runtime";
import { cn, formatCurrency } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Plus, X, Pencil, Check, Trash2, Settings } from "lucide-react";
import { TradeReviewForm } from "@/components/trade-review-form";
import { formatTimeInTimeZone, getNewYorkDayKey, getTimeZoneOffset } from "@/lib/trading-day";
import { EMPTY_TRADE_REVIEW } from "@/lib/trade-review";

interface TradeDetailViewProps {
    trade: any;
    chartData: any[];
    isListItem?: boolean;
}

const DEFAULT_PREDEFINED_TAGS: string[] = [];

const PREDEFINED_TAGS_STORAGE_KEY = "quantjournal-tags-v2";

export function TradeDetailView({ trade, isListItem }: TradeDetailViewProps) {
 const client = useJournal();
 const { addTagToTrade, removeTagFromTrade } = client;

    const presetStorageKey = client.mode === "demo" ? client.storageKey + ":tags" : PREDEFINED_TAGS_STORAGE_KEY;
    const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

    const [newTag, setNewTag] = useState("");
    const [isAddingTag, setIsAddingTag] = useState(false);

    // Editable predefined tags
    const [predefinedTags, setPredefinedTags] = useState<string[]>(DEFAULT_PREDEFINED_TAGS);
    const [isManagingTags, setIsManagingTags] = useState(false);
    const [newPresetTag, setNewPresetTag] = useState("");

    useEffect(() => {
        try {
            if (client.mode === "local") localStorage.removeItem("predefined-tags");
            const stored = localStorage.getItem(presetStorageKey);
            if (stored) setPredefinedTags(JSON.parse(stored));
        } catch { }
    }, []);

    const savePredefinedTags = (tags: string[]) => {
        setPredefinedTags(tags);
        localStorage.setItem(presetStorageKey, JSON.stringify(tags));
    };

    const handleAddPresetTag = () => {
        const name = newPresetTag.trim();
        if (!name || predefinedTags.includes(name)) return;
        savePredefinedTags([...predefinedTags, name]);
        setNewPresetTag("");
    };

    const handleDeletePresetTag = (tag: string) => {
        savePredefinedTags(predefinedTags.filter(t => t !== tag));
    };

    const handleAddTag = async () => {
        if (!newTag.trim()) return;
        setIsAddingTag(true);
        await addTagToTrade(trade.id, newTag);
        setNewTag("");
        setIsAddingTag(false);
    };

    const handleAddPredefinedTag = async (tag: string) => {
        setIsAddingTag(true);
        await addTagToTrade(trade.id, tag);
        setIsAddingTag(false);
    };

    const handleRemoveTag = async (tagId: string) => {
        await removeTagFromTrade(trade.id, tagId);
    };

    const netPl = Number(trade.netPl);
    const volume = trade.volume;
    const isWin = netPl > 0;
    const isLoss = netPl < 0;
    const isLong = trade.direction === "LONG";

    const formatPnl = (pnl: number) => {
        const sign = pnl >= 0 ? '+' : '-';
        const formatted = Math.abs(pnl).toLocaleString(undefined, { minimumFractionDigits: 2 });
        return `${sign}$${formatted}`;
    };

    const orderedExecutions = trade.executions.map((ex: any) => ({
        ...ex,
        quantity: ex.quantity,
        fee: Number(ex.fee)
    })).sort((a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime());


    const initialReview = {
        ...EMPTY_TRADE_REVIEW,
        ...(trade.review || {}),
        additionalNotes: trade.notes || "",
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center space-x-4">
                {!isListItem && (
                    <Link href="/trades">
                        <ChevronLeft className="w-8 h-8 text-gray-400 hover:text-white transition cursor-pointer" />
                    </Link>
                )}
                <div>
                    <h2 className="text-4xl font-extrabold tracking-tight flex items-center gap-4 text-white">
                        {trade.symbol}
                        <span className={cn(
                            "text-sm font-bold px-3 py-1 rounded-md shadow-sm uppercase tracking-wider",
                            isLong ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"
                        )}>
                            {trade.direction}
                        </span>
                    </h2>
                    {!isListItem && <p className="text-gray-400 font-medium">{new Date(trade.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>}
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2 space-y-6">
                    <Card className="bg-gray-800 border-gray-700 text-white shadow-xl overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 bg-gray-800/50">
                            <CardTitle className="text-sm font-medium flex items-center">
                                <Activity className="w-4 h-4 mr-2 text-sky-400" /> Market Data Integration
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="min-h-[450px] w-full bg-gray-900 p-4">
                                <MarketChartPanel symbol={trade.symbol} date={new Date(trade.date).toISOString().slice(0,10)} executions={trade.executions} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gray-800 border-gray-700 text-white shadow-xl overflow-hidden">
                        <CardHeader
                            className="bg-gray-800/50 cursor-pointer hover:bg-gray-700/30 transition-colors py-3"
                            onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                        >
                            <CardTitle className="text-sm font-medium flex items-center justify-between w-full">
                                <div className="flex items-center">
                                    <Clock className="w-4 h-4 mr-2 text-gray-400" /> Execution History
                                </div>
                                {isHistoryExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                            </CardTitle>
                        </CardHeader>
                        {isHistoryExpanded && (
                            <CardContent className="p-0 border-t border-gray-700/50">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-gray-700 hover:bg-transparent">
                                            <TableHead className="text-gray-400">Time</TableHead>
                                            <TableHead className="text-gray-400">Side</TableHead>
                                            <TableHead className="text-gray-400">Qty</TableHead>
                                            <TableHead className="text-gray-400">Price</TableHead>
                                            <TableHead className="text-gray-400">Fees</TableHead>
                                            <TableHead className="text-gray-400">PnL</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {trade.executions.sort((a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime()).map((ex: any) => (
                                            <ExecutionRow key={ex.id} execution={ex} />
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        )}
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="bg-gray-800 border-gray-700 text-white">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center">
                                <DollarSign className="w-4 h-4 mr-2 text-green-500" /> Performance
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className={cn(
                                "text-3xl font-bold",
                                "text-white"
                            )}>
                                <span className={isWin ? "text-green-500" : isLoss ? "text-red-500" : "text-gray-400"}>
                                    {formatPnl(netPl)}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-6">
                                <div>
                                    <p className="text-xs text-gray-400">Total Volume</p>
                                    <p className="font-semibold">{volume.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400">Executions</p>
                                    <p className="font-semibold">{trade.executions.length}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gray-800 border-gray-700 text-white flex-1 min-h-[300px]">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center">
                                <TagIcon className="w-4 h-4 mr-2 text-yellow-500" /> Trade Tags
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col h-full">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs text-gray-400">Tags</p>
                                    <button
                                        onClick={() => setIsManagingTags(!isManagingTags)}
                                        className={`p-1 rounded transition-colors ${isManagingTags ? 'text-emerald-400 bg-emerald-900/20' : 'text-gray-500 hover:text-gray-300'}`}
                                        title="Manage preset tags"
                                    >
                                        <Settings className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                {isManagingTags && (
                                    <div className="mb-4 p-3 rounded-lg bg-gray-900/80 border border-gray-700 space-y-2">
                                        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Manage Preset Tags</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {predefinedTags.map(tag => (
                                                <div key={tag} className="flex items-center gap-1 text-[10px] bg-gray-700 text-gray-300 px-2 py-0.5 rounded border border-gray-600 group/preset">
                                                    {tag}
                                                    <button
                                                        onClick={() => handleDeletePresetTag(tag)}
                                                        className="text-gray-500 hover:text-red-400 opacity-0 group-hover/preset:opacity-100 transition-opacity"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex gap-1.5">
                                            <Input
                                                value={newPresetTag}
                                                onChange={(e) => setNewPresetTag(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddPresetTag()}
                                                placeholder="New preset tag..."
                                                className="h-7 text-[11px] bg-gray-800 border-gray-600 focus:ring-emerald-500 text-white"
                                            />
                                            <Button
                                                size="sm"
                                                onClick={handleAddPresetTag}
                                                className="h-7 w-7 p-0 bg-gray-700 hover:bg-gray-600 border border-gray-600"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-2 mb-3">

                                    {trade.tags.map((tag: any) => (
                                        <div key={tag.id} className="flex items-center gap-1 text-[10px] bg-gray-700 text-gray-300 px-2 py-0.5 rounded border border-gray-600 group">
                                            {tag.name}
                                            <button
                                                onClick={() => handleRemoveTag(tag.id)}
                                                className="hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="space-y-2">
                                    <Select onValueChange={handleAddPredefinedTag}>
                                        <SelectTrigger className="h-8 text-xs bg-gray-800 border-gray-600 text-white w-full">
                                            <SelectValue placeholder="Quick Add Tag..." />
                                        </SelectTrigger>
                                        <SelectContent className="bg-gray-800 border-gray-700 text-white">
                                            {predefinedTags.filter(t => !trade.tags.some((existing: any) => existing.name === t)).map(tag => (
                                                <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                                            ))}
                                            {predefinedTags.every(t => trade.tags.some((existing: any) => existing.name === t)) && (
                                                <div className="p-2 text-xs text-gray-500 italic px-8">All presets added</div>
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <div className="flex gap-2">
                                        <Input
                                            value={newTag}
                                            onChange={(e) => setNewTag(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                                            placeholder="Add tag..."
                                            className="h-8 text-xs bg-gray-900 border-gray-600 focus:ring-emerald-500 text-white"
                                        />
                                        <Button
                                            size="sm"
                                            aria-label="Add tag" onClick={handleAddTag}
                                            disabled={isAddingTag}
                                            className="h-8 w-8 p-0 bg-gray-700 hover:bg-gray-600 border border-gray-600"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <TradeReviewForm
                tradeId={trade.id}
                initialReview={initialReview}
                initialUpdatedAt={trade.review?.updatedAt || null}
            />
        </div>
    );
}

function ExecutionRow({ execution }: { execution: any }) {
    const [error, setError] = useState("");
    const { updateExecution } = useJournal();
    const [isEditing, setIsEditing] = useState(false);
    const [data, setData] = useState(() => {
        const date = new Date(execution.time);
        const time = formatTimeInTimeZone(date, "America/New_York");
        return {
            time,
            side: execution.side,
            quantity: execution.quantity,
            price: Number(execution.price),
            fee: Number(execution.fee),
            pnl: execution.pnl !== null ? Number(execution.pnl) : ""
        };
    });

    const handleSave = async () => {
        setError("");
        const dateKey = getNewYorkDayKey(new Date(execution.time));
        const time = data.time.length === 5 ? data.time + ":00" : data.time;
        const result = await updateExecution(execution.id, { ...data, time: new Date(`${dateKey}T${time}${getTimeZoneOffset(dateKey, time)}`).toISOString(), pnl: data.pnl !== "" ? Number(data.pnl) : null });
        if (!result.success) { setError(result.error ?? "Execution could not be saved."); return; }
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <TableRow className="border-gray-700 bg-gray-800/50">
                <TableCell>
                    <Input
                        aria-label="Execution time (New York)" value={data.time}
                        onChange={e => setData({ ...data, time: e.target.value })}
                        className="h-7 w-24 bg-gray-900 border-gray-600 text-xs"
                    />
                </TableCell>
                <TableCell>
                    <select
                        aria-label="Execution side" value={data.side}
                        onChange={e => setData({ ...data, side: e.target.value })}
                        className="h-7 bg-gray-900 border-gray-600 text-xs rounded px-1"
                    >
                        <option value="B">B</option>
                        <option value="S">S</option>
                        <option value="SS">SS</option>
                    </select>
                </TableCell>
                <TableCell>
                    <Input
                        type="number"
                        aria-label="Execution quantity" value={data.quantity}
                        onChange={e => setData({ ...data, quantity: Number(e.target.value) })}
                        className="h-7 w-20 bg-gray-900 border-gray-600 text-xs"
                    />
                </TableCell>
                <TableCell>
                    <Input
                        type="number"
                        step="0.01"
                        aria-label="Execution price" value={data.price}
                        onChange={e => setData({ ...data, price: Number(e.target.value) })}
                        className="h-7 w-20 bg-gray-900 border-gray-600 text-xs"
                    />
                </TableCell>
                <TableCell>
                    <Input
                        type="number"
                        step="0.01"
                        aria-label="Execution fee" value={data.fee}
                        onChange={e => setData({ ...data, fee: Number(e.target.value) })}
                        className="h-7 w-20 bg-gray-900 border-gray-600 text-xs"
                    />
                </TableCell>
                <TableCell>
                    <Input
                        type="number"
                        step="0.01"
                        aria-label="Execution net Pnl" value={data.pnl}
                        onChange={e => setData({ ...data, pnl: e.target.value })}
                        className="h-7 w-20 bg-gray-900 border-gray-600 text-xs text-green-400"
                        placeholder="0.00"
                    />
                </TableCell>
                <TableCell>
                    {error && <p role="status" className="max-w-48 text-xs text-red-400">{error}</p>}
                    <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" aria-label="Save execution" onClick={handleSave} className="h-6 w-6 text-green-500 hover:text-green-400 hover:bg-green-900/20">
                            <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" aria-label="Cancel execution edit" onClick={() => setIsEditing(false)} className="h-6 w-6 text-gray-500 hover:text-gray-400">
                            <X className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </TableCell>
            </TableRow>
        );
    }

    return (
        <TableRow className="border-gray-700 hover:bg-gray-700/50 group">
            <TableCell><span>{new Date(execution.time).toLocaleTimeString("en-US", { timeZone: "America/New_York" })}</span><details className="mt-1 text-[10px] text-gray-500"><summary className="cursor-pointer">Execution ID</summary><span className="break-all select-all">{execution.id}</span></details></TableCell>
            <TableCell>
                <span className={cn(
                    "text-xs px-2 py-0.5 rounded",
                    (execution.side === 'B' || execution.side === 'BUY') ? "bg-green-900/30 text-green-500" : "bg-red-900/30 text-red-500"
                )}>
                    {execution.side}
                </span>
            </TableCell>
            <TableCell>{(execution.quantity).toLocaleString()}</TableCell>
            <TableCell>${Number(execution.price).toFixed(2)}</TableCell>
            <TableCell className="text-red-400">${(Number(execution.fee)).toFixed(3)}</TableCell>
            <TableCell className={cn(
                "font-bold",
                Number(execution.pnl) > 0 ? "text-green-500" : Number(execution.pnl) < 0 ? "text-red-500" : "text-gray-400"
            )}>
                {execution.pnl !== null ? `$${(Number(execution.pnl)).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "-"}
            </TableCell>
            <TableCell>
                <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Edit execution"
                    onClick={() => setIsEditing(true)}
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-white"
                >
                    <Pencil className="w-3 h-3" />
                </Button>
            </TableCell>
        </TableRow>
    );
}
