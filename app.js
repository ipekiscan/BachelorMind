const express = require("express");
const http = require("http");
const websocket = require("ws");

const stats = require("./stats");
const messages = require("./public/javascripts/messages");
const mainRouter = require("./routes/index");
const Game = require("./game");

const games = new Map();

const port = process.argv[2];
const app = express();

// Function to generate random, unique IDs
function create_UUID(){
    var dt = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (dt + Math.random()*16)%16 | 0;
        dt = Math.floor(dt/16);
        return (c=='x' ? r :(r&0x3|0x8)).toString(16);
    });
    return uuid;
}

function parseCookies(s){
  if(typeof s != "string"){
    return {};
  }
  return s.split(';').map(v => v.split('=')).reduce((acc, v) => {
    acc[decodeURIComponent(v[0].trim())] = decodeURIComponent(v[1].trim());
    return acc;
  }, {});
}


function cookieString(cookies){
  let str = ""
  Object.keys(cookies).forEach(function(key,index) {
    str += `; ${key}=${encodeURIComponent(cookies[key])}`
  });
  return str.substring(2);
}

// Parse URL-encoded bodies
app.use(express.urlencoded({
    extended: true
}))

app.use(mainRouter);

// Route the static file paths into their corresponding folders
app.use('/img', express.static("public/images"));
app.use('/css', express.static("public/stylesheets"));
app.use('/js', express.static("public/javascripts"));

// Create new HTTP server and Websocket server
const server = http.createServer(app);
const wss = new websocket.Server({ server });

// Set websocket connection listener
wss.on('connection', function(ws, req){
    let cookies = parseCookies(req.headers.cookie);
    
    if(cookies["roomname"] == undefined || cookies["userid"] == undefined){
      let data = messages.O_REDIRECT;
      data.message = "Missing cookies!";
      ws.send(JSON.stringify(data));
      return;
    }

    if(!games.has(cookies["roomname"])){
      let data = messages.O_REDIRECT;
      data.message = "This game does not exist!"
      ws.send(JSON.stringify(data));
      return;
    }

    let game = games.get(cookies["roomname"]);
    let uid = cookies["userid"];

    let maker;

    if(game.maker === uid){
      game.maker_ws = ws;
      maker = true;
    }else if(game.guesser === uid){
      game.guesser_ws = ws;
      maker = false; 
    }else{
      let data = messages.O_REDIRECT;
      data.message = "You don't have access to this game!"
      ws.send(JSON.stringify(data));
      ws.close();
      return;
    }

    // event listener
    ws.on('message', function(message) {
      let msg = JSON.parse(message);
      console.log("[INFO] : " + message);

      var data;

      if(msg.type == messages.T_CONNECTION_ESTABLISHED){
        data = messages.O_GAME_INIT;
        data.game = {name: game.name, difficulty: game.difficulty, state:
          game.state, guesses: game.guesses, evaluations: game.evaluations,
          start: game.start, aborted: game.aborted};
        if(maker){
          data.game.role = "maker";
          data.game.code = game.code;
        }else{
          data.game.role = "guesser";
          data.game.code = game.code != null;
          if(game.isOver()){
            data.game.code = game.code;
          }
        }
      }else if(msg.type == messages.T_MAKE_CODE && maker){
        let status = game.setCode(msg.code);
        if(status instanceof Error){
          data = messages.O_ERROR;
          data.message = status.message;
        }
      }else if(msg.type == messages.T_MAKE_EVAL && maker){
        let status = game.addEval(msg);
        if(status instanceof Error){
          data = messages.O_ERROR;
          data.message = status.message;
        }
      }else if(msg.type == messages.T_MAKE_GUESS && !maker){
        let status = game.addGuess(msg.guess);
        if(status instanceof Error){
          data = messages.O_ERROR;
          data.message = status.message;
        }
      }else if(msg.type == messages.T_GAME_ABORTED){
        data = messages.O_GAME_ABORTED;
        let status = game.abortGame();
        if(status instanceof Error){
          data = messages.O_REDIRECT;
          data.message = "";
        }
      }else{
        data = messages.O_ERROR;
        data.message = "Unknown message type " + msg.type;
      }

      if(data != null){
        ws.send(JSON.stringify(data));
      }
    });

    ws.on('end',function(){
      if(maker){
        game.maker_ws = null;
      }else{
        game.guesser_ws = null;
      }
    });

})

// works in case of a POST request
app.post('/create-room', function(req,res){

  let userid = create_UUID();

  // Check if room-name is valid
  if(typeof req.body["room-name"] != "string" || req.body["room-name"] == ""){
    res.status(400);
    res.send("Room name must be a non-empty string!");
    return;
  }

  // Check if room already exists
  if(games.has(req.body["room-name"]) && !games.get(req.body["room-name"]).isOver()){
    res.redirect("/#Room with that name already exists!");
    return;
  }

  let difficulty;

  // Set the row-count according to the difficulty
  if(req.body.difficulty == "easy"){
    difficulty = 12;
  }else if(req.body.difficulty == "normal"){
    difficulty = 8;
  }else if(req.body.difficulty == "hard"){
    difficulty = 6;
  }else{
    res.status(400);
    res.send("Difficulty is invalid!");
    return;
  }

  // Create new game object
  let game = new Game(difficulty, req.body["room-name"]);

  // 
  if(req.body.role  == "maker"){
    game.maker = userid;
  }else if(req.body.role  == "guesser"){
    game.guesser = userid;
  }else{
    res.status(400);
    res.send("Role is invalid!");
    return;
  }

  // map this name to the game
  games.set(req.body["room-name"], game);

  // Set the cookies
  res.set("Set-Cookie", cookieString({
    userid: userid,
    roomname: req.body["room-name"]
  }));
  //set the cookies
  res.redirect(301, '/game');
});

app.post('/join-room', function(req,res){

  let userid = create_UUID();


  if(typeof req.body["room-name"] != "string" || req.body["room-name"] == ""){
    res.status(400);
    res.send("Room name must be a non-empty string!");
    return;
  }

  if(!games.has(req.body["room-name"])){
    res.redirect("/#Room with that name does not exists!");
    return;
  }

  let status = games.get(req.body["room-name"]).addPlayer(userid);

  if(status instanceof Error){
    res.redirect("/#Room is already full!");
    return;
  }

  // Set the cookies
  res.set("Set-Cookie", cookieString({
    userid: userid,
    roomname: req.body["room-name"]
  }));
  res.redirect(301, '/game');
});

if(!process.env.IS_HEROKU){
   server.listen(port);
}

module.exports = app;
