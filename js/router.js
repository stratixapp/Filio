// js/router.js — Hash-based SPA router

const Router = (() => {
  const routes = {};

  function register(path, handler) {
    routes[path] = handler;
  }

  function navigate(path, replace = false) {
    const url = window.location.pathname + window.location.search + '#' + path;
    if (replace) history.replaceState(null, '', url);
    else         history.pushState(null, '', url);
    dispatch(path);
  }

  function dispatch(path) {
    // Normalize: empty or just '/' both map to '/'
    const p = path || '/';
    if (routes[p])  { routes[p]();  return; }
    // prefix match: '/dashboard/123' → '/dashboard'
    const base = '/' + p.split('/')[1];
    if (routes[base]) { routes[base](); return; }
    if (routes['*'])  routes['*']();
  }

  function current() {
    // hash can be '#/login', '#login', or empty
    let h = window.location.hash;
    h = h.replace(/^#\/?/, '/');   // strip leading # and optional /
    if (!h || h === '/') return '/';
    // ensure leading slash
    if (!h.startsWith('/')) h = '/' + h;
    return h;
  }

  function init() {
    window.addEventListener('hashchange', () => dispatch(current()));
    window.addEventListener('popstate',   () => dispatch(current()));
    dispatch(current());
  }

  return { register, navigate, current, init };
})();
