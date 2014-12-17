class Ship

  constructor: ->
    geometry = new THREE.BoxGeometry 1, 1, 1
    material = new THREE.MeshBasicMaterial
      color: 0x00ff00
    @geo = new THREE.Mesh geometry, material


  ###
  # Instance methods
  ###

  # Update the location of the ship
  move: (x, y)->
    @geo.translateX x
    @geo.translateY y

module.exports = Ship
