---
---

# Helper methods from myoExtended
# https://github.com/MisterJack49/myoReveal/blob/master/myoExtended.js
getRoll = (data)->
  roll = Math.atan2(2.0 * (data.w * data.x + data.y * data.z), 1.0 - 2.0 * (data.x * data.x + data.y * data.y))
  roll_w = ((roll + Math.PI)/(Math.PI * 2.0) * 18)
  roll_w

getPitch = (data)->
  pitch = Math.asin(Math.max(-1.0, Math.min(1.0, 2.0 * (data.w * data.y - data.z * data.x))))
  pitch_w = ((pitch + Math.PI/2.0)/Math.PI * 18)
  pitch_w

getYaw = (data)->
  yaw = Math.atan2(2.0 * (data.w * data.z + data.x * data.y), 1.0 - 2.0 * (data.y * data.y + data.z * data.z))
  yaw_w = ((yaw + Math.PI/2.0)/Math.PI * 18)
  yaw_w



# My Code
yValue = 0
xValue = 0
baseYaw = null
myo = Myo.create()


getBaseYaw = (data)->
  baseYaw = getYaw(data.lastIMU.orientation)

# Use the accelerometer to get the up/down pitch of the arm
myo.on 'accelerometer', (data)->
  if @direction == 'toward_elbow'
    yValue = -data.x
  else
    yValue = data.x

# Use the orientation to get the "yaw", which can be used to determine
# which direction the arm is facing
myo.on 'orientation', (data)->
  getBaseYaw(this) unless baseYaw?
  thisYaw = getYaw(@lastIMU.orientation)
  xValue = -(thisYaw - baseYaw) / 5


myo.on 'fist', (edge)->
  console.debug 'fist'


# Make a new scene and camera
scene = new THREE.Scene()
camera = new THREE.PerspectiveCamera 75, window.innerWidth / window.innerHeight, 0.1, 1000

# Make a renderer and add it to the page
renderer = new THREE.WebGLRenderer()
renderer.setSize window.innerWidth, window.innerHeight
document.body.appendChild renderer.domElement

# Make a cube
geometry = new THREE.BoxGeometry 1, 1, 1
material = new THREE.MeshBasicMaterial
  color: 0x00ff00
cube = new THREE.Mesh geometry, material
scene.add cube

camera.position.z = 5

# Render Loop
render = ->
  requestAnimationFrame render
  # cube.rotation.x += 0.1
  # cube.rotation.y += 0.1
  cube.translateY yValue
  cube.translateX xValue
  renderer.render scene, camera
render()
