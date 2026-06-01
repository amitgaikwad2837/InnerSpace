# GitHub Pages Deployment Guide for InnerSpace Marketing Website

## Quick Start

The InnerSpace marketing website is now ready to deploy to GitHub Pages. Here's how:

### Step 1: Enable GitHub Pages

1. Go to your GitHub repository: https://github.com/amitgaikwad2837/InnerSpace
2. Click on **Settings** (top-right menu)
3. On the left sidebar, click **Pages**
4. Under "Build and deployment":
   - **Source**: Select "Deploy from a branch"
   - **Branch**: Select `main` (or your default branch)
   - **Folder**: Select `/marketing`
5. Click **Save**

GitHub will automatically deploy your site in a few minutes.

### Step 2: Access Your Site

Your marketing website will be available at:
```
https://amitgaikwad2837.github.io/InnerSpace/
```

(Replace `amitgaikwad2837` with your GitHub username)

## What's Included

```
marketing/
├── index.html           # Landing page with hero, features, modes, testimonials
├── privacy.html         # Privacy Policy
├── terms.html           # Terms of Service
├── README.md            # This guide
└── DEPLOY.md            # Deployment instructions (this file)
```

## Features of the Marketing Site

✅ **Modern Design** — Dark theme with gradient accents  
✅ **Responsive** — Works perfectly on mobile, tablet, and desktop  
✅ **Fast** — No dependencies, pure HTML/CSS, no build step  
✅ **SEO Friendly** — Proper meta tags, semantic HTML  
✅ **Accessible** — Good contrast, readable fonts, semantic structure  

## Customization Before Launch

### 1. Update Links

In `index.html`, find and update these placeholders:

```html
<!-- App Store button -->
<a href="https://apps.apple.com/app/innerspace/..." class="store-button">
    <span class="store-icon">🍎</span>
    ...
</a>

<!-- Google Play button -->
<a href="https://play.google.com/store/apps/details?id=..." class="store-button">
    <span class="store-icon">🤖</span>
    ...
</a>
```

### 2. Update Social Links

In the footer, update social media links:

```html
<div class="social-links">
    <a href="https://github.com/amitgaikwad2837/InnerSpace" title="GitHub">🐙</a>
    <a href="https://twitter.com/yourhandle" title="Twitter">𝕏</a>
    <a href="https://linkedin.com/company/innerspace" title="LinkedIn">💼</a>
    <a href="https://discord.gg/yourserver" title="Discord">💬</a>
</div>
```

### 3. Update Contact Email

Update the contact email addresses in `privacy.html` and `terms.html`:

```html
<a href="mailto:privacy@innerspace.app">privacy@innerspace.app</a>
<a href="mailto:support@innerspace.app">support@innerspace.app</a>
```

### 4. Add More Pages

To add an about page, blog, or FAQ:

1. Create a new HTML file (e.g., `about.html`)
2. Use the same HTML structure as `index.html`
3. Copy the `<nav>` and `<footer>` sections to keep consistency
4. Update navigation links across all pages to include your new page

## Performance Tips

- **No external dependencies** — Everything loads instantly
- **No JavaScript frameworks** — Pure CSS animations
- **No image optimization needed** — Uses emoji and CSS gradients

## SEO Optimization

The site includes:
- ✅ Meta description tags
- ✅ Open Graph tags (for social media)
- ✅ Semantic HTML
- ✅ Readable heading structure
- ✅ Mobile-responsive viewport

To improve SEO further:

1. **Add Google Search Console** — Verify your domain at https://search.google.com/search-console
2. **Submit sitemap** — Create `sitemap.xml`:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
     <url>
       <loc>https://amitgaikwad2837.github.io/InnerSpace/</loc>
       <priority>1.0</priority>
     </url>
     <url>
       <loc>https://amitgaikwad2837.github.io/InnerSpace/privacy.html</loc>
       <priority>0.5</priority>
     </url>
     <url>
       <loc>https://amitgaikwad2837.github.io/InnerSpace/terms.html</loc>
       <priority>0.5</priority>
     </url>
   </urlset>
   ```

3. **Add robots.txt** — Create `robots.txt` in the marketing folder:
   ```
   User-agent: *
   Allow: /
   Sitemap: https://amitgaikwad2837.github.io/InnerSpace/sitemap.xml
   ```

4. **Add Google Analytics** — Add to `<head>` in all HTML files:
   ```html
   <!-- Google Analytics -->
   <script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
   <script>
     window.dataLayer = window.dataLayer || [];
     function gtag(){dataLayer.push(arguments);}
     gtag('js', new Date());
     gtag('config', 'GA_MEASUREMENT_ID');
   </script>
   ```

## Troubleshooting

### Site not showing up?
- Wait 5-10 minutes after enabling GitHub Pages
- Check the **Actions** tab to see if the deployment succeeded
- Verify the branch and folder are correctly set

### 404 errors on pages?
- Make sure file names match links exactly (case-sensitive on Linux)
- Verify HTML files are in the `/marketing` folder
- Check that links use `.html` extension

### Links not working?
- Use relative paths: `href="privacy.html"` (not `href="/privacy.html"`)
- For links from root: `href="index.html"` or just `href=""`

### Custom domain?
1. Add a `CNAME` file in `/marketing`:
   ```
   yourdomain.com
   ```
2. Configure DNS records to point to GitHub Pages
3. Enable HTTPS in Settings → Pages

## Deployment Checklist

Before launching:

- [ ] All links point to correct pages
- [ ] Social media links are updated
- [ ] Contact emails are correct
- [ ] App Store/Play Store links are set (or placeholder text updated)
- [ ] Privacy Policy and Terms are reviewed
- [ ] GitHub Pages is enabled
- [ ] Site is accessible at `https://yourusername.github.io/InnerSpace/`
- [ ] Site looks good on mobile
- [ ] Links to external sites work correctly
- [ ] Contact forms or email links work

## Next Steps

1. ✅ Push changes to GitHub
2. ✅ Enable GitHub Pages (Settings → Pages)
3. ✅ Wait for deployment (2-5 minutes)
4. ✅ Test the site at `https://amitgaikwad2837.github.io/InnerSpace/`
5. ✅ Share your marketing site!

## Support

If you run into issues:
- Check [GitHub Pages documentation](https://docs.github.com/en/pages)
- Review [GitHub Pages troubleshooting](https://docs.github.com/en/pages/getting-started-with-github-pages/troubleshooting-custom-domains-and-github-pages)
- Open an issue in your repository

---

**Last Updated:** June 2026  
**Maintained by:** InnerSpace Team
