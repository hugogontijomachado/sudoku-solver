// Headless Chrome DevTools-Protocol smoke for the Sudoku Solver improvements.
// Covers: numeric keypad input/erase + completion celebration on the last step.
// No external deps: Node global fetch + WebSocket. Usage: node smoke2.mjs <appUrl> <cdpPort>
const APP_URL = process.argv[2];
const CDP = `http://localhost:${process.argv[3]}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getPageTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`${CDP}/json`)).json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('No CDP page target found');
}

const page = await getPageTarget();
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
const send = (method, params = {}) =>
  new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

await new Promise((r) => ws.addEventListener('open', r));
await send('Runtime.enable');
await send('Page.enable');

async function evalJS(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) {
    throw new Error('JS exception: ' + JSON.stringify(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails));
  }
  return r.result.result.value;
}
async function pollFor(expr, label, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) { if (await evalJS(expr)) return true; await sleep(150); }
  throw new Error(`TIMEOUT waiting for: ${label}`);
}
const results = [];
const check = (name, cond) => { results.push([name, cond]); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };
const clickBtnText = (t) =>
  `(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes(${JSON.stringify(t)}));if(!b)return 'NF';if(b.disabled)return 'DISABLED';b.click();return 'CLICKED';})()`;

await send('Page.navigate', { url: APP_URL });
await pollFor("document.querySelectorAll('.cell').length === 81", '81 cells');

// --- Item 2: numeric keypad (edit mode) ---
check('keypad present in edit mode', await evalJS("!!document.querySelector('.numpad-grid')"));
check('keypad has 9 digits + erase (10 buttons)', await evalJS("document.querySelectorAll('.numpad-btn').length === 10"));
check('keypad disabled with no cell selected', await evalJS("[...document.querySelectorAll('.numpad-btn')].every(b=>b.disabled)"));
check('keypad hint shown when disabled', await evalJS("!!document.querySelector('.numpad-hint')"));
// select first cell, then type 5 via the pad
await evalJS("document.querySelector('.cell').click()");
await pollFor("[...document.querySelectorAll('.numpad-btn')].every(b=>!b.disabled)", 'keypad enabled after selecting a cell');
check('keypad enabled after selecting a cell', await evalJS("[...document.querySelectorAll('.numpad-btn')].every(b=>!b.disabled)"));
await evalJS("[...document.querySelectorAll('.numpad-btn')].find(b=>b.textContent.trim()==='5').click()");
await pollFor("document.querySelector('.cell').textContent.trim()==='5'", 'cell filled with 5 via keypad');
check('keypad digit writes into selected cell', await evalJS("document.querySelector('.cell').textContent.trim()==='5'"));
await evalJS("document.querySelector('.numpad-erase').click()");
await pollFor("document.querySelector('.cell').textContent.trim()===''", 'cell cleared via erase');
check('keypad erase clears the cell', await evalJS("document.querySelector('.cell').textContent.trim()===''"));

// --- Item 4: celebration on the last step (example loads by default) ---
await pollFor("[...document.querySelectorAll('.cell')].filter(c=>/[1-9]/.test(c.textContent)).length >= 20", 'board filled by default example');
check('board filled by default example', await evalJS("[...document.querySelectorAll('.cell')].filter(c=>/[1-9]/.test(c.textContent)).length >= 20"));
check('clicked Resolver', 'CLICKED' === await evalJS(clickBtnText('Resolver')));
await pollFor("document.body.innerText.includes('PASSO 01')", 'PASSO 01');
check('no celebration before the last step', await evalJS("!document.querySelector('.celebrate-badge')"));
// step to the last hint
let guard = 0;
while (guard++ < 400) {
  const s = await evalJS("(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Próximo'));if(!b)return 'NOBTN';if(b.disabled)return 'DONE';b.click();return 'CLICK';})()");
  if (s === 'DONE' || s === 'NOBTN') break;
  await sleep(50);
}
await pollFor("!!document.querySelector('.celebrate-badge')", 'celebration badge on last step');
check('celebration badge appears on last step', await evalJS("!!document.querySelector('.celebrate-badge')"));
check('badge says Resolvido', await evalJS("(document.querySelector('.celebrate-badge')?.textContent||'').includes('Resolvido')"));
check('board has glow class', await evalJS("document.querySelector('.board').classList.contains('celebrate')"));
check('confetti overlay rendered', await evalJS("!!document.querySelector('.confetti')"));
// stepping back clears celebration
check('clicked Anterior', 'CLICKED' === await evalJS(clickBtnText('Anterior')));
await pollFor("!document.querySelector('.celebrate-badge')", 'celebration clears when leaving last step');
check('celebration clears when leaving last step', await evalJS("!document.querySelector('.celebrate-badge')"));

const failed = results.filter(([, c]) => !c);
console.log(`\nSMOKE RESULT: ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) { console.log('FAILED: ' + failed.map(([n]) => n).join('; ')); process.exit(1); }
console.log('ALL SMOKE CHECKS PASSED');
process.exit(0);
