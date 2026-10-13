import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ignored = new Set(["node_modules", ".next", ".local", ".git", ".agent", ".agents", ".codex", ".aws", "backups", "dist", "out", "__pycache__"]);
const textExtensions = new Set([".ts", ".tsx", ".js", ".cjs", ".mjs", ".mts", ".md", ".json", ".txt", ".csv", ".tsv", ".bat", ".py", ".prisma", ".sql", ".toml", ".yml", ".yaml", ".html", ".css", ".svg", ".vtt", ".map"]);
const rules = [
  ["credential pattern", /\b(?:nvapi-[\w-]{20,}|sk-(?:(?:proj|or-v1|ant-api\d+)-)?[\w-]{20,}|AIza[\w-]{20,}|gh[pousr]_[\w]{30,}|github_pat_[\w]{30,}|xox[baprs]-[\w-]{20,}|(?:AKIA|ASIA)[A-Z0-9]{16}\b)/],
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ["absolute machine path", /(?:\b[A-Z]:[\\/](?:Users|Documents and Settings)[\\/][^\s"'<>]+|["'][A-Z]:[\\/][^"'\r\n]+|\/(?:Users|home)\/[A-Za-z0-9._-]+)/i],
  ["URL containing credentials", /https?:\/\/[^\s/'"<>]+:[^\s/'"<>]+@[^\s/'"<>]+/],
  ["old personal profile", /User Profile \(The Trader\)|must[ ]memorize[ ]these[ ]stats/i],
];
const issues = [];
let scanned = 0;

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    const relative = path.relative(process.cwd(), file);
    if (entry.isSymbolicLink()) { issues.push([relative, "symlink requires manual review"]); continue; }
    if (entry.isDirectory()) {
      if (!ignored.has(entry.name) && !entry.name.startsWith(".venv") && entry.name !== "venv") walk(file);
      continue;
    }
    // The user's local environment is excluded from Git; never print its contents.
    if (entry.name === ".env") continue;
    if (/^\.env(?:\.(?!example$).*)?$|\.(?:db|sqlite3?)(?:-.*)?$|\.(?:log|pyc|key|pem|p12|pfx|har|dmp|dump|bak|backup)$|Nvidia API Key|import-manual/i.test(entry.name)) issues.push([relative, "private runtime file"]);
    if (!textExtensions.has(path.extname(file)) && entry.name !== ".env.example") continue;
    scanned++;
    const content = readFileSync(file, "utf8");
    // Test-only credential fixtures deliberately exercise authentication validation.
    for (const [label, pattern] of rules) {
      if (label === "URL containing credentials" && relative.replaceAll("\\", "/").startsWith("tests/")) {
        const matches = content.match(new RegExp(pattern.source, "g")) ?? [];
        if (matches.every(value => /@[^/]+\.test(?:[/:]|$)/.test(value))) continue;
      }
      if (pattern.test(content)) issues.push([relative, label]);
    }
  }
}

walk(process.cwd());
for (const issue of issues) console.error(issue.join(": "));
console.log(`Release scan: ${scanned} source/document files; ${issues.length} findings. Private runtime files are excluded from upload. Image/video contents and release archives also require inspection.`);
process.exitCode = issues.length ? 1 : 0;
