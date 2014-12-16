function Player(controller) {
  this.controller = controller;
}

Object.defineProperties(Player.prototype, {
  xValue: {
    get: function() {
      return this.controller.xValue;
    }
  },
  yValue: {
    get: function() {
      return this.controller.yValue;
    }
  }
});

module.exports = Player;
