"use client";
import { Link } from "@/components/journal-runtime";
import { SAMPLE_TSV } from "@/lib/broker-import";
import { useJournal } from "@/components/journal-runtime";

import { useState } from "react";
import { format } from "date-fns";
import { useRouter } from "@/components/journal-runtime";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/date-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
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
    Plus,
    Trash2,
    Sparkles,
    Loader2,
    CheckCircle2,
    AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

export function TradeForm() {
 const client = useJournal();
    const router = useRouter();

    // Manual Form State
    const [symbol, setSymbol] = useState("");
    const [date, setDate] = useState(client.referenceDate ?? new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState("");
    const [tags, setTags] = useState("");
    const [manualPnl, setManualPnl] = useState("");
    const [showExecutions, setShowExecutions] = useState(false);
    const [executions, setExecutions] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Smart Import State
    const [smartData, setSmartData] = useState("");
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);

    const addExecution = () => {
        setExecutions([...executions, { side: "B", quantity: 100, price: 0, time: "09:30:00", pnl: "" }]);
    };

    const removeExecution = (index: number) => {
        setExecutions(executions.filter((_, i) => i !== index));
    };

    const updateExecution = (index: number, field: string, value: any) => {
        const newExecs = [...executions];
        newExecs[index] = { ...newExecs[index], [field]: value };
        setExecutions(newExecs);
    };

    const handleCreateManual = async () => {
        setIsSaving(true);
        try {
            const res = await client.createTrade({
                    symbol,
                    date,
                    notes,
                    tags,
                    pnl: manualPnl ? Number(manualPnl) : undefined,
                    executions: showExecutions ? executions : []
                });

            if (res.ok) {
                router.push("/trades");
                router.refresh();
            } else {
                const data = await res.json();
                alert(`Failed to create trade: ${data.error}`);
            }
        } catch (e: any) {
            console.error(e);
            alert(`Error creating trade: ${e.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSmartImport = async () => {
        if (!smartData.trim()) return;
        setIsImporting(true); setImportResult(null);
        try { const response = await client.importPasted(smartData); const result = await response.json();
            if (!response.ok) throw new Error(result.error ?? "Import failed.");
            setImportResult({ success: true, message: `Created ${result.count} trades; skipped ${result.skipped ?? 0} duplicates. Reconcile fills and fees in Trades.` }); router.refresh();
        } catch (error) { setImportResult({ success: false, message: error instanceof Error ? error.message : "Import failed." }); }
        finally { setIsImporting(false); }
    };

    return (
        <Tabs defaultValue="manual" className="w-full">
            <div className="flex flex-wrap gap-3 mb-4 text-sm"><Link className="text-sky-400 underline" href="/import-guide">How to Import Broker Trades</Link><a href={client.assetUrl("imports/smart-import.tsv")} download className="text-sky-400 underline">Download pasted-table example</a></div>
            <TabsList className="bg-gray-800 border-gray-700 mb-6">
                <TabsTrigger value="manual" className="px-6 py-2">Manual Entry</TabsTrigger>
                <TabsTrigger value="smart" className="px-6 py-2 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-sky-400" /> Smart Format
                </TabsTrigger>
            </TabsList>

            <TabsContent value="manual">
                <div className="grid gap-6 md:grid-cols-2">
                    <Card className="bg-gray-800 border-gray-700 text-white">
                        <CardHeader>
                            <CardTitle>Trade Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <DatePicker
                                    label="Date"
                                    date={date ? new Date(date + "T00:00:00") : undefined}
                                    setDate={(d) => setDate(d ? format(d, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Symbol</Label>
                                <Input value={symbol} onChange={e => setSymbol(e.target.value)} className="bg-gray-900 border-gray-600" placeholder="e.g. AAPL" />
                            </div>
                            <div className="space-y-2">
                                <Label>Tags</Label>
                                <Input value={tags} onChange={e => setTags(e.target.value)} className="bg-gray-900 border-gray-600" placeholder="setupA, mistakeB" />
                            </div>
                            <div className="space-y-2">
                                <Label>Manual P&L (Optional)</Label>
                                <Input type="number" step="0.01" value={manualPnl} onChange={e => setManualPnl(e.target.value)} className="bg-gray-900 border-gray-600" placeholder="0.00" />
                                <p className="text-[10px] text-gray-500 italic">Leave blank to auto-calculate from executions</p>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Manual Executions</Label>
                                    <Button variant={showExecutions ? "secondary" : "outline"} size="sm" onClick={() => setShowExecutions(!showExecutions)}>
                                        {showExecutions ? "Hide" : "Add"}
                                    </Button>
                                </div>
                            </div>

                            <Button
                                disabled={isSaving}
                                onClick={handleCreateManual}
                                className="w-full bg-green-600 hover:bg-green-700 font-bold"
                            >
                                {isSaving ? "Saving..." : "Create Trade Entry"}
                            </Button>

                        </CardContent>
                    </Card>

                    <Card className="bg-gray-800 border-gray-700 text-white h-full">
                        <CardHeader>
                            <CardTitle>Notes</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[80%]">
                            <Textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                className="h-full min-h-[300px] bg-gray-900 border-gray-600 resize-none"
                                placeholder="Type your thesis, emotions, and review here..."
                            />
                        </CardContent>
                    </Card>

                    {showExecutions && (
                        <Card className="md:col-span-2 bg-gray-800 border-gray-700 text-white">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>Executions</CardTitle>
                                <Button size="sm" onClick={addExecution}><Plus className="w-4 h-4 mr-2" /> Add Fill</Button>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-gray-700 hover:bg-gray-700/50">
                                            <TableHead className="text-gray-400">Time</TableHead>
                                            <TableHead className="text-gray-400">Side</TableHead>
                                            <TableHead className="text-gray-400">Qty</TableHead>
                                            <TableHead className="text-gray-400">Price</TableHead>
                                            <TableHead className="text-gray-400">PnL (Realized)</TableHead>
                                            <TableHead className="text-gray-400">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {executions.map((ex, i) => (
                                            <TableRow key={i} className="border-gray-700 hover:bg-gray-700/50">
                                                <TableCell><Input value={ex.time} onChange={e => updateExecution(i, 'time', e.target.value)} className="h-8 bg-gray-900 border-gray-600" /></TableCell>
                                                <TableCell>
                                                    <select className="h-8 bg-gray-900 border-gray-600 rounded px-2" value={ex.side} onChange={e => updateExecution(i, 'side', e.target.value)}>
                                                        <option value="B">Buy</option>
                                                        <option value="S">Sell</option>
                                                        <option value="SS">Short</option>
                                                    </select>
                                                </TableCell>
                                                <TableCell><Input type="number" value={ex.quantity} onChange={e => updateExecution(i, 'quantity', e.target.value)} className="h-8 bg-gray-900 border-gray-600" /></TableCell>
                                                <TableCell><Input type="number" step="0.01" value={ex.price} onChange={e => updateExecution(i, 'price', e.target.value)} className="h-8 bg-gray-900 border-gray-600" /></TableCell>
                                                <TableCell><Input type="number" step="0.01" value={ex.pnl} onChange={e => updateExecution(i, 'pnl', e.target.value)} className="h-8 bg-gray-900 border-gray-600" placeholder="Optional" /></TableCell>
                                                <TableCell>
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400" onClick={() => removeExecution(i)}><Trash2 className="w-4 h-4" /></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </TabsContent>

            <TabsContent value="smart">
                <Card className="bg-gray-800 border-gray-700 text-white shadow-2xl">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-sky-400" />
                            <CardTitle>Smart Format Import</CardTitle>
                        </div>
                        <CardDescription className="text-gray-400">
                            Paste your raw execution data (Tab-separated) to automatically group and record trades.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Textarea
                            value={smartData}
                            onChange={(e) => setSmartData(e.target.value)}
                            placeholder={SAMPLE_TSV}
                            className="min-h-[400px] bg-gray-900 border-gray-600 focus:ring-sky-500 font-mono text-xs overflow-x-auto whitespace-pre"
                        />

                        {importResult && (
                            <div className={cn(
                                "p-3 rounded-md flex items-center gap-2 text-sm",
                                importResult.success ? "bg-green-900/20 text-green-400 border border-green-800/50" : "bg-red-900/20 text-red-400 border border-red-800/50"
                            )}>
                                {importResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                {importResult.message}
                            </div>
                        )}

                        <Button
                            onClick={handleSmartImport}
                            disabled={isImporting || !smartData.trim()}
                            className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold h-12"
                        >
                            {isImporting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Parsing & Recording Trades...
                                </>
                            ) : (
                                "Record Scanned Trades"
                            )}
                        </Button>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    );
}

