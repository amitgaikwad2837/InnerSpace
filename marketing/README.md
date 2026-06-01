# InnerSpace Marketing Website

A modern, responsive marketing website for the InnerSpace AI personal growth companion app.

## Features

- 🎨 Modern, dark-themed design
- 📱 Fully responsive (mobile, tablet, desktop)
- ⚡ No dependencies — pure HTML/CSS
- 🚀 Ready for GitHub Pages deployment
- ♿ Semantic HTML and accessible structure

## Sections

- **Hero** — Compelling headline and CTA
- **Features** — Core differentiators (6 key features)
- **Highlights** — Quick value propositions
- **Modes** — Explanation of the 4 interaction modes
- **Safety** — Privacy and safety guarantees
- **Stats** — Key numbers
- **Testimonials** — User feedback
- **Download CTA** — Call-to-action with app store links
- **Footer** — Navigation and legal links

## Deployment to GitHub Pages

### Option 1: Deploy from `marketing/` folder (Recommended)

1. Go to your GitHub repository settings
2. Navigate to **Pages** (Settings → Pages)
3. Under "Build and deployment":
   - Set **Source** to "Deploy from a branch"
   - Set **Branch** to `main` (or your default branch)
   - Set **Folder** to `/marketing`
4. Click **Save**
5. GitHub will deploy your site to `https://yourusername.github.io/InnerSpace/`

### Option 2: Deploy from `docs/` folder

1. Move the marketing website files to a `docs/` folder instead
2. In GitHub Pages settings, select `/docs` as the source folder
3. Your site will be available at the same URL

### Option 3: Deploy to a separate `gh-pages` branch

1. Create a new branch called `gh-pages`:
   ```bash
   git checkout --orphan gh-pages
   git rm -rf .
   ```

2. Copy only the marketing files to the root
3. Push the branch:
   ```bash
   git push origin gh-pages
   ```

4. In GitHub Pages settings, select the `gh-pages` branch
5. Your site will be available at `https://yourusername.github.io/InnerSpace/`

## Local Development

Simply open `index.html` in your browser. No build step or server required!

```bash
# On macOS/Linux
open marketing/index.html

# On Windows
start marketing\index.html
```

Or use a simple local server:

```bash
# Python 3
python -m http.server 8000

# Then visit http://localhost:8000/marketing/
```

## File Structure

```
marketing/
├── index.html          # Main landing page
├── privacy.html        # Privacy policy
├── terms.html          # Terms of service
└── README.md           # This file
```

## Customization

### Colors

Edit the CSS custom properties at the top of `index.html`:

```css
:root {
    --primary: #6366f1;
    --accent: #ec4899;
    --dark-bg: #0f172a;
    /* ... etc */
}
```

### Content

All content is directly in the HTML. Simply edit the text sections in `index.html`.

### Social Links

Update the footer social links to point to your actual social media profiles:

```html
<div class="social-links">
    <a href="https://github.com/yourusername" title="GitHub">🐙</a>
    <!-- ... etc -->
</div>
```

### App Store Links

Update the download buttons with real App Store and Google Play links when your app is published:

```html
<a href="https://apps.apple.com/app/innerspace/..." class="store-button">
    <!-- App Store button -->
</a>
```

## Performance

- **No external dependencies** — Everything is self-contained
- **No JavaScript frameworks** — Lightweight and fast
- **Single CSS file** — Embedded for instant rendering
- **No image assets** — Uses emoji and gradients only
- **Zero build step** — Deploy instantly

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Android)

## Adding More Pages

To add a new page (e.g., `about.html`):

1. Create the file in the `marketing/` folder
2. Use the same HTML structure and CSS
3. Update footer links to point to the new page

Example structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>About InnerSpace</title>
    <style>
        /* Copy the same CSS from index.html -->
    </style>
</head>
<body>
    <!-- Navigation (same as index.html) -->
    <nav><!-- ... --></nav>
    
    <!-- Your content -->
    <section class="hero"><!-- ... --></section>
    
    <!-- Footer (same as index.html) -->
    <footer><!-- ... --></footer>
</body>
</html>
```

## SEO

The site includes:
- Meta descriptions
- Open Graph tags
- Semantic HTML structure
- Descriptive headings
- Alt text patterns (ready for images when needed)

Consider adding:
- Structured data (schema.org JSON-LD)
- Sitemap.xml
- robots.txt
- Google Analytics

## License

Same license as the InnerSpace app repository.

---

**Last Updated:** June 2026  
**Maintained by:** InnerSpace Team
