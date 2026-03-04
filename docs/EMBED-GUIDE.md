# Widget Embed Guide

Add the AI Sales Agent to any website with 2 lines of code.

---

## The Code

```html
<script>window.SA_CONFIG={apiUrl:"https://YOUR-APP.up.railway.app"};</script>
<script src="https://YOUR-APP.up.railway.app/widget/embed.js" defer></script>
```

Replace `YOUR-APP.up.railway.app` with your actual deployment URL.

---

## Platform Instructions

### WordPress
1. Go to **Appearance > Theme Editor > header.php** (or use a plugin like "Insert Headers and Footers")
2. Paste the code just before `</body>` or `</head>`
3. Save

**Plugin option:** Install "WPCode" plugin > Add New Snippet > HTML > Paste code > Set location to "Site Wide Footer" > Activate

### Wix
1. Go to **Settings > Custom Code**
2. Click **+ Add Custom Code**
3. Paste the code
4. Set placement to **Body - end**
5. Apply to **All pages**
6. Publish

### Webflow
1. Go to **Project Settings > Custom Code**
2. Paste in the **Footer Code** section
3. Publish

### Squarespace
1. Go to **Settings > Advanced > Code Injection**
2. Paste in the **Footer** section
3. Save

### Shopify
1. Go to **Online Store > Themes > Edit Code**
2. Open `theme.liquid`
3. Paste before `</body>`
4. Save

### Plain HTML
Add the code before `</body>` in your HTML file.

---

## Configuration Options

You can customize the widget by setting `SA_CONFIG` before loading embed.js:

```html
<script>
window.SA_CONFIG = {
  apiUrl: "https://YOUR-APP.up.railway.app",  // Required
  companyName: "Your Company",                  // Optional override
  primaryColor: "#2563eb",                      // Optional override
  position: "bottom-right"                      // "bottom-right" or "bottom-left"
};
</script>
<script src="https://YOUR-APP.up.railway.app/widget/embed.js" defer></script>
```

---

## Troubleshooting

**Widget doesn't appear?**
- Check browser console (F12) for errors
- Verify the apiUrl is correct and the server is running
- Make sure the script is loading (check Network tab)

**CORS error?**
- Add your website domain to ALLOWED_ORIGINS in the server environment variables
- Example: `ALLOWED_ORIGINS=https://yoursite.com,https://www.yoursite.com`

**Widget appears but no messages?**
- Check if the server health endpoint works: visit `{apiUrl}/health`
- Verify ANTHROPIC_API_KEY is set in the server environment
