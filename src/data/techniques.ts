// The 25 catalogued Sudoku techniques, organized into 8 levels (see docs/tecnicas_sudoku.md).
// `implemented` = the solver uses it; `caseKey` points to an animated example in CASES.
export type Technique = {
  n: number;
  namePt: string;
  nameEn: string;
  level: number;
  implemented: boolean;
  text: string;
  caseKey?: string;
};

export const LEVELS: { n: number; title: string }[] = [
  { n: 1, title: 'Singles — colocam números' },
  { n: 2, title: 'Subconjuntos — eliminam candidatos' },
  { n: 3, title: 'Interseções — bloco ↔ linha/coluna' },
  { n: 4, title: 'Peixes (Fish) — padrões sobre um dígito' },
  { n: 5, title: 'Asas (Wings) — pequenas cadeias' },
  { n: 6, title: 'Coloração e cadeias' },
  { n: 7, title: 'Padrões de unicidade' },
  { n: 8, title: 'Último recurso' },
];

export const CONCEPTS: { term: string; def: string }[] = [
  { term: 'Célula', def: 'Cada um dos 81 quadradinhos (notação rXcY = linha X, coluna Y).' },
  { term: 'Unidade', def: 'Uma linha, uma coluna ou um bloco 3×3 — cada uma com os dígitos 1–9.' },
  { term: 'Candidato', def: 'Um dígito que ainda pode entrar numa célula vazia.' },
  { term: 'Peer', def: 'As 20 células que dividem linha, coluna ou bloco com uma célula.' },
];

