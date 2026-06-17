# Técnicas de Resolução de Sudoku — Referência

Este documento explica as principais técnicas usadas para resolver Sudoku **com
lógica** (sem chutar). Não existe um número "oficial" de técnicas — fontes
diferentes contam de formas diferentes (o site *SudokuWiki* cataloga ~38). Aqui
estão as **~25 técnicas mais consagradas**, organizadas em níveis crescentes de
dificuldade.

No nosso puzzle foram necessárias **5 técnicas**, marcadas com 🟢 abaixo:
Candidata única, Único lugar, Interseção (pointing), Interseção (claiming) e Par
escondido.

Legenda dos marcadores:
- **🟢 Usada neste puzzle**
- **✅ Implementada no solver** (`sudoku_solver.py`)
- **⬜ Não implementada** — se o puzzle exigisse, o solver cairia no *backtracking*

---

## Conceitos que você precisa conhecer antes

- **Célula**: cada um dos 81 quadradinhos (notação `rXcY` = linha X, coluna Y).
- **Unidade**: uma linha, uma coluna **ou** um bloco 3×3. Cada unidade deve conter
  os dígitos 1–9 sem repetição.
- **Candidato**: um dígito que ainda *pode* entrar numa célula vazia (não foi
  descartado pelas unidades dela). Toda técnica trabalha **eliminando candidatos**
  ou **confirmando um dígito** quando só resta uma possibilidade.
- **Peer (parceira)**: as 20 células que compartilham linha, coluna ou bloco com
  uma dada célula. Um número numa célula proíbe esse número em todas as suas peers.

As técnicas dividem-se em dois efeitos:
1. **Colocam um número** (singles).
2. **Eliminam candidatos** para destravar singles depois (todas as outras).

---

## Nível 1 — Singles (as únicas que colocam números)

### 1. Candidata Única — *Naked Single* 🟢 ✅
Uma célula em que sobrou **apenas um candidato**. Os outros 8 dígitos já aparecem
na linha, coluna ou bloco dela, então só há uma opção.

> Ex.: se `r5c5` só pode ser `1`, escreva `1` ali.

### 2. Único Lugar — *Hidden Single* 🟢 ✅
Um dígito que, dentro de uma unidade (linha, coluna ou bloco), só **cabe numa
única célula** — mesmo que aquela célula tenha outros candidatos.

> Ex.: se na linha 1 o `1` só pode entrar em `r1c6`, então `r1c6 = 1`.

---

## Nível 2 — Subconjuntos (eliminam candidatos)

A ideia: *N* células de uma unidade "reservam" *N* dígitos entre si, liberando
(ou restringindo) o resto da unidade.

### 3. Par Nu — *Naked Pair* ✅
Duas células de uma unidade têm **exatamente os mesmos 2 candidatos** (ex.: ambas
só aceitam `{4,7}`). Esses 2 dígitos ficam "presos" nessas duas células →
remova-os das demais células da unidade.

### 4. Trio Nu — *Naked Triple* ✅
Três células cujos candidatos, **juntos**, formam só 3 dígitos (cada célula pode
ter 2 ou 3 deles). Remova esses 3 dígitos das outras células da unidade.

### 5. Quadra Nua — *Naked Quad* ✅
O mesmo com 4 células e 4 dígitos. Rara, mas o princípio é idêntico.

### 6. Par Escondido — *Hidden Pair* 🟢 ✅
Dois dígitos que, numa unidade, **só cabem nas mesmas 2 células** (essas células
podem ter outros candidatos "por cima"). Essas 2 células ficam **restritas a esses
2 dígitos** → apague os demais candidatos delas.

> Foi o "nó" do nosso puzzle (passo 22): na linha 6, o `1` e o `2` só cabiam em
> `r6c2` e `r6c7`, então tiramos o `7` e o `9` dessas células.

### 7. Trio Escondido — *Hidden Triple* ✅
Três dígitos que só cabem nas mesmas 3 células. Restrinja essas células a esses
3 dígitos.

### 8. Quadra Escondida — *Hidden Quad* ✅
Quatro dígitos que só cabem nas mesmas 4 células.

---

## Nível 3 — Interseções (bloco ↔ linha/coluna)

### 9. Interseção *Pointing* (bloco → linha/coluna) 🟢 ✅
Dentro de um **bloco**, se todos os candidatos de um dígito caem numa **única
linha (ou coluna)**, então esse dígito tem de ficar nessa linha/coluna *dentro do
bloco* → remova-o do resto dessa linha/coluna (fora do bloco).

> Ex. (passo 18): no bloco 3, o `2` só aparece na linha 3 → tira-se o `2` de
> `r3c3`.

### 10. Interseção *Claiming* / Redução Bloco-Linha — *Box-Line Reduction* 🟢 ✅
O inverso: numa **linha (ou coluna)**, se todos os candidatos de um dígito caem
**dentro de um único bloco**, então remova esse dígito das outras células daquele
bloco.

> Ex. (passo 21): na coluna 2, o `2` só cabia no bloco 4 → tirou-se o `2` das
> outras células do bloco.

---

## Nível 4 — "Peixes" (*Fish*) — padrões sobre **um único dígito**

### 11. X-Wing ✅
Um dígito aparece em **exatamente 2 colunas** de **2 linhas diferentes**, formando
um retângulo. Então, nessas 2 colunas, o dígito só pode estar nessas 2 linhas →
remova-o dessas colunas em todas as **outras** linhas. (Vale também na versão
trocando linhas por colunas.)

