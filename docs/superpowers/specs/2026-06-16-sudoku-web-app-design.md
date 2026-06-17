# Design — Sudoku Web App

**Data:** 2026-06-16
**Status:** aprovado (brainstorming)

## Objetivo

Web app simples onde a pessoa preenche um Sudoku 9×9, clica em **Resolver**, e o
app resolve no próprio navegador e mostra a **solução** junto com a **explicação
passo a passo** de cada dedução — reproduzindo na tela a mesma lógica e linguagem
do protocolo que já geramos com `sudoku/scripts/sudoku_solver.py`.

## Decisões (resumo)

| Tema | Decisão |
|---|---|
| Tamanho de grade | **Apenas 9×9 clássico** (blocos 3×3) |
| Execução | **Online**, deploy na **Vercel**, repo: https://github.com/hugogontijomachado/sudoku-solver |
| Arquitetura | **Front-end estático** (sem backend); solver portado para TypeScript roda no navegador |
| Stack | **React + Vite + TypeScript** |
| Explicação | **Padrão = passo a passo interativo** (destaque na grade) **+** botão para **ver/baixar PDF** com a explicação estática completa |
| Idioma | Português |
| Design | Segue `DESIGN.md` (fonte de verdade): fundo quase preto `#0a0a0a` + amarelo elétrico `#faff69`, tipografia Inter / JetBrains Mono |

## Arquitetura

**Princípio central:** separar o **domínio** (solver) da **UI** (React). O solver é
TypeScript puro, sem dependência de React, testável isoladamente. A UI apenas
consome o resultado.

**Fluxo geral:** app 100% client-side. Usuário preenche a grade → "Resolver" → o
solver devolve `SolveResult` → a UI reproduz os passos com destaque na grade e
oferece ver/baixar o PDF.

### Contrato do solver (interface domínio ↔ UI)

```ts
type Grid = number[][];               // 9×9, 0 = vazia

type Step = {
  technique: string;                  // ex.: "Par escondido"
  text: string;                       // explicação em PT (igual ao protocolo)
  placements?: { r: number; c: number; d: number }[];   // células preenchidas
  eliminations?: { r: number; c: number; d: number }[]; // candidatos removidos
  highlight: { r: number; c: number }[];                // células a destacar
};

type SolveResult = {
  solution: Grid;
  steps: Step[];
  unique: boolean;
  usedBacktracking: boolean;
};

function solve(grid: Grid): SolveResult;   // puro, síncrono
```

### Portagem do solver

Tradução fiel de `sudoku/scripts/sudoku_solver.py` para TS, mantendo:
- conjuntos de candidatos por célula (mantidos incrementalmente via `PEERS`/`UNITS`);
- `TECHNIQUES` como lista ordenada **da mais fácil para a mais difícil**, reiniciando
  do topo após qualquer progresso (a técnica mais simples aplicável é sempre a
  exibida);
- técnicas implementadas: candidata única, único lugar, pares/trios/quadras nus e
  escondidos, interseção *pointing*, interseção *claiming*, X-Wing;
- backtracking **apenas como fallback sinalizado** + verificação de unicidade;
- notação de coordenadas `rXcY` (linha, depois coluna, base 1).

O `sudoku_solver.py` (já validado) é a **implementação de referência** e o **oráculo
de teste** (ver Testes).

### Estrutura do repositório (`sudoku-solver`)

```
sudoku-solver/
  src/
    solver/              # DOMÍNIO PURO (sem React)
      grid.ts            # tipos, parse, geometria (units/peers)
      candidates.ts      # conjuntos de candidatos
      techniques.ts      # singles, subsets, pointing, claiming, x-wing
      solve.ts           # driver + geração dos steps (protocolo)
      solver.test.ts     # Vitest
    components/
      Board.tsx          # grade 9×9 editável + destaque
      Cell.tsx
      Toolbar.tsx        # Resolver · Limpar · Exemplo
      StepPlayer.tsx     # passo a passo: ◀ Anterior / Próximo ▶ / ⏯ Auto + texto
      ProtocolView.tsx   # lista estática + botão "Baixar PDF"
    styles/tokens.css    # variáveis CSS derivadas do DESIGN.md
    App.tsx · main.tsx
  index.html · package.json · vite.config.ts
  DESIGN.md              # fonte de verdade do design, copiada para o repo
```

