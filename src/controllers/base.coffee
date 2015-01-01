class Controller

  constructor: ()->
    @xValue = 0
    @yValue = 0
    @baseYaw = null

  ###
  # Instance methods
  ###

  # Get the yaw fromt this controller
  getYaw: ->
    throw new Error 'getYaw() needs to implemented by subclass'

  # Get the base yaw for this controller, so we can compute the difference
  getBaseYaw: ->
    throw new Error 'getBaseYaw() needs to implemented by subclass'

module.exports = Controller
