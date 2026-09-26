# ryuu-play: estado y handover

Punto de entrada para una sesión nueva. Escrito el 2026-09-26.

## Qué es y para qué lo usamos

Fork local de [keeshii/ryuu-play](https://github.com/keeshii/ryuu-play), un simulador del JCC de Pokémon
en TypeScript. Lo usamos para **uso personal, offline, humano contra IA**, limitado a las cartas de la
era WotC: Base Set, Jungle, Fossil y Team Rocket. No se busca replicar los juegos de Game Boy, solo
jugar con las cartas de esa época.

Todo el trabajo propio está en commits locales sobre `master`. **No hay nada publicado (sin push).**

## Cómo arrancarlo

```bash
npm start
```

- Servidor y cliente en http://localhost:12021. El servidor sirve el cliente compilado desde
  `packages/play/dist/ptcg-play`.
- Base de datos SQLite en `./database.sq3`. Configuración local en `init.js`.
- Tras cambiar el cliente: `npm run build -w packages/play -- --configuration production` y recargar.
- Tras cambiar el servidor o un paquete: `npm run build -w packages/<paquete>` y reiniciar.
- Desde MagMa hay una configuración de lanzamiento `ryuu-play` en `magma/.claude/launch.json`.
- Node 26 funciona sin parches.

## `init.js`: ojo

Tiene un bloque **local que no debe commitearse nunca**: desactiva los formatos Standard y EX para
que el primer arranque solo descargue los escaneos de la era Base (~260 cartas). Al commitear cambios
de `init.js` hay que preparar el índice a mano (`git hash-object` + `git update-index`) para dejar
fuera ese bloque. El resto de `init.js` sí está commiteado.

## Qué se ha hecho (commits propios, del más antiguo al más reciente)

| Área | Cambio |
|---|---|
| Cliente | Build de producción apunta al servidor local |
| Cliente | Previsualización grande de carta al pasar el ratón 500 ms (`shared/cards/card-preview/`) |
| Mazos | `decks/`: 10 clásicos (Haymaker, Raindance, Wigglytuff, Damage Swap, Brushfire, Aerodactyl Lock, Dark Vileplume Lock, Venusaur Energy Trans, Gengar Curse, Muk Toxic Gas) y 52 mazos de NPC del Pokémon TCG de Game Boy |
| Servidor | Al arrancar, carga `decks/*.txt` en la cuenta de cada bot (`config.bots.decksDir`) |
| Servidor y cliente | Al invitar a un bot se elige su mazo (`gameSettings.botDeckId`, `GET /v1/decks/bot/:userId`) |
| IA | Paquete nuevo `packages/mc-bot`: Monte Carlo plano sobre las tácticas de `simple-bot` |
| Bots | `SimpleBot`, `MonteCarloHard` (ve las cartas ocultas) y `MonteCarloEasy` (honesto, remuestrea lo oculto) |
| Cliente | Sección activa resaltada en el menú lateral |
| Servidor y cliente | Galería de 119 avatares de Magarena (`avatars-preset/`) y avatar fijo por bot |
| Bots | Pausa de 700 ms entre acciones (`config.bots.actionDelay`) |
| Tablero | Indicador de turno, botón de fin de turno destacado, última entrada del log resaltada, log más legible y resaltado sutil de la mitad del jugador activo |

## Formato de mazo

Texto plano, un `fullName` por línea y repetido por copia, por ejemplo `Hitmonchan BS`,
`Scyther JU`, `Lapras FO` o `Dark Charizard TR`. Es el mismo formato que usan "Import from file" y
"Export". El motor valida con `DeckAnalyser` (60 cartas, máximo 4 copias salvo energía básica).

## Bots

- Los bots reciben el estado real sin filtrar (`bot-game-handler.ts`). SimpleBot y MonteCarloHard
  ven tu mano. MonteCarloEasy baraja lo que no debería ver antes de cada simulación.
- Monte Carlo: horizonte hasta el final del siguiente turno rival, 300 ms por decisión y la misma
  semilla para todos los candidatos de una ronda. Evaluación en `packages/mc-bot/scripts/evaluate.js`.
- Resultado medido: 12-8 contra SimpleBot en 20 partidas, tanto Hard como Easy. La ventaja no es
  significativa.
- Limitaciones:
  - Los prompts a mitad de acción se resuelven con SimpleBot sobre el estado real.
  - La determinización no recuerda cartas reveladas antes.
  - La decisión bloquea el servidor entre 300 y 600 ms.

## Cuentas locales

- `Pixelotes`: la del usuario.
- `SimpleBot`, `MonteCarloHard` y `MonteCarloEasy`: bots, con contraseña `bot`.
- `bot`: el bot antiguo, sin uso.
- `ClaudeReview`: cuenta de prueba para revisar la interfaz. Se puede borrar.

## Pendiente

1. El modo replay está roto.
2. Un editor de mazos mejor.
3. La interfaz se rompe por debajo de ~700 px: el menú lateral tapa el contenido y el formulario de
   registro se solapa.
4. Bots más fuertes:
   - Evaluar con más partidas y más emparejamientos de mazos.
   - Más tiempo por decisión.
   - Monte Carlo también en los prompts.
   - Pasar las simulaciones a `worker_threads`.
5. Opcional: un bot con la IA del Pokémon TCG de Game Boy portada desde `pret/poketcg`
   (`src/engine/duel/ai/`, ~17k líneas de ensamblador).
6. Los tests de Angular (karma) no se han podido ejecutar en el entorno de los agentes porque no hay
   Chrome. Conviene pasarlos en local.
