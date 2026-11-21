import { describe, expect, it } from 'vitest';
import { extractHydrationProducts } from './hydration-json-extract';

describe('hydration-json-extract', () => {
  it('reads products from __NEXT_DATA__ without a browser', () => {
    const html = `<!DOCTYPE html><html><head></head><body>
      <script id="__NEXT_DATA__" type="application/json">{
        "props": {
          "pageProps": {
            "product": {
              "@type": "Product",
              "name": "Wireless Headset",
              "price": "99.00",
              "sku": "WH-1",
              "image": "https://cdn.example/wh.jpg"
            }
          }
        }
      }</script></body></html>`;
    const products = extractHydrationProducts('https://shop.example/p/wh-1', html);
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      name: 'Wireless Headset',
      skuPublic: 'WH-1',
      extractionSource: 'HYDRATION_JSON',
    });
  });
});