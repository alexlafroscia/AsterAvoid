# Instance getter/setter through Object.defineProperty
# http://stackoverflow.com/a/11592890
Function::property = (prop, desc) ->
  Object.defineProperty @prototype, prop, desc

# Require components from other files
Myo = require('myo')
Ship = require('./ship.coffee')
Player = require('./player.coffee')
Game = require('./game.coffee')
Controller = require('./controller.coffee')


# Start the game
game = new Game()
myo = Myo.create()
controller = new Controller('myo', myo)
ship = new Ship()
player1 = new Player(controller, ship)

game.addPlayer(player1)

# Render Loop
render = ->
  requestAnimationFrame(render)
  for i in [0...game.players.length]
    game.players[i].updatePosition()
  game.rerender()
render()
