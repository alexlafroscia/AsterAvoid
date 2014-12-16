function Game() {
  this.players = [];

  // Make a new scene and camera
  this.scene = new THREE.Scene();
  this.camera = new THREE.PerspectiveCamera(
    75,                                       // Field of View
    window.innerWidth / window.innerHeight,   // Aspect Ratio (match screen size)
    0.1,                                      // Near
    1000                                      // Far
  );
  this.camera.position.set(0, 10, 10);
  this.camera.lookAt(this.scene.position);
  this.camera.position.z = 5;

  // Make a renderer and add it to the page
  this.renderer = new THREE.WebGLRenderer();
  this.renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(this.renderer.domElement);

}


Object.defineProperties(Game.prototype, {

  // Rerender the scene
  rerender: {
    value: function() {
      this.renderer.render(this.scene, this.camera);
    }
  },

  // Add a player to the game
  addPlayer: {
    value: function(player) {
      this.players.push(player);
      this.scene.add(player.ship.geo);
    }
  }
});

module.exports = Game;

