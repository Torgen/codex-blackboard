'use strict'

import {waitForSubscriptions, afterFlushPromise, promiseCall, login, logout} from '/client/imports/app_test_helpers.coffee'
import Router from '/client/imports/router.coffee'
import chai from 'chai'
import sinon from 'sinon'

describe 'projector', ->
  @timeout 20000
  clock = null
  beforeEach ->
    clock = sinon.useFakeTimers toFake: ['setInterval']

  afterEach ->
    clock.restore()

  before ->
    await login('testy', 'Teresa Tybalt', '', 'failphrase')

  after ->
    await logout()

  it 'operates', ->
    Router.ProjectorPage()
    await afterFlushPromise()
    page = $('#projector_page')
    unless page.children().size()
      await new Promise (resolve) -> page.one('loaded', resolve)
    chai.assert.isTrue page.find('[data-projector-view="chart"]').hasClass('projector-current-view')
    chai.assert.isTrue page.find('[data-projector-view="map"]').hasClass('projector-hidden-view')
    chai.assert.isTrue page.find('[data-projector-view="graph"]').hasClass('projector-hidden-view')
    clock.tick 9000
    await afterFlushPromise()
    chai.assert.isTrue page.find('[data-projector-view="chart"]').hasClass('projector-current-view')
    chai.assert.isTrue page.find('[data-projector-view="map"]').hasClass('projector-hidden-view')
    chai.assert.isTrue page.find('[data-projector-view="graph"]').hasClass('projector-hidden-view')
    clock.tick 1000
    await afterFlushPromise()
    chai.assert.isTrue page.find('[data-projector-view="chart"]').hasClass('projector-previous-view')
    chai.assert.isTrue page.find('[data-projector-view="map"]').hasClass('projector-current-view')
    chai.assert.isTrue page.find('[data-projector-view="graph"]').hasClass('projector-hidden-view')
    clock.tick 10000
    await afterFlushPromise()
    chai.assert.isTrue page.find('[data-projector-view="chart"]').hasClass('projector-hidden-view')
    chai.assert.isTrue page.find('[data-projector-view="map"]').hasClass('projector-previous-view')
    chai.assert.isTrue page.find('[data-projector-view="graph"]').hasClass('projector-current-view')
    clock.tick 10000
    await afterFlushPromise()
    chai.assert.isTrue page.find('[data-projector-view="chart"]').hasClass('projector-current-view')
    chai.assert.isTrue page.find('[data-projector-view="map"]').hasClass('projector-hidden-view')
    chai.assert.isTrue page.find('[data-projector-view="graph"]').hasClass('projector-previous-view')
