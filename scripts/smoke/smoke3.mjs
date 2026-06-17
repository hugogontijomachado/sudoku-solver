// CDP smoke for item 1 (no-solution guard) and item 3 (fixed step card / non-jumping nav).
// Run with a desktop-width Chrome window. Usage: node smoke3.mjs <appUrl> <cdpPort>
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
  if (r.result?.exceptionDetails) throw new Error('JS exception: ' + JSON.stringify(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails));
  return r.result.result.value;
}
async function pollFor(expr, label, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) { if (await evalJS(expr)) return true; await sleep(150); }
  throw new Error(`TIMEOUT waiting for: ${label}`);
}
const results = [];
const check = (name, cond) => { results.push([name, cond]); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };
const clickBtnText = (t) => `(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes(${JSON.stringify(t)}));if(!b)return 'NF';if(b.disabled)return 'DISABLED';b.click();return 'CLICKED';})()`;
async function typeCell(idx, digit) {
  await evalJS(`document.querySelectorAll('.cell')[${idx}].click()`);
  await sleep(60);
  await evalJS(`[...document.querySelectorAll('.numpad-btn')].find(b=>b.textContent.trim()==='${digit}').click()`);
  await sleep(60);
}

await send('Page.navigate', { url: APP_URL });
await pollFor("document.querySelectorAll('.cell').length === 81", '81 cells');
check('desktop width active (min-width:881px)', await evalJS("window.matchMedia('(min-width: 881px)').matches"));

// the example loads by default — clear it before building the no-solution grid
await evalJS(clickBtnText('Limpar'));
await pollFor("[...document.querySelectorAll('.cell')].filter(c=>/[1-9]/.test(c.textContent)).length === 0", 'board cleared');

// --- Item 1: no-solution grid disables Resolver + shows banner ---
// row1 = 1..8 (cells 0..7), and a 9 in r2c9 (cell 17): r1c9 has no candidate, no duplicate.
for (let i = 0; i < 8; i++) await typeCell(i, i + 1);
await typeCell(17, 9);
await pollFor("document.body.innerText.includes('não tem solução')", 'no-solution banner');
check('shows "não tem solução" banner', await evalJS("document.body.innerText.includes('não tem solução')"));
check('Resolver button is disabled for no-solution grid', await evalJS(
  "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Resolver'));return !!b && b.disabled;})()"));

// --- Item 3: load a random puzzle, verify fixed step card + non-jumping nav ---
check('clicked Limpar', 'CLICKED' === await evalJS(clickBtnText('Limpar')));
await evalJS(clickBtnText('Aleatório'));
await pollFor("!!document.querySelector('.dropdown-menu')", 'dropdown open');
await evalJS("[...document.querySelectorAll('.dropdown-item')].find(b=>b.textContent.trim()==='Fácil').click()");
await pollFor("[...document.querySelectorAll('.cell')].filter(c=>/[1-9]/.test(c.textContent)).length >= 17", 'random puzzle loaded');
check('clicked Resolver', 'CLICKED' === await evalJS(clickBtnText('Resolver')));
await pollFor("document.body.innerText.includes('PASSO 01')", 'PASSO 01');

check('step card has an inline fixed height on desktop', await evalJS(
  "(()=>{const s=document.querySelector('.step');return !!s && /\\d/.test(s.style.height);})()"));
check('step .text is scrollable (overflow-y:auto)', await evalJS(
  "getComputedStyle(document.querySelector('.step .text')).overflowY === 'auto'"));
check('step card height ~= board card height (±4px)', await evalJS(
  "Math.abs(document.querySelector('.step').offsetHeight - document.querySelector('.board-card').offsetHeight) <= 4"));

// Record Próximo button position, advance a few steps, confirm it does not move.
const top1 = await evalJS("Math.round([...document.querySelectorAll('button')].find(b=>b.textContent.includes('Próximo')).getBoundingClientRect().top)");
for (let i = 0; i < 4; i++) {
  await evalJS(clickBtnText('Próximo'));
  await sleep(120);
}
const top2 = await evalJS("Math.round([...document.querySelectorAll('button')].find(b=>b.textContent.includes('Próximo')).getBoundingClientRect().top)");
check(`Próximo button does not move across steps (top ${top1} -> ${top2})`, Math.abs(top1 - top2) <= 1);

const failed = results.filter(([, c]) => !c);
console.log(`\nSMOKE RESULT: ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) { console.log('FAILED: ' + failed.map(([n]) => n).join('; ')); process.exit(1); }
console.log('ALL SMOKE CHECKS PASSED');
process.exit(0);
