class Game

  constructor: ->
    @players = []

    # Make a new scene and camera
    @scene = new THREE.Scene()
    @camera = new THREE.PerspectiveCamera(
      75,                                       # Field of View
      window.innerWidth / window.innerHeight,   # Aspect Ratio
      0.1,                                      # Near
      1000                                      # Far
    )
    @camera.position.set 0, 10, 10
    @camera.lookAt @scene.position
    @camera.position.z = 5

    # Make a renderer and add it to the page
    @renderer = new THREE.WebGLRenderer()
    @renderer.setSize window.innerWidth, window.innerHeight
    document.body.appendChild @renderer.domElement


  ###
  # Instance methods
  ###

  # Rerender the scene
  rerender: ->
    @renderer.render @scene, @camera

  # Add a player to the game
  addPlayer: (player)->
    @players.push player
    @scene.add player.ship.geo

module.exports = Game
