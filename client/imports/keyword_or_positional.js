/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let keyword_or_positional;
export default keyword_or_positional = function(name, args) {
  if ((!(args == null)) && 
    (typeof(args) !== 'string') && (typeof(args) !== 'number')) { return args.hash; }
  const a = {};
  a[name] = args;
  return a;
};
