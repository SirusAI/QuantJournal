import { AI_PROVIDERS } from "./settings-types";
import type { AiProvider } from "./settings-types";
export function getDailyReviewProviderLabel(provider: string): string { return provider in AI_PROVIDERS ? AI_PROVIDERS[provider as AiProvider].label : provider; }
