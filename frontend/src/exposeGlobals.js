export default function exposeGlobals(module) {
  for (const key in module) {
    if (typeof module[key] === 'function') {
      window[key] = module[key];
    }
  }
}
