class Obstacle

  ###
  # Class Properties
  ###
  @fieldWidth = 80
  @fieldHeight = 10

  ###
  # Class Methods
  ###
  @createXPosition = ->
    random = Math.floor((Math.random() * Obstacle.fieldWidth) + 1)
    return random - (@fieldWidth / 2)

  @createYPosition = ->
    random = Math.floor((Math.random() * Obstacle.fieldHeight) + 1)
    return random - (@fieldHeight / 2)



  constructor: (zValue)->
    geometry = new THREE.SphereGeometry(
      (Math.random() * 2) + 1,    # radius
      8,    # segments
      10    # rings
    )
    material = new THREE.MeshLambertMaterial
      color: 'green'
    @sphere = new THREE.Mesh geometry, material
    @sphere.position.x = @constructor.createXPosition()
    @sphere.position.y = @constructor.createYPosition()
    @sphere.position.z = zValue

module.exports = Obstacle
