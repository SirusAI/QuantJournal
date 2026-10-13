"use client";

import { Link } from "@/components/journal-runtime";
import { usePathname } from "@/components/journal-runtime";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Calendar,
    BarChart3,
    List,
    Book,
    FileText,
    PlusCircle,
} from "lucide-react";

import { CsvImporter } from "./csv-importer";

const routes = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    { label: "Calendar", icon: Calendar, href: "/calendar" },
    { label: "Reports", icon: BarChart3, href: "/reports" },
    { label: "Trades", icon: List, href: "/trades" },
    { label: "Journal", icon: Book, href: "/journal" },
    { label: "Daily Review", icon: FileText, href: "/daily-review" },
    { label: "New Trade", icon: PlusCircle, href: "/new-trade" },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="space-y-4 py-4 flex flex-col h-full bg-[#111827] text-white">
            <div className="px-3 py-2 flex-1">
                <Link href="/dashboard" className="flex items-center pl-3 mb-14">
                    <div className="relative w-8 h-8 mr-4">
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center font-bold">Q</div>
                    </div>
                    <h1 className="text-2xl font-bold">QuantJournal</h1>
                </Link>
                <div className="space-y-1">
                    {routes.map((route) => (
                        <Link
                            key={route.href}
                            href={route.href}
                            className={cn(
                                "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-lg transition",
                                pathname === route.href ? "text-white bg-white/10" : "text-zinc-400"
                            )}
                        >
                            <div className="flex items-center flex-1">
                                <route.icon className={cn("h-5 w-5 mr-3", route.href === "/new-trade" ? "text-green-500" : "text-sky-500")} />
                                {route.label}
                            </div>
                        </Link>
                    ))}
                </div>

                <div className="mt-10 px-3">
                    <CsvImporter />
                </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-800"><Link href="/settings" className="text-sm text-sky-400">AI & Market Settings</Link></div>
        </div>
    );
}
