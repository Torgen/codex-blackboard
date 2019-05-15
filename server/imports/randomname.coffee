'use strict'
# This wrapper is needed because it guarantees that node-random-name isn't
# compiled into the client when it's used from code in lib that's guarded by
# Meteor.isServer.

import randomname from 'node-random-name'
export default RandomName = randomname
