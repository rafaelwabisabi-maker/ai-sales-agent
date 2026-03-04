/**
 * AI Sales Agent — Embed Script
 *
 * Usage: Add this to any website:
 *
 * <script>
 *   window.SA_CONFIG = {
 *     apiUrl: 'https://your-backend.railway.app',
 *     companyName: 'Your Company',
 *     primaryColor: '#2563eb'
 *   };
 * </script>
 * <script src="https://your-backend.railway.app/widget/embed.js" defer></script>
 */
(function() {
  'use strict';

  var config = window.SA_CONFIG || {};
  var apiUrl = config.apiUrl || '';

  if (!apiUrl) {
    console.error('[AI Sales Agent] Missing apiUrl in SA_CONFIG');
    return;
  }

  // Load widget in an iframe for style isolation
  var iframe = document.createElement('iframe');
  iframe.id = 'sa-widget-frame';
  iframe.src = apiUrl + '/widget/chat-widget.html';
  iframe.allow = 'clipboard-write';
  iframe.title = 'Chat Widget';

  // Start COLLAPSED: small area for the trigger button only (no page blocking)
  // The 80x80 area covers the FAB trigger button (60x60 + margins)
  iframe.style.cssText = 'position:fixed;bottom:0;right:0;width:80px;height:80px;border:none;z-index:99999;pointer-events:auto;background:transparent;';

  // Listen for widget state changes (open/close) from inside the iframe
  window.addEventListener('message', function(event) {
    if (!event.data || event.data.type !== 'SA_WIDGET_STATE') return;

    if (event.data.open) {
      // Chat opened: expand iframe to full chat size
      iframe.style.width = '420px';
      iframe.style.height = '640px';
    } else {
      // Chat closed: shrink back to just the trigger button area
      iframe.style.width = '80px';
      iframe.style.height = '80px';
    }
  });

  // Pass config to iframe once loaded
  iframe.addEventListener('load', function() {
    try {
      iframe.contentWindow.postMessage({ type: 'SA_CONFIG', config: config }, '*');
    } catch (e) {
      // Cross-origin, config was already applied via URL
    }
  });

  // Add to page when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      document.body.appendChild(iframe);
    });
  } else {
    document.body.appendChild(iframe);
  }
})();
