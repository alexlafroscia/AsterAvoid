class Player

  constructor: (@controller, @ship)->


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
    @ship.move @xValue, @yValue

module.exports = Player
