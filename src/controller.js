class Controller {
  contructor(type, myo = null) {
    this.type = type;
  }

  get type() {
    return this.type;
  }
}

module.exports = Controller;

