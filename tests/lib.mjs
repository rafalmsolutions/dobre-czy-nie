// Dane testowe i podmieniona baza Open Food Facts dla testów w przeglądarce (wersja 1.0).
import { chromium } from 'playwright';
const ean = p => { const d = p.split('').map(Number); const s = d.reverse().reduce((a, n, i) => a + n * (i % 2 === 0 ? 3 : 1), 0); return p + ((10 - s % 10) % 10); };
export const C = {
  nutella: '3017620422003', ham: ean('590123412345'), oil: ean('590000000001'), msg: ean('590000000002'), empty: ean('590000000003'),
  xss: ean('590000000004'), weird: ean('590000000005'), err500: ean('590000000006'), err429: ean('590000000007'), badjson: ean('590000000008'),
  half: ean('590000000009'), slow: ean('590000000010'), missing: ean('590000000011'), missing2: ean('590000000014'), cosm: ean('400590000000'), milk: ean('590000000012'), vegan: ean('590000000013')
};
const P = {
  [C.nutella]: { image_front_small_url: 'https://images.openfoodfacts.org/images/products/301/762/042/2003/front_pl.small.jpg', image_front_url: 'https://images.openfoodfacts.org/images/products/301/762/042/2003/front_pl.400.jpg', product_name_pl: 'Krem orzechowy z kakao', brands: 'Ferrero', quantity: '400 g', nutriscore_grade: 'e', nova_group: 4, additives_tags: ['en:e322', 'en:e322i'], allergens_tags: ['en:milk', 'en:nuts', 'en:soybeans'], ingredients_text_pl: 'cukier, olej palmowy, orzechy laskowe 13%, mleko w proszku odtłuszczone 8,7%, kakao 7,4%, emulgator: lecytyny (z soi), wanilina', nutriments: { 'energy-kcal_100g': 539, fat_100g: 30.9, 'saturated-fat_100g': 10.6, sugars_100g: 56.3, salt_100g: 0.107, proteins_100g: 6.3 }, categories_hierarchy: ['en:spreads', 'en:sweet-spreads', 'en:hazelnut-spreads'], categories: 'Kremy do smarowania, Słodkie kremy, Kremy orzechowe', ingredients_analysis_tags: ['en:palm-oil', 'en:non-vegan', 'en:vegetarian'] },
  [C.ham]: { product_name_pl: 'Szynka konserwowa', brands: 'Testowa', quantity: '120 g', nutriscore_grade: 'd', nova_group: 4, additives_tags: ['en:e250', 'en:e451', 'en:e301', 'en:e407'], allergens_tags: [], ingredients_text_pl: 'mięso wieprzowe 80%, woda, sól, stabilizatory: E451, karagen, przeciwutleniacz: askorbinian sodu, substancja konserwująca: azotyn sodu', nutriments: { 'energy-kcal_100g': 110, fat_100g: 3, sugars_100g: 1, salt_100g: 2.4, proteins_100g: 18 }, categories_hierarchy: ['en:meats', 'en:hams'], ingredients_analysis_tags: ['en:palm-oil-free', 'en:non-vegan', 'en:non-vegetarian'] },
  [C.oil]: { product_name_pl: 'Oliwa z oliwek extra virgin', brands: 'Testowa', quantity: '500 ml', nutriscore_grade: 'e', nova_group: 2, nutriments: { 'energy-kcal_100g': 824, fat_100g: 91.6, 'saturated-fat_100g': 14 }, categories_hierarchy: ['en:fats', 'en:olive-oils'] },
  [C.msg]: { product_name_pl: 'Bulion warzywny', brands: 'Testowa', nutriscore_grade: 'd', nova_group: 4, additives_tags: ['en:e621', 'en:e627', 'en:e631'], ingredients_text_pl: 'sól, wzmacniacze smaku: glutaminian monosodowy, guanylan disodowy, inozynian disodowy, warzywa suszone 10%', categories_hierarchy: ['en:broths'] },
  [C.empty]: {},
  [C.xss]: { product_name_pl: '<img src=x onerror="window.__xss=1">Zły produkt', brands: '<script>window.__xss=2</script>', ingredients_text_pl: '<b onmouseover="window.__xss=3">cukier</b>, woda', nutriscore_grade: 'c', nova_group: 3, image_front_small_url: 'javascript:window.__xss=4' },
  [C.weird]: { product_name: 'Dziwne dane', nutriscore_grade: 'not-applicable', nova_group: 'unknown', additives_tags: 'en:e330', allergens_tags: null, nutriments: { sugars_100g: 'abc', salt_100g: -5 }, categories_hierarchy: null },
  [C.half]: null, [C.slow]: { product_name_pl: 'Wolny produkt', nutriscore_grade: 'b', nova_group: 3, additives_tags: [], ingredients_text_pl: 'woda, cukier' },
  [C.milk]: { product_name_pl: 'Jogurt naturalny', brands: 'Testowa', nutriscore_grade: 'a', nova_group: 1, additives_tags: [], allergens_tags: ['en:milk'], ingredients_text_pl: 'mleko, żywe kultury bakterii', nutriments: { sugars_100g: 4.5, salt_100g: 0.1 }, categories_hierarchy: ['en:dairies', 'en:yogurts', 'en:plain-yogurts'], categories: 'Nabiał, Jogurty, Jogurty naturalne', ingredients_analysis_tags: ['en:palm-oil-free', 'en:non-vegan', 'en:vegetarian'] },
  [C.vegan]: { product_name_pl: 'Napój owsiany', brands: 'Testowa', nutriscore_grade: 'b', nova_group: 4, additives_tags: ['en:e340'], allergens_tags: ['en:gluten'], traces_tags: ['en:nuts'], ingredients_text_pl: 'woda, owies 10%, olej rzepakowy, regulator kwasowości: fosforany potasu, sól', categories_hierarchy: ['en:beverages', 'en:plant-based-milks'], ingredients_analysis_tags: ['en:palm-oil-free', 'en:vegan', 'en:vegetarian'], labels_tags: ['en:vegan'] }
};
const COSM = { [C.cosm]: { product_name: 'Krem nawilżający', brands: 'Testowa Kosmetyka', ingredients_text: 'Aqua, Glycerin, Paraffinum Liquidum, Parfum, Limonene, Linalool, Phenoxyethanol, Propylparaben' } };
export const SEARCH = {
  'en:hazelnut-spreads': [
    { code: ean('590000000101'), product_name_pl: 'Pasta z orzechów laskowych 100%', brands: 'Bakalland', nutriscore_grade: 'c', nova_group: 1, additives_tags: [], ingredients_text_pl: 'orzechy laskowe 100%', allergens_tags: ['en:nuts'], categories_hierarchy: ['en:spreads', 'en:sweet-spreads', 'en:hazelnut-spreads'], ingredients_analysis_tags: ['en:palm-oil-free', 'en:vegan'] },
    { code: ean('590000000102'), product_name_pl: 'Krem kakaowy light', brands: 'X', nutriscore_grade: 'd', nova_group: 4, additives_tags: ['en:e322'], ingredients_text_pl: 'cukier, olej palmowy, mleko', allergens_tags: ['en:milk'], categories_hierarchy: ['en:spreads', 'en:sweet-spreads', 'en:hazelnut-spreads'], ingredients_analysis_tags: ['en:palm-oil'] },
    { code: ean('590000000103'), product_name_pl: 'Krem orzechowy bez oleju palmowego', brands: 'Y', nutriscore_grade: 'd', nova_group: 4, additives_tags: [], ingredients_text_pl: 'cukier, olej słonecznikowy, orzechy 20%, mleko', allergens_tags: ['en:milk', 'en:nuts'], categories_hierarchy: ['en:spreads', 'en:sweet-spreads', 'en:hazelnut-spreads'], ingredients_analysis_tags: ['en:palm-oil-free'] },
    { code: ean('590000000104'), product_name_pl: 'Krem czekoladowy', brands: 'Z', nutriscore_grade: 'e', nova_group: 4, additives_tags: ['en:e471'], ingredients_text_pl: 'cukier, olej palmowy', categories_hierarchy: ['en:spreads', 'en:sweet-spreads', 'en:hazelnut-spreads'], ingredients_analysis_tags: ['en:palm-oil'] },
    { code: ean('590000000105'), product_name_pl: 'Krem orzechowy klasyczny', brands: 'W', nutriscore_grade: 'e', nova_group: 4, additives_tags: [], ingredients_text_pl: 'cukier, olej palmowy, orzechy 10%', categories_hierarchy: ['en:spreads', 'en:sweet-spreads', 'en:hazelnut-spreads'], ingredients_analysis_tags: ['en:palm-oil'] },
    { code: ean('590000000106'), product_name_pl: 'Masło orzechowe', brands: 'V', nutriscore_grade: 'c', nova_group: 3, additives_tags: [], ingredients_text_pl: 'orzeszki ziemne 98%, sól', allergens_tags: ['en:peanuts'], categories_hierarchy: ['en:spreads', 'en:sweet-spreads', 'en:hazelnut-spreads'], ingredients_analysis_tags: ['en:palm-oil-free', 'en:vegan'] }
  ]
};
export const YOG = [
    { code: ean('590000000201'), product_name_pl: 'Skyr naturalny', brands: 'Pilos', nutriscore_grade: 'a', nova_group: 1, additives_tags: [], allergens_tags: ['en:milk'], nutriments: { proteins_100g: 11, 'energy-kcal_100g': 63, sugars_100g: 4, salt_100g: 0.1, 'saturated-fat_100g': 0.1 }, categories_hierarchy: ['en:dairies', 'en:yogurts'], stores_tags: ['lidl'] },
    { code: ean('590000000202'), product_name_pl: 'Jogurt truskawkowy', brands: 'Pilos', nutriscore_grade: 'c', nova_group: 4, additives_tags: ['en:e1442'], allergens_tags: ['en:milk'], nutriments: { proteins_100g: 3, sugars_100g: 13 }, categories_hierarchy: ['en:dairies', 'en:yogurts'], stores_tags: ['lidl'] },
    { code: ean('590000000203'), product_name_pl: 'Jogurt kokosowy', brands: 'Vemondo', nutriscore_grade: 'b', nova_group: 3, additives_tags: [], allergens_tags: [], ingredients_analysis_tags: ['en:vegan'], nutriments: { proteins_100g: 1, sugars_100g: 2 }, categories_hierarchy: ['en:yogurts'], stores_tags: ['biedronka'] },
    { code: ean('590000000204'), product_name_pl: 'Deser czekoladowy', brands: 'Pilos', nutriscore_grade: 'e', nova_group: 4, additives_tags: ['en:e407'], categories_hierarchy: ['en:yogurts'] },
    { code: ean('590000000205'), product_name_pl: '<img src=x onerror="window.__xss=11">Jogurt grecki', brands: 'Pilos', nutriscore_grade: 'b', nova_group: 1, additives_tags: [], allergens_tags: ['en:milk'], nutriments: { proteins_100g: 4, sugars_100g: 3.5 }, categories_hierarchy: ['en:yogurts'] },
    { code: ean('590000000206'), product_name_pl: 'Jogurt naturalny', brands: 'Bakoma', nutriscore_grade: 'a', nova_group: 1, additives_tags: [], allergens_tags: ['en:milk'], nutriments: { proteins_100g: 4, sugars_100g: 4, salt_100g: 0.1 }, categories_hierarchy: ['en:yogurts'] }
  ];
