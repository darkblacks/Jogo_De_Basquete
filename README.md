# Basketball Arcade Ready

Jogo de basquete arcade feito em React + Vite + React Three Fiber + Rapier Physics, com controles por teclado, toque e webcam via MediaPipe Hand Landmarker.

## Rodar

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Controles globais

Todos os modos usam os mesmos comandos internos:

- `mirar`: mover para esquerda/direita;
- `pegar/carregar`: segurar, tocar ou fechar a mão;
- `soltar/arremessar`: soltar, tirar o dedo ou abrir a mão.

## PC

- A/D ou setas: mirar;
- Espaço pressionado: pegar/carregar;
- Soltar espaço: arremessar.

## Mobile

- Arrastar na tela: mirar;
- Segurar toque: pegar/carregar;
- Soltar toque: arremessar.

## Webcam

- Mão aberta: solta/arremessa;
- Mão fechada: pega/carrega;
- Mover mão para esquerda/direita: mira e move a bola segurada para os lados.

A câmera é solicitada automaticamente ao entrar no site. O jogador pode escolher `Jogar com Câmera` ou `Jogar normal` no menu.

## Ajustes desta versão

- Webcam não cria movimentos próprios: ela alimenta os mesmos comandos globais usados no PC e no mobile.
- Enquanto a mão estiver fechada, o jogo reforça o comando global de pegar/carregar para evitar falha de sincronização quando a bola fica disponível alguns frames depois.
- A mira por webcam agora usa ref síncrono, sem depender de re-render do React, então a bola segurada acompanha a mão lateralmente no mesmo frame.
- A posição de bola segurada foi elevada e ampliada lateralmente para ficar visualmente clara.
- A barra de força e a porcentagem usam exatamente o mesmo valor inteiro.
- O modo webcam usa resolução menor de câmera para reduzir custo no PC/celular.


## Ajuste visual 2026-06-28

- A posição de bola segurada/arremesso foi movida para trás da barra frontal amarela, mantendo a bola dentro da baia visualmente.
- A câmera foi elevada e inclinada levemente para baixo para mostrar melhor a queda das bolas na baia e a parte superior do aro.

## Ajustes desta versão

- Câmera mais alta e inclinada para mostrar a parte de cima do aro, a rampa e a bola batendo na barra frontal.
- Bola disponível/segurada agora fica visível em cima/atrás da barra amarela.
- Sombras ativadas no Canvas, luz direcional com shadow map e contact shadows para melhorar leitura visual.
- Barra frontal e área da baia receberam destaques visuais extras.

## Ajuste desta versão

- Bolas disponíveis não são mais levantadas nem reposicionadas para cima ao bater na barra amarela.
- Ao bater na barra, a bola apenas muda para laranja/disponível e fica parada no ponto da colisão.
- A bola só sobe para a posição de arremesso quando o jogador realmente pega/carrega com teclado, toque ou mão fechada.

## Ajuste desta versão

- O tempo da partida foi aumentado de 2 minutos para 3 minutos.
- A cesta permanece parada no primeiro minuto.
- Quando faltam 2 minutos, a cesta começa a se mover da esquerda para a direita.
- A velocidade aumenta progressivamente entre 2:00 e 0:30.
- Nos últimos 30 segundos, a cesta permanece na velocidade máxima.
- A pontuação acompanha a posição real da cesta em movimento.
