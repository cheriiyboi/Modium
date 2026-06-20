// ─── NATIVE BRIDGE (Capacitor / Android only — no-ops on plain web) ───
(function () {
  if (!window.Capacitor || !window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) return;

  var Plugins = window.Capacitor.Plugins || {};
  var StatusBar = Plugins.StatusBar;
  var SplashScreen = Plugins.SplashScreen;
  var App = Plugins.App;

  // Match the native status bar to the app's near-black theme.
  if (StatusBar) {
    try {
      StatusBar.setBackgroundColor({ color: '#09090b' });
      StatusBar.setStyle({ style: 'DARK' });
      StatusBar.setOverlaysWebView({ overlay: false });
    } catch (e) {}
  }

  // Hide the splash screen once the app has actually booted (not on a fixed timer),
  // so first paint never looks like a flash of blank screen.
  function dismissSplash() {
    if (!SplashScreen) return;
    SplashScreen.hide({ fadeOutDuration: 220 }).catch(function () {});
  }
  if (window.__reverieBooted) dismissSplash();
  else window.addEventListener('reverie:booted', dismissSplash, { once: true });

  // Hardware/gesture back button: pop in-app navigation instead of instantly
  // killing the app, with a double-press-to-exit confirmation at the root.
  if (App) {
    var backStack = [];
    var exitArmed = false;
    var exitTimer = null;

    window.reverieNavPush = function (screen) {
      if (backStack[backStack.length - 1] !== screen) backStack.push(screen);
    };

    App.addListener('backButton', function () {
      var topLevel = ['home', 'personas', 'settings', 'chats'];
      var s = (window.S && window.S.screen) || 'home';

      if (!topLevel.includes(s)) {
        // Inside a detail/edit screen — go back to a sensible parent.
        var parent = { chat: 'charDetail', charDetail: 'home', editChar: 'home', editPersona: 'personas' }[s] || 'home';
        if (typeof go === 'function') go(parent);
        return;
      }

      if (s !== 'home') {
        if (typeof go === 'function') go('home');
        return;
      }

      // Already at home — require a second back press within 2s to exit.
      if (exitArmed) {
        App.exitApp();
        return;
      }
      exitArmed = true;
      if (typeof showToast === 'function') showToast('Press back again to exit', 'info');
      clearTimeout(exitTimer);
      exitTimer = setTimeout(function () { exitArmed = false; }, 2000);
    });
  }
})();
