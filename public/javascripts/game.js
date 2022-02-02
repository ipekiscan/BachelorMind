const guessRowHtml = `<svg height="70" width="440">
<text id="{}-text" font-size="30px" x="25" y="34" fill="white" font-weight="bold">{}</text>
<circle id="{}-1g" onclick="guessClick({}, 1)" cx="100" cy="35" r="30" stroke="black" stroke-width="3" fill="white"></circle>
<circle id="{}-2g" onclick="guessClick({}, 2)" cx="170" cy="35" r="30" stroke="black" stroke-width="3" fill="white"></circle>
<circle id="{}-3g" onclick="guessClick({}, 3)" cx="240" cy="35" r="30" stroke="black" stroke-width="3" fill="white"></circle>
<circle id="{}-4g" onclick="guessClick({}, 4)" cx="310" cy="35" r="30" stroke="black" stroke-width="3" fill="white"></circle>
<rect x="365" y="8" width="60" height="50" stroke-width="2" stroke="black" fill="white"/>
<circle id="{}-1e" cx="380" cy="23" r="9" stroke="black" stroke-width="1" fill="white"></circle>
<circle id="{}-2e" cx="380" cy="45" r="9" stroke="black" stroke-width="1" fill="white"></circle>
<circle id="{}-3e" cx="410" cy="23" r="9" stroke="black" stroke-width="1" fill="white"></circle>
<circle id="{}-4e" cx="410" cy="45" r="9" stroke="black" stroke-width="1" fill="white"></circle>
</svg>`; // The contents of a guess row

let guesses = 0;
let turn = 0;
let cursorColor = null;
let row = "0000";
let game;
let socket;

const colorMap = {
    R: "#FF0000",
    G: "#00FF00",
    B: "#0000FF",
    Y: "#FFFF00",
    M: "#D000FF",
    O: "#FF9100",
    C: "#00FFEE",
    K: "#4A2E0A"
}

//replaces str[index] with replacement
function replaceAt(str, index, replacement){
    return str.substring(0,index) + replacement + str.substring(index+1);
}

// Wait for document to be loaded
document.addEventListener('DOMContentLoaded', () => {
    // window.location.host is the beginning of the URL
    if (location.protocol !== 'https:') {
        socket = new WebSocket(`ws://${window.location.host}`);
    }else{
        socket = new WebSocket(`wss://${window.location.host}`);
    }

    // Run this function when the socket is opened
    socket.onopen = function () {
        socket.send(Messages.S_CONNECTION_ESTABLISHED);
        console.log("Sent data to socket")
    };

    // Run this function when a new message is received
    socket.onmessage = function (event) {
        console.log(event.data);
        const msg = JSON.parse(event.data);
        console.log(msg);
        if(msg.type == Messages.T_REDIRECT){
            window.location.replace("/#"+msg.message); 
        }else if(msg.type == Messages.T_GAME_INIT){
            game = msg.game;
            initGame(game)
        }else if(msg.type == Messages.T_MAKE_EVAL){
            game.evaluations.push(msg);
            drawEvals(game);
        }else if(msg.type == Messages.T_MAKE_GUESS){
            game.guesses.push(msg.guess);
            drawGuesses(game);
        }else if(msg.type == Messages.T_GAME_STATE){
            game.state = msg.state;
            setState(game);
        }else if(msg.type == Messages.T_MAKE_CODE){
            game.code = msg.code;
            drawCode(game);
        }else if(msg.type == Messages.T_GAME_ABORTED){
            alert("This game has been aborted!");
            window.location.replace("/"); 
        }else if(msg.type == Messages.T_ERROR){
            alert(msg.message);
        }
    };
});

function initGame(game){
    let difficulty = game.difficulty;

    var board = document.querySelector("main ul")
    for(let i=difficulty; i > 0; i--){
        let entry = document.createElement("li");
        entry.id=i;
        entry.innerHTML = guessRowHtml.replaceAll("{}", i);
        board.appendChild(entry);
    }
    
    document.querySelector("#room").innerText = game.name;
    let difftxt;

    if(game.difficulty == 12){
        difftxt = "Easy";
    }else if(game.difficulty ==  8){
        difftxt = "Normal";
    }else{
        difftxt = "Hard";
    }

    document.querySelector("#mode").innerText = difftxt;

    // Update the time every second
    setInterval(function () {
        document.querySelector("#time").innerText = calcDiff(new Date(game.start), new Date());
    }, 1000);

    let roletxt;
    if(game.role == "maker"){
        document.getElementById("color-selection").hidden = game.code != null;
        document.getElementById("evaluate").hidden = game.code == null;
        roletxt = "Code Maker";
        if(game.code == null){
            for(let i = 1; i < 5; i++){
                let c = document.getElementById(`code-${i}`);
                c.onclick = function(e){
                    if(game.aborted){
                        return;
                    }
                    if(cursorColor == null){
                        return;
                    }
                    this.style.fill = colorMap[cursorColor];
                    row = replaceAt(row, i-1, cursorColor);
                    console.log(row);
                }
            }
        }else{
            document.getElementById("action-button").innerText = "Submit";
            document.getElementById("action-button").onclick = submitEval;
        }
    }else{
        document.getElementById("color-selection").hidden = false;
        document.getElementById("evaluate").hidden = true;
        roletxt = "Code Guesser";
    }

    document.querySelector("#role").innerText = roletxt;

    drawCode(game);
    drawGuesses(game);
    setState(game);
    drawEvals(game);
}

