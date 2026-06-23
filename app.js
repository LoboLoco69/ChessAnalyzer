let board = Chessboard("board", {
    position: "start",
    pieceTheme: "https://chessboardjs.com/img/chesspieces/alpha/{piece}.png"
});

let game = new Chess();
let moves = [];
let currentMove = 0;

function cleanPGN(pgn) {
    pgn = pgn.replace(/\{[^}]*\}/g, "");
    pgn = pgn.replace(/\([^)]*\)/g, "");
    return pgn;
}

let engine = Stockfish();
let latestEval = "No eval yet";

engine.onmessage = function(event) {
    const line = event.data ? event.data : event;

    if (line.includes("score cp")) {
        const match = line.match(/score cp (-?\d+)/);

        if (match) {
            const centipawns = parseInt(match[1]);
            latestEval = (centipawns / 100).toFixed(2);
            document.getElementById("evalOutput").innerText = "Eval: " + latestEval;
        }
    }

    if (line.includes("score mate")) {
        const match = line.match(/score mate (-?\d+)/);

        if (match) {
            latestEval = "Mate in " + match[1];
            document.getElementById("evalOutput").innerText = "Eval: " + latestEval;
        }
    }
};

engine.postMessage("uci");

function loadPGN() {
    let pgn = document.getElementById("pgnInput").value;

    const playerColor = getPlayerColor(pgn, "lobothebozo");
    board.orientation(playerColor);

    pgn = cleanPGN(pgn);

    game = new Chess();
    const loaded = game.load_pgn(pgn, { sloppy: true });

    if (!loaded) {
        document.getElementById("output").innerHTML = "<h3>PGN could not be loaded.</h3>";
        return;
    }

    moves = game.history();
    currentMove = 0;

    game.reset();
    board.position(game.fen());

    document.getElementById("moveInfo").innerText = "Move: 0";
    showMoveList();

    document.getElementById("pgnSection").style.display = "none";
}

function showMoveList() {
    let html = "<h3>Move List</h3><ol>";

    moves.forEach((move, index) => {
        html += `<li id="move-${index}">${move}</li>`;
    });

    html += "</ol>";
    document.getElementById("output").innerHTML = html;
}

function nextMove() {
    if (currentMove >= moves.length) return;

    game.move(moves[currentMove], { sloppy: true });
    currentMove++;

    board.position(game.fen());
    document.getElementById("moveInfo").innerText = "Move: " + currentMove;
    highlightCurrentMove();
    analyzeCurrentPosition();
}

function prevMove() {
    if (currentMove <= 0) return;

    currentMove--;

    game.reset();

    for (let i = 0; i < currentMove; i++) {
        game.move(moves[i], { sloppy: true });
        analyzeCurrentPosition();
    }

    board.position(game.fen());
    document.getElementById("moveInfo").innerText = "Move: " + currentMove;
    highlightCurrentMove();
}

function highlightCurrentMove() {
    moves.forEach((move, index) => {
        const item = document.getElementById("move-" + index);

        if (item) {
            item.style.fontWeight = "normal";
            item.style.backgroundColor = "";
            item.style.color = "";
        }
    });

    if (currentMove > 0) {
        const current = document.getElementById("move-" + (currentMove - 1));

        if (current) {
            current.style.fontWeight = "bold";
            current.style.backgroundColor = "#d4af37";
            current.style.color = "#111827";
        }
    }
}

function getPlayerColor(pgn, username) {
    const whiteMatch = pgn.match(/\[White "([^"]+)"\]/);
    const blackMatch = pgn.match(/\[Black "([^"]+)"\]/);

    const whiteName = whiteMatch ? whiteMatch[1].toLowerCase() : "";
    const blackName = blackMatch ? blackMatch[1].toLowerCase() : "";
    const user = username.toLowerCase();

    if (whiteName === user) return "white";
    if (blackName === user) return "black";

    return "white";
}

function togglePGN() {
    const section = document.getElementById("pgnSection");

    if (section.style.display === "none") {
        section.style.display = "block";
    } else {
        section.style.display = "none";
    }
}

function analyzeCurrentPosition() {
    engine.postMessage("position fen " + game.fen());
    engine.postMessage("go depth 12");
}
