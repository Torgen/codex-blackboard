'use strict'

import {chunk_text} from './imports/chunk_text.coffee'

Template.text_chunks.helpers
  chunks: -> chunk_text @

Template.text_chunk_url_image.helpers
  image: (url) -> url.match(/(\.|format=)(png|jpg|jpeg|gif)$/i)

Template.dynamic_no_whitespace.helpers
  chooseTemplate: (name) ->
    Blaze._getTemplate name, -> Template.instance()
