'use strict'

import {md} from 'node-forge'

export default md5 = (x) -> md.md5.create().update(x).digest().toHex()