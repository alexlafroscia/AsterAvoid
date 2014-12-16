function Controller(type, myo) {
  this.type = type;
  this.myo = myo;
  this.xValue = 0;
  this.yValue = 0;
  this.baseYaw = null;

  if (type == 'myo') {
    // Use the accelerometer to get the up/down pitch of the arm
    var controller = this;
    myo.on('accelerometer', function(data) {
      if (this.direction == 'toward_elbow') {
        controller.yValue = -data.x;
      } else {
        controller.yValue = data.x;
      }
    });

    // Use the orientation to get the "yaw", which can be used to determine
    // which direction the arm is facing
    myo.on('orientation', function(data) {
      if (controller.baseYaw === null)
        controller.getBaseYaw();
      var thisYaw = controller.getYaw();
      controller.xValue = -(thisYaw - controller.baseYaw) / 5;
    });
  }
}


// Get the yaw fromt this controller
Object.defineProperties(Controller.prototype, {
  getYaw: {
    value: function() {
      if (this.type == 'myo') {
        var data = this.myo.lastIMU.orientation;
        var yaw = Math.atan2(2.0 * (data.w * data.z + data.x * data.y), 1.0 - 2.0 * (data.y * data.y + data.z * data.z));
        var yaw_w = ((yaw + Math.PI/2.0)/Math.PI * 18);
        return yaw_w;
      }
    }
  },

  // Get the base yaw for this controller, so we can compute the difference
  getBaseYaw: {
    value: function() {
      if (this.type == 'myo') {
        this.baseYaw = this.getYaw();
      }
    }
  }
});

module.exports = Controller;

