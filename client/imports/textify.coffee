'use strict'

# Convert an HTML string to 
export default textify = (string) ->
  div = document.createElement 'div'
  div.innerHTML = string
  return div.innerText