A pasta `sudoku-solver/` é criada dentro deste projeto e inicializada como repositório
git próprio (será um repo separado no GitHub). O `DESIGN.md` acompanha o repo.

## UI / UX

Layout aprovado (mockup validado no companion visual):

- **Topo:** wordmark "Sudoku Solver" + badge "9×9".
- **Esquerda:** a **grade 9×9** em cartão escuro. Cores das células:
  - **pista digitada** → branco forte (`--ink`);
  - **preenchida pelo solver** → cinza (`--body`);
  - **passo atual** → fundo amarelo (`--primary`), texto preto;
  - a **unidade analisada** no passo recebe um leve tom amarelado de fundo.
  - legenda das cores abaixo da grade.
- **Direita:** painel de passo a passo:
  - barra de ações: **Resolver** (amarelo) · **Limpar** · **Exemplo**;
  - cartão do passo: contador `PASSO NN / total`, pílula da técnica, texto da
    dedução, barra de progresso, controles **◀ Anterior / Próximo ▶ / ⏯ Auto**;
  - rodapé do cartão: link **"Ver explicação completa (lista)"** + botão
    **⬇ Baixar PDF**;
  - cartão de **Status**: solução única?, resolvido só com lógica?, nº de técnicas.

O amarelo é usado **só como destaque** (passo atual, CTAs, números de status),
conforme a regra do `DESIGN.md`. Todos os valores visuais vêm dos tokens
(`{colors.*}`, `{typography.*}`, etc.), nunca inline.

## Fluxo de dados e estado (React)

- Estado central no `App`: `cells` (matriz 9×9 digitada), `result`
  (`SolveResult | null`), `stepIndex`, `mode` (`'edit' | 'solved'`).
- **Edição:** clica na célula → digita 1–9 (ou apaga); navegação por setas;
  caracteres inválidos ignorados.
- **Resolver:** valida → `solve()` → guarda `result`, `mode='solved'`, `stepIndex=0`.
- **StepPlayer:** o estado da grade no passo *N* é **derivado** aplicando os
  `placements` dos passos `0..N` sobre as pistas; o destaque vem de
  `step.highlight`. "Auto" avança com `setInterval`.
- **Limpar/Editar:** volta a `mode='edit'`.

**PDF (no cliente):** monta o protocolo completo em HTML e usa `window.print()` com
um CSS de impressão dedicado — zero dependências, fiel ao design. (Alternativa
considerada: `jsPDF`. Recomendação: print-to-PDF; decisão final na implementação.)

## Tratamento de erros / casos de borda

- **Pistas contraditórias** (dígito repetido em unidade) → células em conflito em
  vermelho (`--accent-rose`); "Resolver" bloqueado com mensagem.
- **Insolúvel** (pistas válidas, sem solução) → mensagem clara.
- **Solução múltipla** → resolve mesmo assim e exibe banner de aviso.
- **Grade vazia/insuficiente** → "Resolver" desabilitado.
- **Lógica empaca** (exigiria backtracking) → resolve, mas marca os passos finais
  como "completado por tentativa e erro" e avisa (igual ao solver Python).

## Testes (Vitest, sobre o solver puro)

- **Teste de ouro:** o puzzle desta conversa → solução exata
  (`472531869859642317163987254318726495597314682624859173936478521741265938285193746`)
  + `unique === true` + validação de todas as linhas/colunas/blocos.
- Casos extras: um fácil; um que exige **par escondido**; um **insolúvel** (espera
  erro); um com **múltiplas soluções** (espera `unique === false`).
- Teste de componente leve (opcional): a grade renderiza, digitar atualiza,
  "Resolver" popula os passos.

## Deploy

- Repo `sudoku-solver` (https://github.com/hugogontijomachado/sudoku-solver) → conectado à Vercel.
- Build: `vite build`; saída: `dist/`. Deploy automático a cada push.
- Sem variáveis de ambiente, sem backend.

## Fora de escopo (YAGNI)

- Outros tamanhos de grade (4×4, 6×6) e variantes com letras.
- Leitura de Sudoku por foto/OCR.
- Contas de usuário, salvar/histórico, geração de novos puzzles.
- Backend / funções serverless.

## Referências

- `DESIGN.md` — design system (fonte de verdade visual).
- `sudoku/scripts/sudoku_solver.py` — implementação de referência do solver.
- `tecnicas_sudoku.md` — catálogo das técnicas por nível.
- `solucao_protocolo.md` — exemplo de protocolo gerado.
