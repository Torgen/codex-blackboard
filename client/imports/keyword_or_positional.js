export default function (name, args) {
  if (!(args == null) && typeof args !== "string" && typeof args !== "number") {
    return args.hash;
  }
  const a = {};
  a[name] = args;
  return a;
}
