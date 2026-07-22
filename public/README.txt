Put your image files in these folders, then reference them in src/App.jsx.

public/gallery/   -> home photo gallery    -> img: "/gallery/filename.jpg"
public/sponsors/  -> sponsor logos         -> logo: "/sponsors/filename.png"
public/events/    -> event banner photos   -> img: "/events/filename.jpg"
public/logo.png   -> site logo (optional)  -> <img src="/logo.png" ...>

Notes:
- The leading slash matters. "/gallery/eid.jpg" is correct, "gallery/eid.jpg" is not.
- File names are case-sensitive on GitHub Pages. "Eid.JPG" and "eid.jpg" are different.
- Logos: PNG with transparent background looks best.
- Photos: JPG, roughly 1200px wide is plenty. Keep them under ~500KB each so the site stays fast.
