class Controller

  constructor: (@type, @myo = null)->
    @xValue = 0
    @yValue = 0
    @baseYaw = null

    if type == 'myo'
      # Use the accelerometer to get the up/down pitch of the arm
      myo.on 'accelerometer', (data)=>
        if @direction == 'toward_elbow'
          controller.yValue = -data.x
        else
          controller.yValue = data.x

      # Use the orientation to get the "yaw", which can be used to determine
      # which direction the arm is facing
      myo.on 'orientation', (data)=>
        @getBaseYaw() unless @baseYaw?
        thisYaw = @getYaw()
        @xValue = -(thisYaw - @baseYaw) / 5


  ###
  # Instance methods
  ###

  # Get the yaw fromt this controller
  getYaw: ->
    if (@type == 'myo')
      data = @myo.lastIMU.orientation
      p1 = 2.0 * (data.w * data.z + data.x * data.y)
      yaw = Math.atan2(p1, 1.0 - 2.0 * (data.y * data.y + data.z * data.z))
      yaw_w = ((yaw + Math.PI/2.0)/Math.PI * 18)
      return yaw_w

  # Get the base yaw for this controller, so we can compute the difference
  getBaseYaw: ->
    if @type == 'myo'
      @baseYaw = @getYaw()

module.exports = Controller

