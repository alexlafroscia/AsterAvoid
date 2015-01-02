Ship = require('./ship.coffee')

class Player

  constructor: (@controller, @id)->


  ###
  # Instance properties
  ###

  @property 'xValue',
    get: -> return @controller.xValue

  @property 'yValue',
    get: -> return @controller.yValue


  ###
  # Instance methods
  ###

  updatePosition: ->
    @ship?.move @xValue, @yValue, -1

  initMesh: (scene)->
    if @id == 1
      color = 'blue'
    else
      color = 'red'
    @ship = new Ship(scene, color)

module.exports = Player
