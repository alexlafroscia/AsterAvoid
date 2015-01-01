# Instance getter/setter through Object.defineProperty
# http://stackoverflow.com/a/11592890
Function::property = (prop, desc) ->
  Object.defineProperty @prototype, prop, desc

# Require components from other files
Game = require('./game.coffee')
Player = require('./player.coffee')
MyoController = require('./controllers/myo.coffee')


# Start the game
game = new Game()
controller = new MyoController()
player1 = new Player(controller)

game.addPlayer(player1)

# Render Loop
render = ->
  requestAnimationFrame(render)
  for i in [0...game.players.length]
    game.players[i].updatePosition()
  game.rerender()
render()
