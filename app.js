let board = Chessboard("board", {
    position: "start",
    pieceTheme: "https://chessboardjs.com/img/chesspieces/alpha/{piece}.png"
});

let game = new Chess();
let moves = [];
let currentMove = 0;
let latestBestMove = "—";
let previousEval = null;
let currentEval = null;
let lastEvalLoss = null;
let moveReviews = {};
let analysisMoveNumber = null;

function cleanPGN(pgn) {
    pgn = pgn.replace(/\{[^}]*\}/g, "");
    pgn = pgn.replace(/\([^)]*\)/g, "");
    return pgn;
}

let engine = STOCKFISH();
let latestEval = "No eval yet";

engine.onmessage = function(event) {
    const line = event.data ? event.data : event;

    if (line.includes("score cp")) {
        const match = line.match(/score cp (-?\d+)/);

        if (match) {
            const centipawns = parseInt(match[1]);
            previousEval = currentEval;
currentEval = parseFloat((centipawns / 100).toFixed(2));

latestEval = currentEval.toFixed(2);

if (previousEval !== null) {
    lastEvalLoss = Math.abs(currentEval - previousEval);
}
            document.getElementById("evalOutput").innerText = "Eval: " + latestEval;

            updateAnalysisPanel();
        }
    }

    if (line.includes("score mate")) {
        const match = line.match(/score mate (-?\d+)/);

        if (match) {
            latestEval = "Mate in " + match[1];
            document.getElementById("evalOutput").innerText = "Eval: " + latestEval;

            updateAnalysisPanel();
        }
    }

    if (line.includes("bestmove")) {
        const parts = line.split(" ");
        latestBestMove = parts[1];
        if (analysisMoveNumber !== null && currentMove === analysisMoveNumber) {
    moveReviews[analysisMoveNumber] = {
        move: moves[analysisMoveNumber - 1],
        eval: latestEval,
        evalLoss: lastEvalLoss,
        bestMove: latestBestMove,
        grade: getMoveGrade(lastEvalLoss)
    };
}

        document.getElementById("bestMove").innerText =
            "Best Move: " + latestBestMove;

        updateAnalysisPanel();
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
    moveReviews = {};
analysisMoveNumber = null;
    previousEval = null;
currentEval = null;
lastEvalLoss = null;
latestBestMove = "—";
latestEval = "No eval yet";

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
    }

    board.position(game.fen());
    document.getElementById("moveInfo").innerText = "Move: " + currentMove;
    highlightCurrentMove();
    analyzeCurrentPosition();
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
    analysisMoveNumber = currentMove;
    latestBestMove = "Thinking...";

    document.getElementById("bestMove").innerText =
        "Best Move: Thinking...";

    engine.postMessage("position fen " + game.fen());
    engine.postMessage("go depth 12");
}

function updateAnalysisPanel() {
    document.getElementById("positionAssessment").innerText =
        "Position: " + getSimplePositionText(latestEval);

    if (currentMove === 0) {
        document.getElementById("moveGrade").innerText = "Move Grade: —";
        document.getElementById("moveReason").innerText =
            "Why: Start stepping through the game.";
        document.getElementById("bestMove").innerText = "Best Move: —";
        return;
    }

    const savedReview = moveReviews[currentMove];

    if (savedReview) {
        document.getElementById("moveGrade").innerText =
            savedReview.grade + " (" + savedReview.move + ")";

        document.getElementById("moveReason").innerText =
            "Eval Change: " + savedReview.evalLoss.toFixed(2);

        document.getElementById("bestMove").innerText =
            "Best Move: " + savedReview.bestMove;

        return;
    }

    const move = moves[currentMove - 1];

    document.getElementById("moveGrade").innerText =
        getMoveGrade(lastEvalLoss) + " (" + move + ")";

    if (lastEvalLoss !== null) {
        document.getElementById("moveReason").innerText =
            "Eval Change: " + lastEvalLoss.toFixed(2);
    } else {
        document.getElementById("moveReason").innerText =
            "Eval Change: waiting for Stockfish...";
    }

    document.getElementById("bestMove").innerText =
        "Best Move: " + latestBestMove;
}

function getSimplePositionText(evalText) {
    if (!evalText || evalText === "No eval yet") {
        return "Not analyzed yet";
    }

    if (evalText.includes("Mate")) {
        return evalText;
    }

    const score = parseFloat(evalText);

    if (Math.abs(score) < 0.5) return "Equal";
    if (score >= 0.5 && score < 1.5) return "Slightly better for White";
    if (score <= -0.5 && score > -1.5) return "Slightly better for Black";
    if (score >= 1.5 && score < 3) return "White is better";
    if (score <= -1.5 && score > -3) return "Black is better";
    if (score >= 3) return "White is winning";
    if (score <= -3) return "Black is winning";

    return "Unclear";
}

function getMoveGrade(evalLoss) {
    if (evalLoss === null) return "Move Grade: Reviewing...";

    if (evalLoss < 0.30) return "Move Grade: ✓ Good";
    if (evalLoss < 0.80) return "Move Grade: ⚠ Inaccuracy";
    if (evalLoss < 1.80) return "Move Grade: ❌ Mistake";

    return "Move Grade: 🚨 Blunder";
}
