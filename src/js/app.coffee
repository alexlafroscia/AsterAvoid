# Instance getter/setter through Object.defineProperty
# http://stackoverflow.com/a/11592890
Function::property = (prop, desc) ->
  Object.defineProperty @prototype, prop, desc

# Require components from other files
Game = require('./game.coffee')
Player = require('./player.coffee')
WASDKeyController = require('./controllers/wasd_keys.coffee')
ArrowKeyController = require('./controllers/arrow_keys.coffee')


# Start the game
game = new Game()

# Set up the Render Loop
render = ->
  requestAnimationFrame(render)
  for i in [0...game.players.length]
    game.players[i].updatePosition()

  # Add a new obstacle
  game.addObstacle()

  # Tell the game to re-render the screen
  game.rerender()


wasdController = new WASDKeyController()
player1 = new Player(wasdController, 1)

arrowController = new ArrowKeyController()
player2 = new Player(arrowController, 2)

game.addPlayer(player1)
game.addPlayer(player2)

# Start the game
render()
