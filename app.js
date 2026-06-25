let board = Chessboard("board", {
    position: "start",
    pieceTheme: "https://chessboardjs.com/img/chesspieces/alpha/{piece}.png"
});

let game = new Chess();
let moves = [];
let currentMove = 0;

let moveReviews = {};
let latestEval = "No eval yet";
let latestBestMove = "—";

let engine = STOCKFISH();
let currentEngineJob = null;
let jobId = 0;

engine.onmessage = function(event) {
    const line = event.data ? event.data : event;

    if (!currentEngineJob) return;

    if (line.includes("score cp")) {
        const match = line.match(/score cp (-?\d+)/);
        if (match) {
            currentEngineJob.lastEval = parseInt(match[1]) / 100;
        }
    }

    if (line.includes("score mate")) {
        const match = line.match(/score mate (-?\d+)/);
        if (match) {
            const mate = parseInt(match[1]);
            currentEngineJob.lastEval = mate > 0 ? 100 : -100;
        }
    }

    if (line.includes("bestmove")) {
        const parts = line.split(" ");
        const bestMove = parts[1];

        const result = {
            eval: currentEngineJob.lastEval,
            bestMove: bestMove
        };

        currentEngineJob.resolve(result);
        currentEngineJob = null;
    }
};

engine.postMessage("uci");

function cleanPGN(pgn) {
    pgn = pgn.replace(/\{[^}]*\}/g, "");
    pgn = pgn.replace(/\([^)]*\)/g, "");
    return pgn;
}

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
    latestEval = "No eval yet";
    latestBestMove = "—";

    game.reset();
    board.position(game.fen());

    document.getElementById("moveInfo").innerText = "Move: 0";
    document.getElementById("evalOutput").innerText = "Eval: not analyzed yet";

    showMoveList();
    updateAnalysisPanel();

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
    updateAnalysisPanel();
    analyzeMove(currentMove);
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
    updateAnalysisPanel();

    if (currentMove > 0) {
        analyzeMove(currentMove);
    }
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

function getFenBeforeMove(moveNumber) {
    const tempGame = new Chess();

    for (let i = 0; i < moveNumber - 1; i++) {
        tempGame.move(moves[i], { sloppy: true });
    }

    return tempGame.fen();
}

function getFenAfterMove(moveNumber) {
    const tempGame = new Chess();

    for (let i = 0; i < moveNumber; i++) {
        tempGame.move(moves[i], { sloppy: true });
    }

    return tempGame.fen();
}

function analyzeFen(fen) {
    return new Promise((resolve) => {
        currentEngineJob = {
            lastEval: 0,
            resolve: resolve
        };

        engine.postMessage("position fen " + fen);
        engine.postMessage("go depth 12");
    });
}


async function analyzeMove(moveNumber) {
    if (moveNumber === 0) return;

    if (moveReviews[moveNumber]) {
        updateAnalysisPanel();
        return;
    }

    const movePlayed = moves[moveNumber - 1];

    document.getElementById("moveGrade").innerText =
        "Move Grade: Reviewing " + movePlayed;

    document.getElementById("moveReason").innerText =
        "Why: Comparing your move to Stockfish's best move...";

    document.getElementById("bestMove").innerText =
        "Best Move: Thinking...";

    const beforeFen = getFenBeforeMove(moveNumber);
    const afterFen = getFenAfterMove(moveNumber);

    const bestLine = await analyzeFen(beforeFen);

    if (currentMove !== moveNumber) return;

    const actualLine = await analyzeFen(afterFen);

    if (currentMove !== moveNumber) return;

    const isWhiteMove = moveNumber % 2 === 1;

    const bestEvalForPlayer = isWhiteMove ? bestLine.eval : -bestLine.eval;
    const actualEvalForPlayer = isWhiteMove ? actualLine.eval : -actualLine.eval;

    let evalLoss = bestEvalForPlayer - actualEvalForPlayer;
    if (evalLoss < 0) evalLoss = 0;

    latestEval = actualLine.eval.toFixed(2);
    latestBestMove = bestLine.bestMove;

    const review = {
        move: movePlayed,
        bestMove: bestLine.bestMove,
        evalLoss: evalLoss,
        grade: getMoveGrade(evalLoss),
        positionText: getSimplePositionText(actualLine.eval.toFixed(2))
    };

    moveReviews[moveNumber] = review;

    document.getElementById("evalOutput").innerText =
        "Eval: " + latestEval;

    updateAnalysisPanel();
}

function updateAnalysisPanel() {
    if (currentMove === 0) {
        document.getElementById("positionAssessment").innerText =
            "Position: Not analyzed yet";

        document.getElementById("moveGrade").innerText =
            "Move Grade: —";

        document.getElementById("moveReason").innerText =
            "Why: Start stepping through the game.";

        document.getElementById("bestMove").innerText =
            "Best Move: —";

        return;
    }

    const savedReview = moveReviews[currentMove];

    if (savedReview) {
        document.getElementById("positionAssessment").innerText =
            "Position: " + savedReview.positionText;

        document.getElementById("moveGrade").innerText =
            savedReview.grade + " (" + savedReview.move + ")";

        document.getElementById("moveReason").innerText =
            "Why: Your move was compared against Stockfish's best move.";

        document.getElementById("bestMove").innerText =
            "Best Move: " + savedReview.bestMove;

        return;
    }

    const move = moves[currentMove - 1];

    document.getElementById("positionAssessment").innerText =
        "Position: analyzing...";

    document.getElementById("moveGrade").innerText =
        "Move Grade: Reviewing " + move;

    document.getElementById("moveReason").innerText =
        "Why: Waiting for Stockfish...";

    document.getElementById("bestMove").innerText =
        "Best Move: Thinking...";
}

function getMoveGrade(evalLoss) {
    if (evalLoss === null || evalLoss === undefined)
        return "Move Grade: Reviewing...";

    if (evalLoss < 0.50) return "Move Grade: ✓ Good";
    if (evalLoss < 1.20) return "Move Grade: ⚠ Inaccuracy";
    if (evalLoss < 2.50) return "Move Grade: ❌ Mistake";

    return "Move Grade: 🚨 Blunder";
}

function getSimplePositionText(evalText) {
    if (!evalText || evalText === "No eval yet") {
        return "Not analyzed yet";
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

function normalizeEvalForSide(evalScore, moveNumber) {
    const isWhiteMove = moveNumber % 2 === 1;

    return isWhiteMove ? evalScore : -evalScore;
}

function getMoveGrade(evalLoss) {
    if (evalLoss === null || evalLoss === undefined)
        return "Move Grade: Reviewing...";

    if (evalLoss < 0.75) return "Move Grade: ✓ Good";
    if (evalLoss < 1.50) return "Move Grade: ⚠ Inaccuracy";
    if (evalLoss < 3.00) return "Move Grade: ❌ Mistake";

    return "Move Grade: 🚨 Blunder";
}
