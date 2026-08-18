# Fuga da Nave

Platformer 2D feito em HTML5 Canvas + JavaScript puro (sem build step).

**Lore (mock, edite à vontade):** alienígenas tentaram abduzir uma vaca para estudá-la, mas por um erro de mira capturaram você. Agora você precisa escapar do setor de contenção da nave, desviando de robôs de segurança, alienígenas voadores e feixes de captura. Perto do fim da fase, uma vaca pede sua ajuda para libertar ela e as amigas — a escolha do jogador muda o final.

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
- `E` — interagir (terminais, a vaca, o botão, a saída)
- `F` — atirar com a pistola (mata robôs e alienígenas)
- `Q` / `W` / `E` segurando + `F` — mira diagonal-cima-esquerda / reto-cima / diagonal-cima-direita. Sem nenhum desses, atira na horizontal (pro lado que o personagem está de frente)
- `ESC` — pausa o jogo e abre o painel de comandos

## Estrutura

- `index.html` — marcação, canvas, HUD, caixa de diálogo/escolha e telas de fim de jogo
- `css/style.css` — estilo da página, HUD e overlays
- `js/input.js` — leitura de teclado
- `js/physics.js` — todas as constantes de física (velocidade, gravidade, força do pulo, coyote time). `MAX_JUMP_HEIGHT`/`MAX_JUMP_AIR_TIME` são derivadas daqui e usadas por `level.js` pra garantir que nada fique inalcançável
- `js/level.js` — mapa de tiles, células de energia, blocos de energia, terminais de lore, portão+botão, quebra-cabeça de memória, robôs/alienígenas/feixes, a vaca e a saída (tudo mockado, ajuste posições e textos livremente). Plataformas e blocos avisam no console (`console.warn`) se a subida ficar maior do que o pulo alcança; as moedas sobre os buracos ficam espaçadas por distância real (equidistantes), seguindo a parábola do pulo
- `js/entities.js` — classes dos perigos/objetos: `Robot` e `Alien` (matáveis com a arma — `kill()`, ficam "mortos" 5s intangíveis e depois somem), `Projectile` (tiro do alienígena ou da arma do jogador, cor configurável), `TractorBeam` (feixe de captura com aviso antes de ativar), `EnergyBlock` (bloco de cabeçada — revela e sobe a célula escondida dentro dele), `PuzzleBlock` (bloco do quebra-cabeça de memória), `Button` (interruptor que abre um portão)
- `js/player.js` — física, movimento, colisão e pulo do personagem
- `js/camera.js` — câmera que segue o jogador
- `js/render.js` — desenho do cenário/objetos no canvas
- `js/main.js` — loop do jogo, máquina de estados (`playing` / `dialogue` / `gameover` / `dead` / `victory`), tiro do jogador, interação com a vaca/botão/saída, contagem de tempo e cálculo das estrelas

## Blocos de energia, portão e quebra-cabeça de memória

- **Blocos de energia**: flutuam sozinhos sobre o caminho. Dar uma cabeçada por baixo (pular e encostar a cabeça) revela a célula de energia escondida dentro — ela sobe pra cima do bloco e fica pegável normalmente. O bloco continua sólido depois de usado, só muda de aparência (não desaparece).
- **Botão + portão**: um interruptor ativado com `E` que abre um portão (parede sólida, mais alta que o pulo alcança) mais à frente. O botão fica sempre antes do portão no caminho, então nunca trava o jogo.
- **Quebra-cabeça de memória**: 3 blocos acendem numa sequência fixa (estilo Simon); repetir a ordem de cabeçada abre um portão sólido à frente (`level.memoryPuzzle.gate`) — igual ao portão do botão, é mais alto que o pulo alcança, então é **obrigatório** resolver para avançar. Errar reinicia a demonstração da sequência; o jogador tem tentativas ilimitadas, nunca trava de vez.

## Arma e inimigos matáveis

Robôs e alienígenas podem ser mortos com a pistola (`F`, mirando com `Q`/`W`/`E`). Ao matar, o inimigo fica "morto" por 5 segundos — visual diferente, para de se mover, não causa mais dano e fica intangível — e some sozinho depois disso.

## Captura pelo feixe

Encostar num feixe de captura não mata na hora: o personagem é puxado (e gira, `player.rotation`) até a origem do feixe (o emissor no topo) ao longo de `CAPTURE_DURATION` (1.1s, `gameState = 'captured'`, física normal pausada) — só depois disso a morte é mostrada. Robôs, alienígenas, tiros e queda no vazio continuam matando na hora.

## Morte e estrelas

Morrer (de qualquer perigo) mostra só o título **"VOCÊ MORREU!"** — sem estrelas, sem texto extra, só o botão de tentar novamente.

Estrelas continuam existindo apenas na tela de vitória ("Fase 1 concluída"), com os mesmos 3 critérios de antes (mock, ajustáveis em `main.js`):

1. Proporção de células de energia coletadas em relação ao total da fase (`POINTS_STAR_RATIO`, hoje 60%)
2. Tempo até a vitória (`TIME_STAR_LIMIT_SECONDS`, hoje 45s)
3. Estrela fixa, sempre concedida

## Escolha da vaca

Ao interagir com a vaca (`E`), o jogo pausa e mostra duas opções:

- **Ajudar as vacas** — libera a saída (`level.exitHatch`) e a vaca passa a te seguir como um pet (`updateCowFollow`, sempre a `COW_FOLLOW_OFFSET` px atrás do jogador) até o portal, onde o jogo continua rumo à "Fase 1 concluída" (tela mock preparada para encadear a próxima fase depois).
- **Seguir sozinho** — encerra o jogo na hora com a tela de "Fim de jogo".

## Pausa (ESC)

`ESC` alterna `gameState` entre `'playing'` e `'paused'`, abrindo/fechando o painel `#pause-overlay` com a lista de comandos — enquanto pausado, toda a simulação (jogador, inimigos, projéteis) fica congelada, igual às outras telas modais do jogo.

Esses textos, o layout da fase e o visual dos inimigos são só um ponto de partida — troque cores, sprites, posições e falas em `js/level.js`, `js/entities.js` e `js/render.js` conforme for evoluindo a fase.
