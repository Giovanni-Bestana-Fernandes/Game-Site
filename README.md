# Fuga da Nave

Platformer 2D feito em HTML5 Canvas + JavaScript puro (sem build step), separado em
**motor genérico** (reaproveitável em qualquer fase) + **conteúdo de cada fase** (só
dados: layout, textos, inimigos). Ver [Arquitetura](#arquitetura) pra criar uma fase nova.

**Lore (mock, edite à vontade):** alienígenas tentaram abduzir uma vaca para estudá-la,
mas por um erro de mira capturaram você. Na fase 1 você escapa do setor de contenção da
nave, desviando de robôs de segurança, alienígenas voadores e feixes de captura; perto do
fim, a vaca pede ajuda para libertar ela e as amigas — a escolha do jogador muda o final.
Na fase 2 (`js/levels/phase2.js`) a vaquinha já vem acompanhando desde o início, num
hangar diferente, e a meta é encontrar as amigas dela, escondidas num cercado perto do
fim — usando uma torre com trampolim (ativado a tiro) e um portão de pressão pelo
caminho. Na fase 3 (`js/levels/phase3.js`) as 4 vacas resgatadas seguem o jogador até o
hangar de embarque, guardado por um chefe de 3 estágios (dentro do robô solta criaturas →
armadura exposta soca e atira bolas de energia → ejetado, dispara feixes de abdução em
posições aleatórias) — as vacas são "capturadas" (somem da fila) assim que a luta começa,
e voltam quando o chefe morre, pra embarcarem na nave de fuga.

## Como rodar localmente

ES modules precisam ser servidos por HTTP (não abra o `index.html` direto com file://). Use qualquer servidor estático:

```bash
python -m http.server 8000
# ou
npx serve .
```

Depois acesse `http://localhost:8000`.

## Controles

- `A` / `D` — mover para os lados
- `S` — agachar
- `W` / `Espaço` — pular (pulo cheio a qualquer clique — sem "corte" de altura, com coyote time e buffer de pulo pra nunca travar)
- `Shift esquerdo` — correr
- `E` — interagir (terminais, NPC, botões, a saída)
- `F` — atirar com a pistola (mata robôs e alienígenas)
- `Q` / `W` / `E` segurando + `F` — mira diagonal-cima-esquerda / reto-cima / diagonal-cima-direita. Sem nenhum desses, atira na horizontal (pro lado que o personagem está de frente)
- `C` — comanda os companheiros (`level.companions`) a esperar parados no lugar ou voltar a seguir (alterna a cada aperto) — útil pra deixar um segurando um botão de pressão
- `ESC` — pausa o jogo e abre o painel de comandos

## Arquitetura

O projeto é dividido em duas camadas:

- **Motor** (`js/game.js`, `js/levelKit.js`, `js/entities.js`, `js/player.js`, `js/physics.js`, `js/input.js`, `js/camera.js`, `js/render.js`) — não sabe nada sobre nenhuma fase especificamente. Não tem "vaca", não tem números de coluna — só sabe consumir um objeto de nível genérico.
- **Conteúdo de fase** (`js/levels/phase1.js`, `js/levels/phase2.js`, `js/levels/phase3.js`) — só dados: onde fica cada coisa, que texto cada terminal/NPC tem, que robôs/alienígenas existem. Monta tudo chamando as funções do motor.

`js/main.js` é o bootstrap: importa a fase e liga ela no motor.

```js
// js/main.js
import { startGame } from './game.js';
import { createLevel3 } from './levels/phase3.js';

startGame(createLevel3);
```

### Como criar uma fase nova

1. Crie `js/levels/phaseN.js` copiando a estrutura de `js/levels/phase1.js`/`phase2.js`/`phase3.js` — mesma função `createLevelX()` retornando um objeto de nível (contrato abaixo), usando as mesmas funções de `levelKit.js` e classes de `entities.js` com números/textos diferentes. `level.tileColors` deixa o cenário com uma paleta própria sem duplicar `render.js` (cada fase até agora usa uma cor diferente: azul/ciano, verde, vermelho).
2. Troque o import em `js/main.js` para `createLevelN`, ou monte um seletor de fases (ex: um menu que chama `startGame(createLevel1)`, `startGame(createLevel2)` ou `startGame(createLevel3)` conforme a escolha).
3. Não precisa mexer em `game.js`, `levelKit.js`, `entities.js`, `player.js` nem `render.js` — a menos que a fase precise de uma mecânica **nova** (aí ela entra no motor, do mesmo jeito genérico que `EnergyBlock`/`Button`/`PuzzleBlock`/`Npc`/`Companion`/`Target`/`TrampolinePad`/`PressurePlate`/`Boss` já são).

### O contrato de um nível

Um objeto de nível (o que `createLevelX()` retorna) precisa ter estes campos pra `startGame` conseguir rodar:

| Campo | Tipo | Descrição |
|---|---|---|
| `grid`, `widthInTiles`, `heightInTiles`, `groundY`, `pixelWidth`, `pixelHeight`, `stars` | — | Geometria do mapa. Monte com `buildTileGrid`/`fillGroundRow`/`buildStarfield` (levelKit.js) |
| `playerStart` | `{x,y}` | Onde o jogador nasce |
| `energyCells` | `Array<{x,y,collected,hidden?,pickupRadius?}>` | Moedas soltas (proximidade pega). Use `buildPitCoinArc` pra moedas sobre buracos |
| `energyBlocks` | `Array<EnergyBlock>` | Blocos de cabeçada. Use `markFloatingBlock` + `new EnergyBlock(...)` |
| `terminals` | `Array<{x,y,width,height,text}>` | Placas de lore, só popup de texto no `E` |
| `buttonGates` | `Array<{button, gate}>` | Pares botão+portão. Monte com `createButtonGate` |
| `puzzles` | `Array<puzzle>` | Quebra-cabeças de memória. Monte com `createMemoryPuzzle` |
| `pressureGates?` | `Array<{plate, gate}>` | Portões que ficam abertos só enquanto tiver peso na plaquinha (jogador ou companheiro parado com o comando `C`). Monte com `createPressureGate` |
| `trampolines?` | `Array<{target, pad}>` | Alvo atirável + trampolim: acertar o alvo (bala) ativa o pad, que dá um impulso forte ao ser pisado. Monte com `createShootableTrampoline` |
| `corrals?` | `Array<{trigger, companions, released}>` | Grupo de companheiros parados até `E` no gatilho — aí entram todos de vez em `level.companions`. Monte com `createCorral` |
| `companions?` | `Array<Companion \| Npc>` | Fila de seguimento atual (pode já vir com companheiros presentes desde o início da fase, como a vaquinha na fase 2 ou o rebanho todo na fase 3). O motor encadeia: cada um segue o da frente (jogador → `companions[0]` → `companions[1]`...) |
| `minionWaves?` | `Array<{minions, gate, cleared}>` | Onda de inimigos (`Robot`/`Alien` reaproveitados) que precisa ser 100% eliminada pra abrir um portão sozinho. Monte com `createMinionWave` — **os mesmos objetos também precisam estar em `robots`/`aliens`** (é lá que o motor atualiza/desenha/testa bala; `minionWaves[].minions` só guarda a referência pra saber quando "todo mundo morreu") |
| `boss?` | `Boss \| null` | Chefe de 3 estágios (ver `new Boss({...})` em `entities.js`). Intangível até `bossTrigger` disparar o diálogo (ver abaixo) |
| `bossTrigger?` | `{x,y,width,height} \| null` | Retângulo que, ao ser tocado, abre o diálogo do chefe (texto alienígena → traduzido) e "captura" (remove) os companheiros atuais pra `level.capturedCompanions`, devolvidos quando o chefe morre |
| `bossExitGate?` | `gate \| null` | Portão opcional (`createGate`) que só abre quando o chefe morre — trava o acesso à saída até a luta acabar |
| `robots`, `aliens`, `tractorBeams` | `Array<Robot\|Alien\|TractorBeam>` | Perigos (mutáveis — o motor filtra os mortos) |
| `npc` | `Npc \| undefined` | NPC opcional com escolha (ver `new Npc({...})` em `entities.js`). Pode omitir se a fase não tiver NPC — nesse caso, se a fase já começa com companheiro(s), é só preencher `companions` direto (sem diálogo) |
| `exitHatch` | `{x,y,width,height}` | A saída/objetivo da fase |
| `victoryTitle`, `getVictoryText(level)` | `string`, `function` | Texto da tela de vitória |
| `tileColors?` | `{top,under,edge,bottom}` | Paleta dos tiles, se a fase quiser um cenário visualmente diferente do padrão azul/ciano |
| `pointsStarRatio?`, `timeStarLimitSeconds?`, `currencyLabel?` | opcionais | Sobrescrevem os padrões do motor (60%, 45s, "Células de energia") se a fase quiser outro ritmo/nome |

Todas as posições `buttonGates`/`puzzles`/`pressureGates`/`trampolines`/`corrals`/`companions`/`minionWaves`/`boss`/`bossTrigger`/`bossExitGate`/`robots`/`aliens`/`tractorBeams`/`npc`
são **arrays ou opcionais** (o motor aplica um padrão seguro de array vazio/`null` pras
novas em `resetGame`) — uma fase pode ter zero, um ou vários de cada, sem precisar tocar
no motor.

### Arquivos

- `index.html` — marcação, canvas, HUD, caixa de diálogo/escolha, painel de pausa e telas de fim de jogo (genérico, serve pra qualquer fase)
- `css/style.css` — estilo da página, HUD e overlays
- `js/input.js` — leitura de teclado
- `js/physics.js` — constantes de física (velocidade, gravidade, força do pulo, coyote time). `MAX_JUMP_HEIGHT`/`MAX_JUMP_AIR_TIME` são derivadas daqui e usadas por `levelKit.js` pra garantir que nada fique inalcançável
- `js/levelKit.js` — kit genérico de construção de nível: grid/plataformas/blocos (`buildTileGrid`, `fillGroundRow`, `buildWall`, `addPlatform`, `markFloatingBlock`), moedas equidistantes sobre buracos (`buildPitCoinArc`), parede-portão crua (`createGate`) usada por portão+botão (`createButtonGate`/`openGate`/`setGateOpen`), quebra-cabeça de memória (`createMemoryPuzzle`/`updateMemoryPuzzle`/`registerPuzzleHeadbump`), portão de pressão (`createPressureGate`), trampolim atirável (`createShootableTrampoline`), cercado (`createCorral`) e onda de minions (`createMinionWave`)
- `js/entities.js` — classes de perigos/objetos, todas genéricas: `Robot`/`Alien` (matáveis — `kill()`, ficam "mortos" 5s intangíveis e somem), `Projectile` (tiro do alienígena, da arma, ou de um chefe — cor configurável), `TractorBeam` (feixe de captura), `EnergyBlock` (revela e sobe a célula escondida), `PuzzleBlock`, `Button`, `Npc` (NPC genérico com escolha e visual injetado), `Companion` (companheiro sem diálogo, já pronto pra seguir — usado por cercados ou presente desde o início da fase), `Target`/`TrampolinePad` (alvo atirável + trampolim), `PressurePlate` (plaquinha de peso) e `Boss` (chefe de 3 estágios — dano/transição em `takeDamage`, ataque por estágio em `performAttack`) + `updateCompanionFollow` (encadeia a fila de seguimento — jogador → companheiro 1 → companheiro 2 → ...)
- `js/player.js` — física, movimento, colisão e pulo do personagem
- `js/camera.js` — câmera que segue o jogador; `camera.shake(duration, magnitude)` treme a tela sem afetar a posição "de verdade" (usado na entrada do chefe e nas trocas de estágio)
- `js/render.js` — desenho genérico do cenário/objetos no canvas (paleta de tiles sobrescrevível via `level.tileColors`, `drawCorral` pra cercados)
- `js/game.js` — **o motor**: loop, máquina de estados (`playing`/`paused`/`dialogue`/`bossintro`/`captured`/`gameover`/`dead`/`victory`), câmera, arma do jogador, captura pelo feixe, HUD, diálogo/escolha do NPC, portões/botões, quebra-cabeças, portões de pressão, trampolins, cercados, fila de companheiros, comando de esperar/seguir (`C`), onda de minions, diálogo/luta do chefe, perigos, morte, vitória — tudo parametrizado pelo objeto de nível, nada hardcoded de fase nenhuma
- `js/levels/phase1.js`, `js/levels/phase2.js`, `js/levels/phase3.js` — conteúdo específico de cada fase (a única coisa que muda de fase pra fase)
- `js/main.js` — bootstrap de 3 linhas: escolhe a fase e chama `startGame`

## Mecânicas do motor (genéricas, disponíveis pra qualquer fase)

- **Blocos de energia**: flutuam sozinhos sobre o caminho. Dar uma cabeçada por baixo revela a célula de energia escondida dentro — ela sobe pra cima do bloco e fica pegável normalmente. O bloco continua sólido depois de usado, só muda de aparência.
- **Botão + portão**: um interruptor ativado com `E` que abre um portão (parede sólida, mais alta que o pulo alcança). Uma fase pode ter vários pares (`level.buttonGates`); o motor cuida de todos genericamente.
- **Quebra-cabeça de memória**: N blocos acendem numa sequência fixa (estilo Simon); repetir de cabeçada abre um portão sólido — **obrigatório**, não dá pra pular por cima. Errar reinicia a demonstração; tentativas ilimitadas. Uma fase pode ter vários (`level.puzzles`).
- **Arma e inimigos matáveis**: `F` atira (mira com `Q`/`W`/`E`), mata `Robot`/`Alien`. Ao morrer, o inimigo fica intangível por 5s (visual de "morto") e some sozinho.
- **Captura pelo feixe**: encostar num `TractorBeam` não mata na hora — puxa o personagem (girando) até a origem do feixe ao longo de ~1.1s (`gameState = 'captured'`) e só depois mostra a morte.
- **NPC com escolha + companheiro**: `level.npc` (opcional) é um `Npc` genérico — visual injetado via `draw`, dois botões de escolha com labels/textos configuráveis. Se ajudado, entra em `level.companions` e passa a seguir o jogador.
- **Fila de companheiros**: `level.companions` é uma fila — cada um segue o da frente (jogador → `companions[0]` → `companions[1]` → ...), então dá pra ter vários formando uma fileira. Uma fase pode preencher `companions` desde o início (companheiro já presente, sem diálogo — só um `new Companion({...})`) e/ou ganhar mais depois via `npc` ajudado ou um `corral` liberado. Limitação atual: `updateCompanionFollow` só ajusta a posição X (sem gravidade nem colisão) — um companheiro atravessa buracos/portões flutuando na mesma altura em vez de cair/colidir, então mantenha o `y` dele em nível de chão.
- **Comando esperar/seguir (`C`)**: alterna `staying` em todos os companheiros de uma vez — parados, ficam exatamente onde estavam (útil pra segurar um portão de pressão) até o comando ser dado de novo.
- **Portão de pressão**: `level.pressureGates` fica aberto só enquanto o jogador OU algum companheiro estiver sobre a plaquinha (`rectOverlap` a cada frame, ver `updatePressureGates`) — ao contrário do portão de botão (que abre uma vez e fica aberto pra sempre), esse fecha assim que o peso sai. Dica de design: se o portão bloquear a altura de "em pé" do jogador, ele bloqueia também o caminho a pé — pra um bônus que não trava o progresso principal, prefira só bloquear as linhas *acima* da altura de chão (ver `js/levels/phase2.js`), deixando o portão controlar só o acesso a um pulo extra, nunca o corredor principal.
- **Trampolim atirável**: `level.trampolines` só quica de verdade depois que o `Target` correspondente é atingido por uma bala (`F`) — antes disso o pad fica inerte. O impulso (`TRAMPOLINE_BOUNCE_VELOCITY`) é bem mais forte que o pulo normal, pensado pra alcançar alturas maiores que `MAX_JUMP_HEIGHT`.
- **Cercado**: `level.corrals` é um grupo de companheiros parados até `E` no gatilho — nesse momento todos entram de uma vez em `level.companions`, na ordem em que estavam no array.
- **Onda de minions**: `level.minionWaves` trava um portão até TODOS os inimigos da leva morrerem (`checkMinionWaves`, verifica a cada frame). Os inimigos são `Robot`/`Alien` normais — **precisam estar em `level.robots`/`level.aliens` também**, senão não são atualizados/desenhados/atingidos por bala (só ficariam "penduradas" na onda sem nunca poder morrer).
- **Chefe de 3 estágios**: `level.boss` é intangível até o jogador tocar `level.bossTrigger`, que abre um diálogo (texto alienígena ilegível, trocado sozinho pra tradução depois de ~2.2s, sem escolha) e "captura" os companheiros atuais (somem de `level.companions` pra `level.capturedCompanions`, restaurados quando o chefe morre). Cada bala do jogador tira `BOSS_BULLET_DAMAGE` da vida; ao cruzar 66%/33% da vida máxima o chefe muda de estágio (e cada estágio ataca diferente — ver `Boss.performAttack` em `entities.js`: estágio 1 solta uma "criatura" mirada no jogador, estágio 2 alterna soco/bola de energia, estágio 3 dispara `TractorBeam`s em posições aleatórias da arena, reaproveitando o mesmo perigo de feixe de captura). Ao derrotar, o motor limpa os feixes/projéteis ainda no ar (`handleBossDefeated`) — sem isso, um feixe do estágio 3 podia continuar ativo e matar o jogador depois da luta já ter acabado. `level.bossExitGate` (opcional) só abre quando o chefe morre, travando o acesso à saída até vencer a luta.
- **Morte**: qualquer perigo mostra só o título **"VOCÊ MORREU!"** — sem estrelas, sem texto extra.
- **Vitória**: mostra `level.victoryTitle` + `level.getVictoryText(level)` com 3 estrelas — proporção de energia coletada, tempo, e uma fixa (limites ajustáveis via `level.pointsStarRatio`/`level.timeStarLimitSeconds`).
- **Pausa (`ESC`)**: congela toda a simulação e mostra o painel de comandos.

Todo o conteúdo de `js/levels/phase1.js`/`phase2.js`/`phase3.js` (posições, textos,
robôs, o visual das vacas, o chefe) é só um ponto de partida — ajuste à vontade sem medo
de afetar outras fases.
