// CDP smoke for round-2: example default, Aleatório dropdown, Conferir play mode
// (green/red), protocol modal close (X + Esc), and item-4 auto-toggle regression (mobile).
const APP_URL = process.argv[2];
const CDP = `http://localhost:${process.argv[3]}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getPageTarget() {
  for (let i = 0; i < 40; i++) {
    try { const list = await (await fetch(`${CDP}/json`)).json();
      const p = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl); if (p) return p;
    } catch {} await sleep(250);
  }
  throw new Error('No CDP page');
}
const page = await getPageTarget();
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await new Promise((r) => ws.addEventListener('open', r));
await send('Runtime.enable'); await send('Page.enable');
async function evalJS(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error('JS exc: ' + JSON.stringify(r.result.exceptionDetails));
  return r.result.result.value;
}
async function pollFor(expr, label, t = 8000) { const s = Date.now(); while (Date.now() - s < t) { if (await evalJS(expr)) return; await sleep(120); } throw new Error('timeout ' + label); }
const results = [];
const check = (name, cond) => { results.push([name, cond]); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };
const clickText = (t) => `(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes(${JSON.stringify(t)}));if(!b)return 'NF';if(b.disabled)return 'DIS';b.click();return 'OK';})()`;
const GIVENS = "[...document.querySelectorAll('.cell')].filter(c=>/[1-9]/.test(c.textContent)).length";
const GRID = "[...document.querySelectorAll('.cell')].map(c=>c.textContent.trim()||'.').join('')";

await send('Page.navigate', { url: APP_URL });
await pollFor("document.querySelectorAll('.cell').length===81", 'cells');

// A) example loaded as default (no Exemplo click)
await pollFor(`${GIVENS} >= 17`, 'example givens present at start');
check('starts with example loaded (>=17 givens)', await evalJS(`${GIVENS} >= 17`));
check('keypad present at start', await evalJS("!!document.querySelector('.numpad-grid')"));

// B) Aleatorio dropdown loads a random puzzle
const before = await evalJS(GRID);
check('clicked Aleatório', 'OK' === await evalJS(clickText('Aleatório')));
await pollFor("!!document.querySelector('.dropdown-menu')", 'menu open');
check('dropdown menu opens', await evalJS("!!document.querySelector('.dropdown-menu')"));
await evalJS("[...document.querySelectorAll('.dropdown-item')].find(b=>b.textContent.trim()==='Fácil').click()");
await pollFor(`${GRID} !== ${JSON.stringify(before)} && ${GIVENS} >= 17`, 'random puzzle loaded');
check('Fácil loads a different puzzle', await evalJS(`${GRID} !== ${JSON.stringify(before)}`));

// C) Conferir -> play mode -> exactly one of digits 1..9 is correct in an empty cell
check('clicked Conferir', 'OK' === await evalJS(clickText('Conferir')));
await pollFor("document.body.innerText.includes('Preencha as células')", 'play mode entered');
check('enters play mode (play hint shown)', await evalJS("document.body.innerText.includes('Preencha as células')"));
const emptyIdx = await evalJS("(()=>{const c=[...document.querySelectorAll('.cell')];for(let i=0;i<c.length;i++)if(!c[i].textContent.trim())return i;return -1;})()");
check('found an empty cell to fill', emptyIdx >= 0);
await evalJS(`document.querySelectorAll('.cell')[${emptyIdx}].click()`);
await pollFor("[...document.querySelectorAll('.numpad-btn')].every(b=>!b.disabled)", 'keypad enabled');
let correctCount = 0, wrongCount = 0;
for (let d = 1; d <= 9; d++) {
  await evalJS(`[...document.querySelectorAll('.numpad-btn')].find(b=>b.textContent.trim()==='${d}').click()`);
  await sleep(40);
  const cls = await evalJS(`document.querySelectorAll('.cell')[${emptyIdx}].className`);
  if (cls.includes('correct')) correctCount++;
  else if (cls.includes('wrong')) wrongCount++;
}
check(`exactly one digit is correct (got ${correctCount})`, correctCount === 1);
check(`the other 8 are wrong (got ${wrongCount})`, wrongCount === 8);

// D) protocol modal: X closes, Esc closes
check('clicked Editar', 'OK' === await evalJS(clickText('Editar')));
await pollFor(`${GIVENS} >= 17`, 'back to edit');
check('clicked Resolver', 'OK' === await evalJS(clickText('Resolver')));
await pollFor("document.body.innerText.includes('PASSO 01')", 'solved');
await evalJS("[...document.querySelectorAll('a')].find(a=>/explica/i.test(a.textContent)).click()");
await pollFor("!!document.querySelector('.protocol')", 'modal open');
check('protocol modal has a close (X) button', await evalJS("!!document.querySelector('.modal-close')"));
await evalJS("document.querySelector('.modal-close').click()");
await pollFor("!document.querySelector('.protocol')", 'modal closed by X');
check('X button closes the modal', await evalJS("!document.querySelector('.protocol')"));
await evalJS("[...document.querySelectorAll('a')].find(a=>/explica/i.test(a.textContent)).click()");
await pollFor("!!document.querySelector('.protocol')", 'modal reopen');
await evalJS("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))");
await pollFor("!document.querySelector('.protocol')", 'modal closed by Esc');
check('Esc closes the modal', await evalJS("!document.querySelector('.protocol')"));

// E) item-4 regression: board width constant across Auto toggle on mobile (390px)
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send('Page.navigate', { url: APP_URL });
await pollFor(`${GIVENS} >= 17`, 'mobile reload');
await evalJS(clickText('Resolver'));
await pollFor("document.body.innerText.includes('PASSO 01')", 'mobile solved');
await sleep(150);
const w1 = await evalJS("Math.round(document.querySelector('.board').getBoundingClientRect().width)");
await evalJS(clickText('Auto'));
await sleep(300);
const w2 = await evalJS("Math.round(document.querySelector('.board').getBoundingClientRect().width)");
check(`board width constant across Auto toggle (mobile ${w1} -> ${w2})`, w1 === w2);

const failed = results.filter(([, c]) => !c);
console.log(`\nSMOKE RESULT: ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) { console.log('FAILED: ' + failed.map(([n]) => n).join('; ')); process.exit(1); }
console.log('ALL SMOKE CHECKS PASSED');
process.exit(0);
