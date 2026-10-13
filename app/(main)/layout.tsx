import { LocalJournalProvider } from "@/components/local-journal-provider";
import { Sidebar } from "@/components/sidebar";


export default function MainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <LocalJournalProvider>
            <div className="h-full relative bg-gray-900">
                <div className="hidden h-full md:flex md:w-72 md:flex-col md:fixed md:inset-y-0 z-[80] bg-gray-900">
                    <Sidebar />
                </div>
                <main className="md:pl-72 pb-10 min-h-screen">
                    {children}
                </main>
            </div>
        </LocalJournalProvider>
    );
}
