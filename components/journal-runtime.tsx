"use client";
import { createContext, lazy, Suspense, useContext, useSyncExternalStore } from "react";
import type { AnchorHTMLAttributes, ComponentType, ReactNode } from "react";
import type { JournalClient } from "@/lib/journal-client";

export interface JournalNavigation { pathname: string; push(path: string): void; refresh(): void }
type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };
export const JournalContext = createContext<{ client: JournalClient; navigation: JournalNavigation; LinkComponent: ComponentType<LinkProps> } | null>(null);
function useRuntime() { const value = useContext(JournalContext); if (!value) throw new Error("Journal runtime is missing."); return value; }
export function useJournal() { return useRuntime().client; }
export function useRouter() { return useRuntime().navigation; }
export function usePathname() { return useRuntime().navigation.pathname; }
export function Link(props: LinkProps) { const { LinkComponent } = useRuntime(); return <LinkComponent {...props}/>; }
const subscribe = () => () => {};
/** Lazy charts render after hydration in both Next.js and the static demo. */
export function lazyClient<P extends object>(load: () => Promise<{ default: ComponentType<P> }>, options: { ssr?: boolean; loading?: () => ReactNode } = {}) {
  const Component = lazy(load);
  return function LazyClient(props: P) {
    const mounted = useSyncExternalStore(subscribe, () => true, () => false);
    return <Suspense fallback={options.loading?.() ?? null}>{mounted ? <Component {...props}/> : options.loading?.() ?? null}</Suspense>;
  };
}
