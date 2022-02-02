var express = require('express');
const stats = require("../stats");

// Create a new router object
var router = express.Router();

/* GET game page. */
router.get('/game', function(req, res) {
  // Send the game.html file in ./public folder
  res.sendFile("game.html", {root : "./public"})
});

/* GET home page. */
router.get('/', function(req, res) {
  // Replace the special fields in splash.html with their values
  res.render('splash.ejs', 
  {played: stats.started, 
    completed: stats.completed,
    ongoing: stats.started - stats.completed});
});

module.exports = router;
