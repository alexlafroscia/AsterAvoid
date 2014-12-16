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
var player1 = new Player(controller);

// Make a cube
geometry = new THREE.BoxGeometry(1, 1, 1);
material = new THREE.MeshBasicMaterial({
  color: 0x00ff00
});

var cube = new THREE.Mesh(geometry, material);

game.scene.add(cube);

game.camera.position.z = 5;

// Render Loop
function render() {
  requestAnimationFrame(render);
  //cube.translateY(player1.yValue);
  //cube.translateX(player1.xValue);
  game.rerender();
}
render();
