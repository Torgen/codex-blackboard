'use strict'

# In order to use all threads of the machine and preserve session stickiness,
# we need to run one instance of the app per CPU and use source hashing to
# distribute load between them. (If we didn't need stickiness, we could use
# the 'cluster' node.js addon, if there was a way to insert starting the
# children into the startup code, which I haven't fonud yet.)
# Since the app does batch processing, we need to disable it in all but one
# instance. (Or we run N+1 instances, one of which doesn't serve user traffic,
# which is what we'll actually do.) We won't be able to detect that any
# particular instance is doing the batch processing, so we will use an
# environment variable / setting from json to configure it. Batch processing
# has to be enabled by default, since many users will just run meteor in dev
# mode and won't even know it's an option.
share.DO_BATCH_PROCESSING = !(Meteor.settings.disableBatch ? process.env.DISABLE_BATCH_PROCESSING)
