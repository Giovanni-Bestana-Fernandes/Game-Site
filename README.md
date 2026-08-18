# Fuga da Nave

Platformer 2D feito em HTML5 Canvas + JavaScript puro (sem build step), separado em
**motor genérico** (reaproveitável em qualquer fase) + **conteúdo de cada fase** (só
dados: layout, textos, inimigos). Ver [Arquitetura](#arquitetura) pra criar a fase 2.

**Lore da fase 1 (mock, edite à vontade):** alienígenas tentaram abduzir uma vaca para
estudá-la, mas por um erro de mira capturaram você. Agora você precisa escapar do setor
de contenção da nave, desviando de robôs de segurança, alienígenas voadores e feixes de
captura. Perto do fim da fase, uma vaca pede sua ajuda para libertar ela e as amigas — a
escolha do jogador muda o final.

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
- `ESC` — pausa o jogo e abre o painel de comandos

## Arquitetura

O projeto é dividido em duas camadas:

- **Motor** (`js/game.js`, `js/levelKit.js`, `js/entities.js`, `js/player.js`, `js/physics.js`, `js/input.js`, `js/camera.js`, `js/render.js`) — não sabe nada sobre a fase 1 especificamente. Não tem "vaca", não tem números de coluna — só sabe consumir um objeto de nível genérico.
- **Conteúdo de fase** (`js/levels/phase1.js`) — só dados: onde fica cada coisa, que texto cada terminal/NPC tem, que robôs/alienígenas existem. Monta tudo chamando as funções do motor.

`js/main.js` é o bootstrap: importa a fase e liga ela no motor.

```js
// js/main.js
import { startGame } from './game.js';
import { createLevel1 } from './levels/phase1.js';

startGame(createLevel1);
```

### Como criar a fase 2

1. Crie `js/levels/phase2.js` copiando a estrutura de `js/levels/phase1.js` — mesma função `createLevelX()` retornando um objeto de nível (contrato abaixo), usando as mesmas funções de `levelKit.js` e classes de `entities.js` com números/textos diferentes.
2. Troque o import em `js/main.js` para `createLevel2`, ou monte um seletor de fases (ex: um menu que chama `startGame(createLevel1)` ou `startGame(createLevel2)` conforme a escolha).
3. Não precisa mexer em `game.js`, `levelKit.js`, `entities.js`, `player.js` nem `render.js` — a menos que a fase 2 precise de uma mecânica **nova** (aí ela entra no motor, do mesmo jeito genérico que `EnergyBlock`/`Button`/`PuzzleBlock`/`Npc` já são).

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
| `robots`, `aliens`, `tractorBeams` | `Array<Robot\|Alien\|TractorBeam>` | Perigos (mutáveis — o motor filtra os mortos) |
| `npc` | `Npc \| undefined` | NPC opcional com escolha (ver `new Npc({...})` em `entities.js`). Pode omitir se a fase não tiver NPC |
| `exitHatch` | `{x,y,width,height}` | A saída/objetivo da fase |
| `victoryTitle`, `getVictoryText(level)` | `string`, `function` | Texto da tela de vitória |
| `pointsStarRatio?`, `timeStarLimitSeconds?`, `currencyLabel?` | opcionais | Sobrescrevem os padrões do motor (60%, 45s, "Células de energia") se a fase quiser outro ritmo/nome |

Todas as posições `buttonGates`/`puzzles`/`robots`/`aliens`/`tractorBeams`/`npc` são
**arrays ou opcionais** — uma fase pode ter zero, um ou vários de cada, sem precisar
tocar no motor.

### Arquivos

- `index.html` — marcação, canvas, HUD, caixa de diálogo/escolha, painel de pausa e telas de fim de jogo (genérico, serve pra qualquer fase)
- `css/style.css` — estilo da página, HUD e overlays
- `js/input.js` — leitura de teclado
- `js/physics.js` — constantes de física (velocidade, gravidade, força do pulo, coyote time). `MAX_JUMP_HEIGHT`/`MAX_JUMP_AIR_TIME` são derivadas daqui e usadas por `levelKit.js` pra garantir que nada fique inalcançável
- `js/levelKit.js` — kit genérico de construção de nível: grid/plataformas/blocos (`buildTileGrid`, `fillGroundRow`, `addPlatform`, `markFloatingBlock`), moedas equidistantes sobre buracos (`buildPitCoinArc`), portão+botão (`createButtonGate`/`openGate`) e quebra-cabeça de memória (`createMemoryPuzzle`/`updateMemoryPuzzle`/`registerPuzzleHeadbump`)
- `js/entities.js` — classes de perigos/objetos, todas genéricas: `Robot`/`Alien` (matáveis — `kill()`, ficam "mortos" 5s intangíveis e somem), `Projectile` (tiro do alienígena ou da arma, cor configurável), `TractorBeam` (feixe de captura), `EnergyBlock` (revela e sobe a célula escondida), `PuzzleBlock`, `Button`, `Npc` (NPC genérico com escolha e visual injetado) + `updateCompanionFollow` (seguir como pet)
- `js/player.js` — física, movimento, colisão e pulo do personagem
- `js/camera.js` — câmera que segue o jogador
- `js/render.js` — desenho genérico do cenário/objetos no canvas
- `js/game.js` — **o motor**: loop, máquina de estados (`playing`/`paused`/`dialogue`/`captured`/`gameover`/`dead`/`victory`), câmera, arma do jogador, captura pelo feixe, HUD, diálogo/escolha do NPC, portões/botões, quebra-cabeças, perigos, morte, vitória — tudo parametrizado pelo objeto de nível, nada hardcoded de fase nenhuma
- `js/levels/phase1.js` — conteúdo específico da fase 1 (a única coisa que muda de fase pra fase)
- `js/main.js` — bootstrap de 3 linhas: escolhe a fase e chama `startGame`

## Mecânicas do motor (genéricas, disponíveis pra qualquer fase)

- **Blocos de energia**: flutuam sozinhos sobre o caminho. Dar uma cabeçada por baixo revela a célula de energia escondida dentro — ela sobe pra cima do bloco e fica pegável normalmente. O bloco continua sólido depois de usado, só muda de aparência.
- **Botão + portão**: um interruptor ativado com `E` que abre um portão (parede sólida, mais alta que o pulo alcança). Uma fase pode ter vários pares (`level.buttonGates`); o motor cuida de todos genericamente.
- **Quebra-cabeça de memória**: N blocos acendem numa sequência fixa (estilo Simon); repetir de cabeçada abre um portão sólido — **obrigatório**, não dá pra pular por cima. Errar reinicia a demonstração; tentativas ilimitadas. Uma fase pode ter vários (`level.puzzles`).
- **Arma e inimigos matáveis**: `F` atira (mira com `Q`/`W`/`E`), mata `Robot`/`Alien`. Ao morrer, o inimigo fica intangível por 5s (visual de "morto") e some sozinho.
- **Captura pelo feixe**: encostar num `TractorBeam` não mata na hora — puxa o personagem (girando) até a origem do feixe ao longo de ~1.1s (`gameState = 'captured'`) e só depois mostra a morte.
- **NPC com escolha + companheiro**: `level.npc` (opcional) é um `Npc` genérico — visual injetado via `draw`, dois botões de escolha com labels/textos configuráveis. Se ajudado, pode seguir o jogador como pet (`updateCompanionFollow`) até a saída.
- **Morte**: qualquer perigo mostra só o título **"VOCÊ MORREU!"** — sem estrelas, sem texto extra.
- **Vitória**: mostra `level.victoryTitle` + `level.getVictoryText(level)` com 3 estrelas — proporção de energia coletada, tempo, e uma fixa (limites ajustáveis via `level.pointsStarRatio`/`level.timeStarLimitSeconds`).
- **Pausa (`ESC`)**: congela toda a simulação e mostra o painel de comandos.

Todo o conteúdo de `js/levels/phase1.js` (posições, textos, robôs, o visual da vaca) é só
um ponto de partida — ajuste à vontade sem medo de afetar outras fases.
