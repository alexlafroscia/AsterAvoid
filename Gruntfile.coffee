module.exports = (grunt)->

  grunt.initConfig
    pkg: grunt.file.readJSON 'package.json'

    # grunt-contrib-connect
    connect:
      server:
        options:
          port: 8000
          livereload: true

    # grunt-contrib-watch
    watch:
      js:
        files: ['src/**/*.coffee', 'src/**/*.js']
        tasks: ['build']
        options:
          livereload: true

    # grunt-browserify
    browserify:
      dist:
        files:
          'dist/app.js': ['src/**/*.js', 'src/**/*.coffee']
        options:
          transform: ['coffeeify']


  ###
  # Load NPM Modules
  ###
  grunt.loadNpmTasks 'grunt-contrib-connect'
  grunt.loadNpmTasks 'grunt-contrib-watch'
  grunt.loadNpmTasks 'grunt-browserify'


  ###
  # Grunt Tasks
  ###
  grunt.registerTask 'default', ['server']

  grunt.registerTask 'server', [
    'build',
    'connect:server',
    'watch'
  ]

  grunt.registerTask 'build', [
    'browserify:dist'
  ]

