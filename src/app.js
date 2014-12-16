// Require components from other files
var Myo = require('myo');
var Ship = require('./ship.js');
var Player = require('./player.js');
var Game = require('./game.js');
var Controller = require('./controller.js');


// Start the game
var game = new Game();
var myo = Myo.create();
var controller = new Controller('myo', myo);
var ship = new Ship();
var player1 = new Player(controller, ship);

game.addPlayer(ship);

// Render Loop
function render() {
  requestAnimationFrame(render);
  player1.updatePosition();
  game.rerender();
}
render();
