import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
const base = path.resolve('.local/python');
const python = path.join(base, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
mkdirSync(path.dirname(base), {recursive:true});
function run(command, args) {
  const result = spawnSync(command, args, {stdio:'inherit', windowsHide:true});
  if (result.error || result.status !== 0) { console.error('Python setup failed. Install Python 3.10+ and rerun this command.'); process.exit(1); }
}
if (!existsSync(python)) run(process.env.MARKET_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), ['-m','venv',base]);
run(python, ['-m','pip','install','-r','scripts/requirements-market-data.txt']);
console.log('yfinance is ready. Test it in Settings → Market Data.');
