class Game

  constructor: ->
    @players = []

    width = window.innerWidth
    height = window.innerHeight

    # Make a new scene and camera
    @scene = new THREE.Scene()
    @camera = new THREE.PerspectiveCamera(
      75,                                       # Field of View
      width / height,                           # Aspect Ratio
      0.1,                                      # Near
      1000                                      # Far
    )
    @camera.position.set 0, 10, 10
    @camera.lookAt @scene.position
    @camera.position.z = 5

    # Make a renderer and add it to the page
    @renderer = new THREE.WebGLRenderer()
    @renderer.setSize width, height
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
    player.initMesh @scene

module.exports = Game
