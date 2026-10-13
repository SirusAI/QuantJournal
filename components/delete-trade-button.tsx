"use client";
import { useJournal } from "@/components/journal-runtime";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "@/components/journal-runtime";
import { Button } from "@/components/ui/button";

export function DeleteTradeButton({ id }: { id: string }) {
 const client = useJournal();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this trade?")) return;
        setLoading(true);

        try {
            const res = await client.deleteTrade(id);

            if (res.ok) {
                router.refresh(); // Refresh current route
            } else {
                alert("Failed to delete trade.");
            }
        } catch (error) {
            console.error(error);
            alert("Error deleting trade.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Button
            variant="ghost"
            size="sm"
            className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
            onClick={handleDelete}
            disabled={loading}
        >
            <Trash2 className="w-4 h-4" />
        </Button>
    )
}
