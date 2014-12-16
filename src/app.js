var Myo = require('myo');
var Ship = require('./ship.js');
var Player = require('./player.js');
var Game = require('./game.js');
var Controller = require('./controller.js');


// My Code
var yValue = 0;
var xValue = 0;
var baseYaw = null;

// Start the game
var myo = Myo.create();
var controller = new Controller('myo', myo);
var player1 = new Player(controller);


// Make a new scene and camera
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(
  75,                                       // Field of View
  window.innerWidth / window.innerHeight,   // Aspect Ratio (match screen size)
  0.1,                                      // Near
  1000                                      // Far
);
camera.position.set(0, 10, 10);
camera.lookAt(scene.position);

// Make a renderer and add it to the page
var renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Make a cube
geometry = new THREE.BoxGeometry(1, 1, 1);
material = new THREE.MeshBasicMaterial({
  color: 0x00ff00
});
var cube = new THREE.Mesh(geometry, material);
scene.add(cube);

camera.position.z = 5;

// Render Loop
function render() {
  requestAnimationFrame(render);
  cube.translateY(player1.yValue);
  cube.translateX(player1.xValue);
  renderer.render(scene, camera);
}
render();
