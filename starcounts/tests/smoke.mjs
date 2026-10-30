// Headless-Chrome smoke test: load the page, report console errors and timings,
// run optional JS, and save screenshots.
//   node tests/smoke.mjs <url> <outdir> [width] [height] [--js "<expr>"]... [--shot name]...
// Steps run in order; each --js result is printed. Requires Google Chrome.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, outdir, w = '1440', h = '1000', ...rest] = process.argv.slice(2);
mkdirSync(outdir, { recursive: true });
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const prof = mkdtempSync(join(tmpdir(), 'cdp-'));
const port = 9300 + Math.floor(Math.random() * 500);
const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`,
  '--no-first-run', '--hide-scrollbars', `--window-size=${w},${h}`, 'about:blank'], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 50; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = list.find((t) => t.type === 'page');
    if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break; }
  } catch (_) { /* not up yet */ }
  await sleep(200);
}
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
const logs = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.consoleAPICalled') logs.push(`[${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description).join(' '));
  if (m.method === 'Runtime.exceptionThrown') logs.push('[exception] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === 'Log.entryAdded') logs.push(`[${m.params.entry.level}] ${m.params.entry.text} ${m.params.entry.url || ''}`);
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: false });
const t0 = Date.now();
await send('Page.navigate', { url });
for (let i = 0; i < 100; i++) {
  const r = await send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
  if (r.result?.result?.value === 'complete') break;
  await sleep(100);
}
await sleep(1200);
console.log(`loaded in ~${Date.now() - t0 - 1200} ms`);
for (let i = 0; i < rest.length; i += 2) {
  const flag = rest[i], arg = rest[i + 1];
  if (flag === '--js') {
    const r = await send('Runtime.evaluate', { expression: arg, returnByValue: true, awaitPromise: true });
    console.log('js>', JSON.stringify(r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description ?? r.result).slice(0, 4000));
    await sleep(400);
  } else if (flag === '--shot') {
    const full = arg.endsWith('-full');
    let clip;
    if (full) {
      const m = await send('Page.getLayoutMetrics');
      const cs = m.result.cssContentSize || m.result.contentSize;
      clip = { x: 0, y: 0, width: cs.width, height: Math.min(cs.height, 6000), scale: 1 };
    }
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, ...(clip ? { clip } : {}) });
    writeFileSync(join(outdir, arg + '.png'), Buffer.from(r.result.data, 'base64'));
    console.log('shot>', join(outdir, arg + '.png'));
  } else if (flag === '--wait') {
    await sleep(+arg);
  }
}
console.log('console:', logs.length ? '\n  ' + logs.join('\n  ') : '(none)');
ws.close(); proc.kill();
process.exit(0);
