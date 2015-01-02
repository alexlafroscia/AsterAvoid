BaseController = require('./base.coffee')

class WASDKeyController extends BaseController

  constructor: ->
    super()

    MOVE_AMOUNT = 0.5

    document.addEventListener 'keydown', (e)=>
      e = e || window.event
      switch e.which
        when 68
          @xValue = MOVE_AMOUNT
          break
        when 65
          @xValue = -MOVE_AMOUNT
          break
        when 87
          @yValue = MOVE_AMOUNT
          break
        when 83
          @yValue = -MOVE_AMOUNT
          break

    document.addEventListener 'keyup', (e)=>
      e = e || window.event
      switch e.which
        when 65, 68
          @xValue = 0
          break
        when 87, 83
          @yValue = 0
          break


  getBaseYaw: ->
    return 0



module.exports = WASDKeyController

