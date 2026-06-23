let board = Chessboard("board", {
    position: "start",
    pieceTheme:
      "https://chessboardjs.com/img/chesspieces/alpha/{piece}.png"
});

let game = new Chess();
let moves = [];
let currentMove = 0;

loadPGN()

showMoveList()

nextMove()

prevMove()

highlightCurrentMove()

getPlayerColor()

togglePGN()

cleanPGN()