export const TECHNIQUES: Technique[] = [
  // Nível 1 — Singles
  {
    n: 1, namePt: 'Candidata Única', nameEn: 'Naked Single', level: 1, implemented: true,
    caseKey: 'naked-single',
    text: 'Uma célula em que sobrou apenas um candidato — os outros 8 dígitos já aparecem na linha, coluna ou bloco dela. Escreva esse dígito.',
  },
  {
    n: 2, namePt: 'Único Lugar', nameEn: 'Hidden Single', level: 1, implemented: true,
    caseKey: 'hidden-single',
    text: 'Um dígito que, dentro de uma unidade, só cabe numa única célula — mesmo que essa célula ainda tenha outros candidatos.',
  },
  // Nível 2 — Subconjuntos
  {
    n: 3, namePt: 'Par Nu', nameEn: 'Naked Pair', level: 2, implemented: true,
    caseKey: 'naked-pair',
    text: 'Duas células de uma unidade têm exatamente os mesmos 2 candidatos. Esses dígitos ficam presos a elas → remova-os das demais células da unidade.',
  },
  {
    n: 4, namePt: 'Trio Nu', nameEn: 'Naked Triple', level: 2, implemented: true,
    caseKey: 'naked-triple',
    text: 'Três células cujos candidatos, juntos, somam apenas 3 dígitos. Remova esses 3 dígitos das outras células da unidade.',
  },
  {
    n: 5, namePt: 'Quadra Nua', nameEn: 'Naked Quad', level: 2, implemented: true,
    caseKey: 'naked-quad',
    text: 'O mesmo princípio com 4 células e 4 dígitos. Rara, mas idêntica em ideia ao par e ao trio nus.',
  },
  {
    n: 6, namePt: 'Par Escondido', nameEn: 'Hidden Pair', level: 2, implemented: true,
    caseKey: 'hidden-pair',
    text: 'Dois dígitos que só cabem nas mesmas 2 células de uma unidade. Essas células ficam restritas a esses 2 dígitos → apague os demais candidatos delas.',
  },
  {
    n: 7, namePt: 'Trio Escondido', nameEn: 'Hidden Triple', level: 2, implemented: true,
    caseKey: 'hidden-triple',
    text: 'Três dígitos que só cabem nas mesmas 3 células. Restrinja essas células a esses 3 dígitos.',
  },
  {
    n: 8, namePt: 'Quadra Escondida', nameEn: 'Hidden Quad', level: 2, implemented: true,
    caseKey: 'hidden-quad',
    text: 'Quatro dígitos que só cabem nas mesmas 4 células.',
  },
  // Nível 3 — Interseções
  {
    n: 9, namePt: 'Interseção (Pointing)', nameEn: 'Pointing', level: 3, implemented: true,
    caseKey: 'pointing',
    text: 'Dentro de um bloco, se todos os candidatos de um dígito caem numa única linha ou coluna, ele deve ficar ali → remova-o do resto dessa linha/coluna, fora do bloco.',
  },
  {
    n: 10, namePt: 'Interseção (Claiming)', nameEn: 'Box-Line Reduction', level: 3, implemented: true,
    caseKey: 'claiming',
    text: 'O inverso do pointing: numa linha ou coluna, se um dígito só aparece dentro de um único bloco, remova-o das outras células desse bloco.',
  },
  // Nível 4 — Peixes
  {
    n: 11, namePt: 'X-Wing', nameEn: 'X-Wing', level: 4, implemented: true,
    caseKey: 'x-wing',
    text: 'Um dígito aparece em exatamente 2 colunas de 2 linhas, formando um retângulo. Nessas colunas ele só pode estar nessas linhas → remova-o delas nas demais linhas (vale trocando linhas por colunas).',
  },
  {
    n: 12, namePt: 'Swordfish', nameEn: 'Swordfish', level: 4, implemented: false,
    caseKey: 'swordfish',
    text: 'Como o X-Wing, mas com 3 linhas × 3 colunas. Mais difícil de enxergar; quando é necessária, o solver completa por backtracking.',
  },
  {
    n: 13, namePt: 'Jellyfish', nameEn: 'Jellyfish', level: 4, implemented: false,
    text: 'A versão 4 linhas × 4 colunas do mesmo padrão de peixe.',
  },
  // Nível 5 — Asas
  {
    n: 14, namePt: 'Y-Wing', nameEn: 'XY-Wing', level: 5, implemented: false,
    caseKey: 'y-wing',
    text: 'Três células bivalor: um pivô XY e duas pontas XZ e YZ. Qualquer que seja o valor do pivô, uma ponta será Z → remova Z das células vistas por ambas as pontas.',
  },
  {
    n: 15, namePt: 'XYZ-Wing', nameEn: 'XYZ-Wing', level: 5, implemented: false,
    text: 'Variante em que o pivô tem 3 candidatos (XYZ) e vê as duas pontas; elimina-se Z das células comuns às três.',
  },
  {
    n: 16, namePt: 'W-Wing', nameEn: 'W-Wing', level: 5, implemented: false,
    text: 'Duas células bivalor iguais (XY) ligadas por uma ligação forte de um dígito, permitindo eliminar o outro dígito de certas células.',
  },
  // Nível 6 — Coloração e cadeias
  {
    n: 17, namePt: 'Coloração Simples', nameEn: 'Simple Coloring', level: 6, implemented: false,
    text: 'Para um dígito, pinta-se a rede de ligações fortes com 2 cores alternadas. Se duas células da mesma cor se enxergam, aquela cor é impossível.',
  },
  {
    n: 18, namePt: '3D Medusa', nameEn: '3D Medusa', level: 6, implemented: false,
    text: 'Coloração estendida que mistura vários dígitos e células ao mesmo tempo.',
  },
  {
    n: 19, namePt: 'X-Cycles', nameEn: 'X-Cycles', level: 6, implemented: false,
    text: 'Ciclos de ligações fortes e fracas de um único dígito que geram eliminações.',
  },
  {
    n: 20, namePt: 'XY-Chain', nameEn: 'XY-Chain', level: 6, implemented: false,
    text: 'Cadeia de células bivalor encadeadas que força eliminações nas pontas.',
  },
  {
    n: 21, namePt: 'Cadeias Forçadas', nameEn: 'Forcing Chains', level: 6, implemented: false,
    text: 'Testa-se uma hipótese numa célula e segue-se a cadeia de consequências; se caminhos diferentes levam à mesma conclusão, ela é verdadeira.',
  },
  {
    n: 22, namePt: 'Nishio', nameEn: 'Nishio', level: 6, implemented: false,
    text: 'Assume-se um candidato e verifica-se se ele leva a uma contradição; se levar, descarta-se. Quase um "chute controlado".',
  },
  // Nível 7 — Unicidade
  {
    n: 23, namePt: 'Retângulo Único', nameEn: 'Unique Rectangle', level: 7, implemented: false,
    text: 'Evita configurações de 4 células e 2 dígitos que dariam duas soluções; elimina o candidato que criaria a ambiguidade.',
  },
  {
    n: 24, namePt: 'BUG', nameEn: 'Bivalue Universal Grave', level: 7, implemented: false,
    text: 'Se quase todas as células ficaram com 2 candidatos, o único candidato "extra" restante tem de ser o valor daquela célula.',
  },
  // Nível 8 — Último recurso
  {
    n: 25, namePt: 'Backtracking', nameEn: 'Força Bruta', level: 8, implemented: true,
    text: 'Tentativa e erro sistemática: testa um candidato e avança; ao bater num beco sem saída, volta e tenta o próximo. Sempre resolve, mas não "explica" nada — o solver só recorre a ela quando a lógica empaca (e avisa). Também confirma que o puzzle tem solução única.',
  },
];
