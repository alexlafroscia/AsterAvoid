function Player(controller, ship) {
  this.controller = controller;
  this.ship = ship;
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
  },
  updatePosition: {
    value: function() {
      this.ship.move(this.xValue, this.yValue);
    }
  }
});

module.exports = Player;
