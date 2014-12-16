function Ship() {

  // Make the actual ship object
  geometry = new THREE.BoxGeometry(1, 1, 1);
  material = new THREE.MeshBasicMaterial({
    color: 0x00ff00
  });

  this.geo = new THREE.Mesh(geometry, material);
}

Object.defineProperties(Ship.prototype, {
  // Update the location of the ship
  move: {
    value: function(x, y) {
      this.geo.translateX(x);
      this.geo.translateY(y);
    }
  }
});

module.exports = Ship;
