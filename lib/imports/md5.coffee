'use strict'

import { createHash } from 'crypto' 

export default md5 = (x) -> createHash('md5').update(x).digest('hex')
