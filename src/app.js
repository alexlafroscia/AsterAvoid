var Myo = require('myo');

// Helper methods from myoExtended
// https://github.com/MisterJack49/myoReveal/blob/master/myoExtended.js
function getRoll(data) {
  var roll = Math.atan2(2.0 * (data.w * data.x + data.y * data.z), 1.0 - 2.0 * (data.x * data.x + data.y * data.y));
  var roll_w = ((roll + Math.PI)/(Math.PI * 2.0) * 18);
  return roll_w;
}

function getPitch(data) {
  var pitch = Math.asin(Math.max(-1.0, Math.min(1.0, 2.0 * (data.w * data.y - data.z * data.x))));
  var pitch_w = ((pitch + Math.PI/2.0)/Math.PI * 18);
  return pitch_w;
}

function getYaw(data) {
  var yaw = Math.atan2(2.0 * (data.w * data.z + data.x * data.y), 1.0 - 2.0 * (data.y * data.y + data.z * data.z));
  var yaw_w = ((yaw + Math.PI/2.0)/Math.PI * 18);
  return yaw_w;
}



// My Code
var yValue = 0;
var xValue = 0;
var baseYaw = null;
var myo = Myo.create();


function getBaseYaw(data) {
  baseYaw = getYaw(data.lastIMU.orientation);
}

// Use the accelerometer to get the up/down pitch of the arm
myo.on('accelerometer', function(data) {
  if (this.direction == 'toward_elbow') {
    yValue = -data.x;
  } else {
    yValue = data.x;
  }
});

// Use the orientation to get the "yaw", which can be used to determine
// which direction the arm is facing
myo.on('orientation', function(data) {
  if (baseYaw === null)
    getBaseYaw(this);
  var thisYaw = getYaw(this.lastIMU.orientation);
  xValue = -(thisYaw - baseYaw) / 5;
});


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
  //cube.translateY(yValue);
  //cube.translateX(xValue);
  renderer.render(scene, camera);
}
render();
