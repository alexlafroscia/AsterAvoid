BaseController = require('./base.coffee')

class TiltController extends BaseController

  constructor: ->
    super()

    # Detect orientation event
    # Borrowed from http://stackoverflow.com/a/4378439/2250435
    if window.DeviceOrientationEvent
      window.addEventListener 'deviceorientation', =>
        @tilt event.beta, event.gamma
      , true
    else if window.DeviceMotionEvent
      window.addEventListener 'devicemotion', =>
        @tilt event.acceleration.x * 2, event.acceleration.y * 2
      , true
    else
      window.addEventListener 'MozOrientation', =>
        @tilt orientation.x * 50, orientation.y * 50
      , true


  tilt: (beta, gamma)->
    @baseYaw = gamma unless @baseYaw?
    @xValue = beta / 15
    @yValue = (gamma - @baseYaw) / 20


module.exports = TiltController
