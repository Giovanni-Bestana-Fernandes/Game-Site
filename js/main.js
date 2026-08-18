// Ponto de entrada: escolhe a fase e liga o motor genérico (js/game.js). Trocar de
// fase, adicionar um seletor de fases, ou encadear fase 1 -> fase 2 no futuro é tudo
// feito aqui — nenhum outro arquivo precisa mudar para isso.
import { startGame } from './game.js';
import { createLevel1 } from './levels/phase1.js';

startGame(createLevel1);
