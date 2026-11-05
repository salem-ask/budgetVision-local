// Thème appliqué avant le premier rendu : pas de flash clair/sombre.
try {
  var t = localStorage.getItem('theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch (e) {}
