import { RECTANGULAR_PIECES_PLUGIN, rectangularPiecesPlugin } from "./rectangularPieces.js";

export { RECTANGULAR_PIECES_PLUGIN, rectangularConfig } from "./rectangularPieces.js";

export const PLUGINS = Object.freeze({
  [RECTANGULAR_PIECES_PLUGIN]: rectangularPiecesPlugin,
});
