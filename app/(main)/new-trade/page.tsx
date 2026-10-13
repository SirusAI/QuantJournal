import { TradeForm } from "@/components/trade-form";

export default function NewTradePage() {
    return (
        <div className="p-8 space-y-8 bg-gray-900 min-h-screen text-white">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">New Trade</h2>
                <p className="text-gray-400">Make an entry in your trading journal. Entries can be matched later with import data.</p>
            </div>
            <TradeForm />
        </div>
    );
}
