// CDP smoke for round-3: black-screen fix (1-digit grid -> Resolver shows the
// multiple-solutions dialog, no crash; "Preencher uma célula" adds a cell) and the
// Técnicas tab (cards + MiniBoard animation; switch back to Resolver).
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

await send('Page.navigate', { url: APP_URL });
await pollFor("document.querySelectorAll('.cell').length===81", 'cells');

// A) black-screen repro: clear, type one digit, Resolver -> dialog (no crash)
check('clicked Limpar', 'OK' === await evalJS(clickText('Limpar')));
await pollFor(`${GIVENS}===0`, 'board cleared');
await evalJS("document.querySelectorAll('.cell')[40].click()");
await pollFor("[...document.querySelectorAll('.numpad-btn')].some(b=>!b.disabled)", 'keypad enabled');
await evalJS("[...document.querySelectorAll('.numpad-btn')].find(b=>b.textContent.trim()==='5').click()");
await pollFor(`${GIVENS}===1`, 'one digit typed');
check('Resolver enabled with one clue', 'OK' === await evalJS(clickText('Resolver')));
await pollFor("!!document.querySelector('.multi-dialog')", 'multi dialog');
check('multiple-solutions dialog appears (not a black screen)', await evalJS("!!document.querySelector('.multi-dialog')"));
check('app still rendered (wrap + board present)', await evalJS("!!document.querySelector('.wrap') && !!document.querySelector('.board')"));
check('dialog offers to fill a cell', await evalJS("document.body.innerText.includes('Preencher uma célula')"));
check('clicked Preencher uma célula', 'OK' === await evalJS(clickText('Preencher uma célula')));
await pollFor(`${GIVENS}===2`, 'one valid cell filled');
check('auto-fill added exactly one valid cell (1 -> 2)', await evalJS(`${GIVENS}===2`));
await evalJS("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))");
await pollFor("!document.querySelector('.multi-dialog')", 'dialog closed');
check('Esc closes the dialog', await evalJS("!document.querySelector('.multi-dialog')"));

// B) Técnicas tab: cards + MiniBoard animation
check('clicked Técnicas tab', 'OK' === await evalJS(clickText('Técnicas')));
await pollFor("!!document.querySelector('.tecnicas')", 'tecnicas page', 12000);
check('Técnicas page renders', await evalJS("!!document.querySelector('.tecnicas')"));
check('shows technique cards (X-Wing + Candidata Única)', await evalJS("document.body.innerText.includes('X-Wing') && document.body.innerText.includes('Candidata Única')"));
check('has a mini board', await evalJS("!!document.querySelector('.mb-grid')"));
check('clicked ▶ Animar', 'OK' === await evalJS(clickText('Animar')));
await pollFor("!!document.querySelector('.mb-hl')", 'pattern frame');
check('animation highlights the pattern (frame 1)', await evalJS("!!document.querySelector('.mb-hl')"));
await pollFor("!!document.querySelector('.mb-place') || !!document.querySelector('.mb-elim')", 'conclusion frame', 6000);
check('animation reaches the conclusion (place/elim)', await evalJS("!!document.querySelector('.mb-place') || !!document.querySelector('.mb-elim')"));

// C) back to the solver
check('clicked Resolvedor tab', 'OK' === await evalJS(clickText('Resolvedor')));
await pollFor("!!document.querySelector('.board') && !document.querySelector('.tecnicas')", 'back to solver');
check('returns to the solver board', await evalJS("!!document.querySelector('.board') && !document.querySelector('.tecnicas')"));

const failed = results.filter(([, c]) => !c);
console.log(`\nSMOKE RESULT: ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) { console.log('FAILED: ' + failed.map(([n]) => n).join('; ')); process.exit(1); }
console.log('ALL SMOKE CHECKS PASSED');
process.exit(0);
