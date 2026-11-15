# storefront-spa fixtures

Sanitized, trimmed copies of the **rendered** DOM of a client-rendered (Vite/React) toy store,
modeled on a real Arabic storefront that used to break the product scanner:

- `home.html` – home page with "featured" product cards (each card carries a `مميز` badge) plus a
  category strip. The old heuristic turned the badge into a product and pooled every card image onto it.
- `category.html` – a category landing page (banner + product grid). Must be classified as a
  collection, never as a product.
- `product-detail.html` – a product page: category hero banner, focal image, the product's own
  thumbnails, specs list, and a "you may also like" related grid that must not leak media.
- `igroup-content.json` – trimmed response of the storefront's public content API.

All names, ids, hosts and image URLs are fictional (`shop.example`, `cdn.example`).
