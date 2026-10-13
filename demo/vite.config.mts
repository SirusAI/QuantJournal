import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
const root=fileURLToPath(new URL("..",import.meta.url));
export default defineConfig({root:fileURLToPath(new URL(".",import.meta.url)),base:process.env.DEMO_BASE_PATH||"./",plugins:[react(),{
  name:"reject-server-dependencies",moduleParsed(info){if(/[/\\](local-settings|db|ai-client|market-data|daily-review|edge-analysis-service)\.ts$/.test(info.id)||info.id.includes("@prisma/client")||info.id.includes("/app/actions"))throw new Error("Server dependency reached demo bundle: "+info.id);}
}],resolve:{alias:{"@":root}},server:{host:"127.0.0.1",port:4173,fs:{allow:[root]}},preview:{host:"127.0.0.1",port:4173},build:{outDir:"dist",emptyOutDir:true},css:{postcss:root}});
