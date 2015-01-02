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
        files: [
          'src/js/**/*.coffee',
          'src/js/**/*.js',
          'src/index.html',
          'src/sass/**/*.scss'
        ]
        tasks: ['build:dev']
        options:
          livereload: true

    # grunt-browserify
    browserify:
      dist:
        files:
          'dist/app.js': ['src/js/**/*.js', 'src/js/**/*.coffee']
        options:
          transform: ['coffeeify']


    # grunt-contrib-sass
    sass:
      # Compile Sass without maps and compressed
      dist:
        options:
          style: 'compressed'
          sourcemap: 'none'
        files:
          'dist/app.css': 'src/sass/app.scss'
      # Use source maps, and use the nested style for the output CSS
      dev:
        options:
          style: 'nested'
        files:
          'dist/app.css': 'src/sass/app.scss'


    # grunt-contrib-copy
    copy:
      # Copy the HTML file that glues everything together
      html:
        files: [{
          expand: true
          flatten: true
          src: ['src/index.html']
          dest: 'dist/'
        }]
      # Copy .json models that were exported by Blender
      models:
        files: [{
          expand: true
          flatten: true
          src: ['models/*.json']
          dest: 'dist/models'
        }]
      # Copy the Sass folder so that the source maps can reference the original
      # files in the inspector
      sass:
        src: 'src/sass/*'
        dest: 'dist/'


  ###
  # Load NPM Modules
  ###
  grunt.loadNpmTasks 'grunt-contrib-connect'
  grunt.loadNpmTasks 'grunt-contrib-watch'
  grunt.loadNpmTasks 'grunt-browserify'
  grunt.loadNpmTasks 'grunt-contrib-copy'
  grunt.loadNpmTasks 'grunt-contrib-sass'


  ###
  # Grunt Tasks
  ###
  grunt.registerTask 'default', ['server']

  # Start a local development server, using the development build steps
  grunt.registerTask 'serve', ['server']
  grunt.registerTask 'server', [
    'build:dev',
    'connect:server',
    'watch'
  ]

  # Build the app for production
  grunt.registerTask 'build', [
    'browserify:dist',
    'copy:sass',
    'sass:dist',
    'copy:html',
    'copy:models'
  ]

  # Build the app for local development
  grunt.registerTask 'build:dev', [
    'browserify:dist',
    'copy:sass',
    'sass:dev',
    'copy:html',
    'copy:models'
  ]

