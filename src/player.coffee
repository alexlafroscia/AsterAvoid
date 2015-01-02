Ship = require('./ship.coffee')

class Player

  constructor: (@controller)->


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
    @ship = new Ship(scene)

module.exports = Player
