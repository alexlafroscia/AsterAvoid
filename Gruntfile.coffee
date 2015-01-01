module.exports = (grunt)->

  grunt.initConfig
    pkg: grunt.file.readJSON 'package.json'

    # grunt-contrib-connect
    connect:
      server:
        options:
          port: 8000
          livereload: true
          base: 'dist/'

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

    # grunt-contrib-copy
    copy:
      html:
        files: [{
          expand: true
          flatten: true
          src: ['src/index.html']
          dest: 'dist/'
        }]
      models:
        files: [{
          expand: true
          flatten: true
          src: ['models/*.json']
          dest: 'dist/models'
        }]


  ###
  # Load NPM Modules
  ###
  grunt.loadNpmTasks 'grunt-contrib-connect'
  grunt.loadNpmTasks 'grunt-contrib-watch'
  grunt.loadNpmTasks 'grunt-browserify'
  grunt.loadNpmTasks 'grunt-contrib-copy'


  ###
  # Grunt Tasks
  ###
  grunt.registerTask 'default', ['server']

  grunt.registerTask 'serve', ['server']
  grunt.registerTask 'server', [
    'build',
    'connect:server',
    'watch'
  ]

  grunt.registerTask 'build', [
    'browserify:dist',
    'copy:html',
    'copy:models'
  ]

