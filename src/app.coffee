# Require components from other files
Myo = require('myo')
Ship = require('./ship.js')
Player = require('./player.js')
Game = require('./game.js')
Controller = require('./controller.js')


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
