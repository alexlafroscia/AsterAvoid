class Player

  constructor: (@controller, @ship)->

  @property 'xValue',
    get: -> return @controller.xValue

  @property 'yValue',
    get: -> return @controller.yValue

  updatePosition: ->
    @ship.move @xValue, @yValue

module.exports = Player
