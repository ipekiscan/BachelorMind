const websocket = require("ws");
const messages = require("./public/javascripts/messages");
const stats = require("./stats");

var validColors = ['R', 'G', 'B', 'Y', 'M', 'C', 'O', 'K'];

const game = function(difficulty, name){
  this.maker = null;
  this.guesser = null;
  this.maker_ws = null;
  this.guesser_ws = null;
  this.name = name;
  this.code = null;
  this.difficulty = difficulty;
  this.guesses = [];
  this.evaluations = [];
  this.turn = null;
  this.state = "Waiting for player...";
  this.aborted = false;
  this.start = new Date();
  stats.started++;
}


game.prototype.isOver = function(){
  return (this.evaluations.length >= 1 &&
    this.evaluations[this.evaluations.length - 1].red == 4) 
    || this.difficulty <= this.evaluations.length || this.aborted;
};

/*
 * Add a guess to the game
 */
game.prototype.addGuess = function(guess){
  if(this.evaluations.length >= 1 && this.evaluations[this.evaluations.length -1 ].red == 4){
    return new Error("Guesser has already won the game!");
  }

  if(this.aborted){
    return new Error("This game has been aborted!");
  }

  if(this.difficulty <= this.guesses.length){
    return new Error("You cannot make any more guesses!")
  }

  // ex. RGBK
  if(typeof guess != "string"){
    return new Error("Guess must be of type string!");
  }

  if(guess.length != 4){
    return new Error("Please enter a valid guess!");
  }

  for(let i = 0; i < 4; i++){
    if(!validColors.includes(guess.charAt(i))){
      return new Error(`Color ${guess.charAt(i)} is invalid!`)
    }
  }
  //add the last guess to the end of the list
  this.guesses.push(guess);
  this.state = "Waiting for maker to evaluate...";

  let data = messages.O_GAME_STATE;
  data.state = this.state;

  if(this.guesser_ws != null){
    this.guesser_ws.send(JSON.stringify(data));
  }

  if(this.maker_ws != null){
    this.maker_ws.send(JSON.stringify(data));

    // Send the guess made to the maker
    data = messages.O_MAKE_GUESS;
    data.guess = guess;
    this.maker_ws.send(JSON.stringify(data));
  }

};


/*
 * Set the secret code
 */
game.prototype.setCode = function(code){
  if(this.aborted){
    return new Error("This game has been aborted!");
  }

  if(this.code != null){
    return new Error("You cannot change the code once it is set!")
  }

  if(typeof code != "string"){
    return new Error("Code must be of type string!");
  }

  if(code.length != 4){
    return new Error("Code is not valid");
  }

  for(let i = 0; i < 4; i++){
    if(!validColors.includes(code.charAt(i))){
      return new Error(`Color ${code.charAt(i)} is invalid!`)
    }
  }
  this.code = code;
  if(this.guesser != null){
    this.state = "Waiting for guesser to guess..."
  }
  let data = messages.O_GAME_STATE;
  data.state = this.state;
  if(this.maker_ws != null){
    this.maker_ws.send(JSON.stringify(data));
  }

  if(this.guesser_ws != null){
    this.guesser_ws.send(JSON.stringify(data));
    data = messages.O_MAKE_CODE;
    data.code = true;
    this.guesser_ws.send(JSON.stringify(data));
  }
};

function makeEval(code, guess){
  if(this.aborted){
    return new Error("This game has been aborted!");
  }

  let codeVector = [0, 0, 0, 0, 0, 0, 0, 0];
  let guessVector = [0, 0, 0, 0, 0, 0, 0, 0];

  let red = 0;
  let total = 0;
  for(var i = 0; i < 4; i++){
    codeVector[validColors.indexOf(code.charAt(i))]++;
    guessVector[validColors.indexOf(guess.charAt(i))]++;
    if(code.charAt(i) == guess.charAt(i)){
      red++;
    }
  }
  for(var i = 0; i < 8; i++){
    total += Math.min(codeVector[i], guessVector[i]);
  }

  return {
    red: red,
    yellow: total-red
  }
}

/*
 * Check whether an evaluation is valid
 */
game.prototype.addEval = function(e){
  if(this.aborted){
    return new Error("This game has been aborted!");
  }

  if(this.isOver()){
    return new Error("This game is over!")
  }

  if(this.guesses.length <= this.evaluations.length){
    return new Error("Nothing to evaluate!")
  }

  var evaluation = makeEval(this.code, this.guesses[this.evaluations.length]);
  if(evaluation.yellow != e.yellow || evaluation.red != e.red){
    return new Error("This evaluation is not correct!");
  }
  this.evaluations.push(evaluation);

  this.state = "Waiting for guesser to guess a code..."

  if(evaluation.red == 4){
      let data = messages.O_MAKE_CODE;
      data.code = this.code;
      
      // Send the guesser the complete code if they win
      if(this.guesser_ws != null){
        this.guesser_ws.send(JSON.stringify(data));
      }
      this.state = "Guesser has won the game!"
      stats.completed++;
  }else if(this.difficulty <= this.guesses.length){
      let data = messages.O_MAKE_CODE;
      data.code = this.code;
      
      if(this.guesser_ws != null){
        this.guesser_ws.send(JSON.stringify(data));
      }
      this.state = "Maker has won the game!"
      stats.completed++;
  }


  // Send both the new state and the evaluation to both the maker and the guesser
  let data = messages.O_GAME_STATE;

  let ev = messages.O_MAKE_EVAL;
  ev.red = evaluation.red;
  ev.yellow = evaluation.yellow;
  data.state = this.state;

  if(this.maker_ws != null){
    this.maker_ws.send(JSON.stringify(data));
    this.maker_ws.send(JSON.stringify(ev));
  }

  if(this.guesser_ws != null){
    this.guesser_ws.send(JSON.stringify(data));
    this.guesser_ws.send(JSON.stringify(ev));
  }
}

/*
 * Add a new player to the game
 */
game.prototype.addPlayer = function(id){
  if(this.aborted){
    return new Error("This game has been aborted!");
  }

  if(this.maker == null){
    this.maker = id;
  }else if(this.guesser == null){
    this.guesser = id;
  }else{
    return new Error("Room is already full!")
  }

  if(this.code == null){
    this.state = "Waiting for maker to create the code..."
  }else{
    this.state = "Waiting for guesser to guess a code..."
  }

  let data = messages.O_GAME_STATE;
  data.state = this.state;

  if(this.maker_ws != null){
    this.maker_ws.send(JSON.stringify(data));
  }else{
    this.guesser_ws.send(JSON.stringify(data));
  }
}


game.prototype.abortGame = function(){
  if(this.isOver()){
    return new Error("Game already over!");
  }

  this.aborted = true;
  this.state = "The game has been aborted!";

  // Notify the players that the game is over
  if(this.maker_ws != null){
    this.maker_ws.send(messages.S_GAME_ABORTED);
  }

  if(this.guesser_ws != null){
    this.guesser_ws.send(messages.S_GAME_ABORTED);
  }
  stats.completed++;
};


module.exports = game