### 12. Swordfish ⬜
Como o X-Wing, mas com **3 linhas × 3 colunas**. Mais difícil de enxergar.

### 13. Jellyfish ⬜
A versão com **4 linhas × 4 colunas**.

*(Squirmbag, 5×5, existe mas quase nunca é necessária.)*

---

## Nível 5 — "Asas" (*Wings*) — pequenas cadeias

### 14. Y-Wing / XY-Wing ⬜
Três células bivalor (com 2 candidatos cada) formando um "pivô" `XY` e duas
"pontas" `XZ` e `YZ`. Qualquer que seja o valor do pivô, uma das pontas será `Z`
→ remova `Z` das células enxergadas por **ambas** as pontas.

### 15. XYZ-Wing ⬜
Variante em que o pivô tem 3 candidatos (`XYZ`) e enxerga as duas pontas;
elimina-se `Z` das células comuns às três.

### 16. W-Wing ⬜
Duas células bivalor iguais (`XY`) ligadas por uma "ligação forte" de um dígito;
permite eliminar o outro dígito de certas células.

---

## Nível 6 — Coloração e cadeias

### 17. Coloração Simples — *Simple Coloring / Singles Chains* ⬜
Para um dígito, pinta-se a rede de "ligações fortes" com 2 cores alternadas. Se
duas células da **mesma cor** se enxergam, aquela cor é impossível.

### 18. 3D Medusa ⬜
Coloração estendida que mistura vários dígitos e células ao mesmo tempo.

### 19. X-Cycles ⬜
Ciclos de ligações fortes/fracas de um dígito que geram eliminações.

### 20. XY-Chain ⬜
Cadeia de células bivalor encadeadas que força eliminações nas pontas.

### 21. Cadeias Forçadas — *Forcing Chains* ⬜
Testa-se uma hipótese numa célula e segue-se a cadeia de consequências; se dois
caminhos levam à mesma conclusão, ela é verdadeira.

### 22. Nishio ⬜
Assume-se um candidato e verifica-se se ele leva a uma contradição (se levar,
descarta-se). É quase um "chute controlado".

---

## Nível 7 — Padrões de unicidade

*(Assumem que o puzzle tem solução única — usam isso a favor.)*

### 23. Retângulo Único — *Unique Rectangle* ⬜
Evita configurações de 4 células / 2 dígitos que dariam **duas** soluções;
elimina o candidato que criaria a ambiguidade.

### 24. BUG — *Bivalue Universal Grave* ⬜
Se quase todas as células ficaram com 2 candidatos, o único candidato "extra"
restante tem de ser o valor daquela célula (senão haveria múltiplas soluções).

---

## Nível 8 — Último recurso

### 25. Backtracking / Força Bruta ✅ (apenas como rede de segurança)
Tentativa e erro sistemática: escolhe-se uma célula, testa-se um candidato e
avança-se; ao bater num beco sem saída, **volta atrás** e tenta o próximo. Sempre
encontra a solução, mas **não "explica"** nada — por isso o nosso solver só recorre
a ela se as técnicas lógicas empacarem (e avisa quando isso acontece). Também é o
método usado internamente para confirmar que o puzzle tem **solução única**.

---

## Resumo

| # | Técnica (PT / EN) | Nível | No solver | Neste puzzle |
|---|---|---|:---:|:---:|
| 1 | Candidata única / *Naked Single* | 1 | ✅ | 🟢 |
| 2 | Único lugar / *Hidden Single* | 1 | ✅ | 🟢 |
| 3 | Par nu / *Naked Pair* | 2 | ✅ | |
| 4 | Trio nu / *Naked Triple* | 2 | ✅ | |
| 5 | Quadra nua / *Naked Quad* | 2 | ✅ | |
| 6 | Par escondido / *Hidden Pair* | 2 | ✅ | 🟢 |
| 7 | Trio escondido / *Hidden Triple* | 2 | ✅ | |
| 8 | Quadra escondida / *Hidden Quad* | 2 | ✅ | |
| 9 | Interseção pointing | 3 | ✅ | 🟢 |
| 10 | Interseção claiming / *Box-Line* | 3 | ✅ | 🟢 |
| 11 | X-Wing | 4 | ✅ | |
| 12 | Swordfish | 4 | ⬜ | |
| 13 | Jellyfish | 4 | ⬜ | |
| 14 | Y-Wing / XY-Wing | 5 | ⬜ | |
| 15 | XYZ-Wing | 5 | ⬜ | |
| 16 | W-Wing | 5 | ⬜ | |
| 17 | Coloração simples | 6 | ⬜ | |
| 18 | 3D Medusa | 6 | ⬜ | |
| 19 | X-Cycles | 6 | ⬜ | |
| 20 | XY-Chain | 6 | ⬜ | |
| 21 | Cadeias forçadas | 6 | ⬜ | |
| 22 | Nishio | 6 | ⬜ | |
| 23 | Retângulo único | 7 | ⬜ | |
| 24 | BUG | 7 | ⬜ | |
| 25 | Backtracking | 8 | ✅¹ | |

¹ Só como rede de segurança e para checar unicidade.

**O solver implementa as técnicas dos níveis 1–4** (11 técnicas lógicas) — o que
resolve a grande maioria dos puzzles de jornal (fácil a difícil). Puzzles "evil"
ou de competição podem exigir os níveis 5–7; nesses casos, o solver completa por
backtracking e avisa no protocolo.