function calcDiff(d1, d2){
    let diffMin = (d1.getTime() - d2.getTime()) / 60000;
    diffMin = Math.abs(Math.round(diffMin));

    let diffSec = (d1.getTime() - d2.getTime()) / 1000;
    diffSec = Math.abs(Math.round(diffSec % 60));
    return `${diffMin} Minutes ${diffSec} Seconds`
}

function setCursorColor(code){
    cursorColor = code;
}

// params row and column 
function guessClick(r, c){
    if(game.aborted){
        return;
    }
    if(game.role == "maker"){
        console.log("Maker cannot edit guesses!");
        return;
    }
    if(r != game.evaluations.length + 1){
        console.log("Invalid row clicked!")
        return;
    }
    if(cursorColor == null){
        console.log("cursorColor is null")
        return;
    }
    document.getElementById(`${r}-${c}g`).style.fill = colorMap[cursorColor];
    // paint a single guess circle
    row = replaceAt(row, c-1, cursorColor);
}

function makeMove(){
    if(game.aborted){
        return;
    }
    if(game.role == "maker"){
        if(game.code == null){
            if(row.includes("0")){
                alert("Please fill every row in code!")
            }
            let data = Messages.O_MAKE_CODE;
            data.code = row;
            socket.send(JSON.stringify(data));

            document.getElementById("color-selection").hidden = game.code != null;
            document.getElementById("evaluate").hidden = game.code == null;
            document.getElementById("action-button").innerText = "Submit";
            document.getElementById("action-button").onclick = submitEval;
        }
    }else{
        if(game.code != null){
            if(row.includes("0")){
                alert("Please fill every row in guess!")
            }
            let data = Messages.O_MAKE_GUESS;
            data.guess = row;
            socket.send(JSON.stringify(data));
            row = "0000";
        }
    }
}

function drawGuesses(game){
    for(let i = 0; i < game.guesses.length; i++){
        for(let j = 1; j < 5; j++){
            let e = document.getElementById(`${i+1}-${j}g`);
            e.style.fill = colorMap[game.guesses[i].charAt(j-1)];
        }
    }
}

function drawCode(game){
    for(let i = 1; i < 5; i++){
        let c = document.getElementById(`code-${i}`);
        if(game.code){
            if(typeof game.code == "string"){
                c.style.fill = colorMap[game.code.charAt(i-1)];
            }else{
                // grey
                c.style.fill = "#616161";
            }
        }
    }
}

function drawEvals(game){
    for(let i = 0; i < game.evaluations.length; i++){
        let j = 0;
        let e = game.evaluations[i];
        while(e.red + e.yellow > j){
            if(j < e.red){
                document.getElementById(`${i+1}-${j+1}e`).style.fill = "red";
            }else{
                document.getElementById(`${i+1}-${j+1}e`).style.fill = "yellow";
            }
            j++;
        }
    }

    if(game.evaluations.length >= 1 && game.evaluations[game.evaluations.length -1].red == 4){
        alert("The guesser has won the game!")
    }

    if(game.difficulty == game.evaluations.length && game.evaluations[game.evaluations.length -1].red != 4){
        alert("The maker has won the game!")
    }
}

function submitEval(){
    if(game.aborted){
        return;
    }

    let m = Messages.O_MAKE_EVAL;
    m.red = document.getElementById("red-evaluate").value;
    m.yellow = document.getElementById("yellow-evaluate").value;
    socket.send(JSON.stringify(m));
}

function abortGame(){
    socket.send(Messages.S_GAME_ABORTED);
}

function setState(game){
    let t = game.state.replace(game.role, "you");
    if(game.role == "maker"){
        document.querySelector("#state").innerText = t.replace("guesser", "opponent");
    }else{
        document.querySelector("#state").innerText = t.replace("maker", "opponent");
    }
    if(game.state.includes(game.role) && !game.state.includes("won the game!")){
        alert("It is your turn!");
    }
}
