BaseController = require('./base.coffee')

class ArrowKeyController extends BaseController

  constructor: ->
    super()

    MOVE_AMOUNT = 0.5

    document.addEventListener 'keydown', (e)=>
      e = e || window.event
      switch e.which
        when 39
          @xValue = MOVE_AMOUNT
          break
        when 37
          @xValue = -MOVE_AMOUNT
          break
        when 38
          @yValue = MOVE_AMOUNT
          break
        when 40
          @yValue = -MOVE_AMOUNT
          break

    document.addEventListener 'keyup', (e)=>
      e = e || window.event
      e = e || window.event
      switch e.which
        when 39, 37
          @xValue = 0
          break
        when 38, 40
          @yValue = 0
          break


  getBaseYaw: ->
    return 0



module.exports = ArrowKeyController
