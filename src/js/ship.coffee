class Ship

  constructor: (scene, color)->
    material = new THREE.MeshLambertMaterial
      color: color
    material.shading = THREE.FlatShading
    loader = new THREE.JSONLoader()
    loader.load 'models/ship.json', (geometry)=>
      @geo = new THREE.Mesh geometry, material
      @geo.scale.set 1, 1, 1
      @geo.position.y = 0
      @geo.position.x = 0
      @geo.position.z = 0

      # The geometry has to be added in the callback after loading the model, so
      # we need to pass the scene from the game, through the Player, to the
      # ship's constructor
      scene.add @geo

  ###
  # Instance methods
  ###

  # Update the location of the ship
  move: (x, y)->
    @geo?.translateX x
    @geo?.translateY y

module.exports = Ship