export const SHOPS = {
  'lidl|en:yogurts': [
    { code: ean('590000000201'), product_name_pl: 'Skyr naturalny', brands: 'Pilos', nutriscore_grade: 'a', nova_group: 1, additives_tags: [], allergens_tags: ['en:milk'], ingredients_text_pl: 'mleko odtłuszczone, kultury bakterii', nutriments: { proteins_100g: 11, 'energy-kcal_100g': 63, sugars_100g: 4, salt_100g: 0.1, 'saturated-fat_100g': 0.1 } },
    { code: ean('590000000202'), product_name_pl: 'Jogurt truskawkowy', brands: 'Pilos', nutriscore_grade: 'c', nova_group: 4, additives_tags: ['en:e1442'], allergens_tags: ['en:milk'], ingredients_text_pl: 'mleko, cukier, truskawki 8%, skrobia modyfikowana', nutriments: { proteins_100g: 3, sugars_100g: 13 } },
    { code: ean('590000000203'), product_name_pl: 'Jogurt kokosowy', brands: 'Vemondo', nutriscore_grade: 'b', nova_group: 3, additives_tags: [], allergens_tags: [], ingredients_analysis_tags: ['en:vegan'], ingredients_text_pl: 'mleczko kokosowe, skrobia, kultury bakterii', nutriments: { proteins_100g: 1, sugars_100g: 2 } },
    { code: ean('590000000204'), product_name_pl: 'Deser czekoladowy', brands: 'Pilos', nutriscore_grade: 'e', nova_group: 4, additives_tags: ['en:e407'], ingredients_text_pl: 'mleko, cukier, kakao, karagen' },
    { code: ean('590000000205'), product_name_pl: '<img src=x onerror="window.__xss=11">Jogurt grecki', brands: 'Pilos', nutriscore_grade: 'b', nova_group: 1, additives_tags: [], allergens_tags: ['en:milk'], ingredients_text_pl: 'mleko, śmietanka, kultury bakterii', nutriments: { proteins_100g: 4, sugars_100g: 3.5 } }
  ],
  'biedronka|en:yogurts': [
    { code: ean('590000000211'), product_name_pl: 'Deser waniliowy', nutriscore_grade: 'e', nova_group: 4, additives_tags: ['en:e407'], ingredients_text_pl: 'mleko, cukier, karagen' }
  ]
};
export async function setup(ctx, opts = {}) {
  await ctx.route(/fonts\.(googleapis|gstatic)|jsdelivr|unpkg|play\.google/, r => r.abort());
  const IMG = (await import('fs')).readFileSync(new URL('../icons/icon-192.png', import.meta.url));
  await ctx.route(/images\.openfoodfacts/, r => r.fulfill({ body: IMG, contentType: 'image/png' }));
  opts.searchCalls = 0;
  await ctx.route(/openfoodfacts\.org\/api\/v2\/search/, async r => {
    opts.searchCalls++;
    if (opts.searchFail) return r.fulfill({ status: 503, body: '<html>Page temporarily unavailable</html>' });
    await new Promise(res => setTimeout(res, opts.searchDelay || 150));
    const u = new URL(r.request().url()); const cat = u.searchParams.get('categories_tags');
    const list = cat === 'en:yogurts' ? YOG : (SEARCH[cat] || []);
    return r.fulfill({ json: { count: list.length, products: list } });
  });
  if (opts.snapshot) {
    opts.dataCalls = 0;
    const strip = p => { const o = Object.assign({}, p); delete o.ingredients_text_pl; delete o.ingredients_text; return o; };
    const all = Object.assign({}, ...Object.entries(P).filter(([, v]) => v && v.product_name_pl).map(([c, v]) => ({ [c]: strip(Object.assign({ code: c }, v)) })), ...YOG.map(y => ({ [y.code]: strip(y) })));
    await ctx.route(/\/data\/meta\.json/, r => r.fulfill({ json: { built: '2026-10-19T03:17:00Z', products: Object.keys(all).length, categories: 2 } }));
    await ctx.route(/\/data\/c\/([a-z0-9_-]+)\.json/, r => {
      opts.dataCalls++;
      const t = r.request().url().match(/data\/c\/([a-z0-9_-]+)\.json/)[1].replace('_', ':');
      const list = t === 'en:yogurts' ? YOG : SEARCH[t];
      return list ? r.fulfill({ json: { tag: t, count: list.length, products: list.map(strip) } }) : r.fulfill({ status: 404, body: 'nie ma' });
    });
    await ctx.route(/\/data\/p\/(\d{3})\.json/, r => {
      opts.dataCalls++;
      const k = r.request().url().match(/data\/p\/(\d{3})\.json/)[1];
      return r.fulfill({ json: Object.fromEntries(Object.entries(all).filter(([c]) => c.slice(-3) === k)) });
    });
  }
  await ctx.route(/openfoodfacts\.org\/api\/v2\/product\/(\d+)/, async r => {
    const c = r.request().url().match(/product\/(\d+)/)[1];
    if (opts.offDown) return r.fulfill({ status: 503, body: '<html>Page temporarily unavailable</html>' });
    if (opts.offSlow) await new Promise(res => setTimeout(res, opts.offSlow));
    if (c === C.err500) return r.fulfill({ status: 500, body: 'Internal error' });
    if (c === C.err429) return r.fulfill({ status: 429, body: 'Too many' });
    if (c === C.badjson) return r.fulfill({ status: 200, body: '<html>not json' });
    if (c === C.half) return r.fulfill({ status: 503, body: 'down' });
    if (c === C.slow) { await new Promise(res => setTimeout(res, 1500)); }
    if (c in P) return r.fulfill({ json: { status: 1, product: Object.assign({ code: c }, P[c]) } });
    return r.fulfill({ status: 404, json: { status: 0 } });
  });
  await ctx.route(/openbeautyfacts\.org\/api\/v2\/product\/(\d+)/, r => {
    const c = r.request().url().match(/product\/(\d+)/)[1];
    if (c === C.err500) return r.fulfill({ status: 500, body: 'x' });
    if (c === C.err429) return r.fulfill({ status: 429, body: 'x' });
    if (c in COSM) return r.fulfill({ json: { status: 1, product: Object.assign({ code: c }, COSM[c]) } });
    return r.fulfill({ status: 404, json: { status: 0 } });
  });
}
