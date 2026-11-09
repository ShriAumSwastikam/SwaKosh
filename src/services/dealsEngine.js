// Modular Smart Online Offers & Deal Finder Engine
// Supports Amazon India, Flipkart Grocery, BigBasket, JioMart, Blinkit, Zepto, and Swiggy Instamart

export const PLATFORMS = [
  {
    id: 'dmart_jiomart',
    name: 'JioMart',
    badge: 'Wholesale Value',
    eta: 'Next-Day Slot',
    color: '#0284c7',
    deliveryFee: 0,
    minOrder: 250,
    buildUrl: (query) => `https://www.jiomart.com/search/${encodeURIComponent(query)}`
  },
  {
    id: 'bigbasket',
    name: 'BigBasket',
    badge: 'Monthly Staples',
    eta: '2–4 hrs / BBNow',
    color: '#65a30d',
    deliveryFee: 0,
    minOrder: 400,
    buildUrl: (query) => `https://www.bigbasket.com/ps/?q=${encodeURIComponent(query)}`
  },
  {
    id: 'amazon',
    name: 'Amazon Fresh',
    badge: 'Cashback & Prime',
    eta: 'Same-Day 2hr Slot',
    color: '#d97706',
    deliveryFee: 0,
    minOrder: 300,
    buildUrl: (query) => `https://www.amazon.in/s?k=${encodeURIComponent(query)}`
  },
  {
    id: 'flipkart',
    name: 'Flipkart Grocery',
    badge: 'SuperCoin Deals',
    eta: 'Next-Day Delivery',
    color: '#2563eb',
    deliveryFee: 0,
    minOrder: 500,
    buildUrl: (query) => `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`
  },
  {
    id: 'blinkit',
    name: 'Blinkit',
    badge: '10-Min Instant',
    eta: '10–12 mins',
    color: '#eab308',
    deliveryFee: 15,
    minOrder: 199,
    buildUrl: (query) => `https://blinkit.com/s/?q=${encodeURIComponent(query)}`
  },
  {
    id: 'zepto',
    name: 'Zepto',
    badge: 'SuperSaver Pass',
    eta: '10 mins',
    color: '#0d9488',
    deliveryFee: 10,
    minOrder: 149,
    buildUrl: (query) => `https://www.zeptonow.com/search?query=${encodeURIComponent(query)}`
  },
  {
    id: 'instamart',
    name: 'Swiggy Instamart',
    badge: 'Swiggy One Free',
    eta: '12–15 mins',
    color: '#ea580c',
    deliveryFee: 12,
    minOrder: 199,
    buildUrl: (query) => `https://www.swiggy.com/instamart/search?custom_back=true&query=${encodeURIComponent(query)}`
  }
];

// Deterministic hash so prices for any custom item remain stable and realistic
function hashText(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function cleanSearchQuery(name, brand, qty, unit) {
  // Strip Hindi brackets for cleaner e-commerce URL query while keeping primary product keywords
  const baseName = name.replace(/\([^)]*\)/g, '').trim();
  const brandPrefix = brand ? brand.split('/')[0].trim() : '';
  return `${brandPrefix} ${baseName} ${qty}${unit}`.replace(/\s+/g, ' ').trim();
}

export function compareActiveListDeals(activeList) {
  if (!activeList || !Array.isArray(activeList.items) || activeList.items.length === 0) {
    return { itemComparisons: [], platformTotals: [], bestPlatform: null, bestSplitTotal: 0, totalMrp: 0 };
  }

  let totalMrp = 0;
  const platformSums = {};
  for (const p of PLATFORMS) {
    platformSums[p.id] = 0;
  }

  let bestSplitTotal = 0;

  const itemComparisons = activeList.items.map((item) => {
    const baseEst = item.estimatedPrice && item.estimatedPrice > 0 ? Number(item.estimatedPrice) : 180;
    const mrp = Math.round(baseEst * 1.14);
    totalMrp += mrp;

    const searchQuery = cleanSearchQuery(item.name, item.brand, item.qty, item.unit);
    const seed = hashText(item.name + (item.brand || ''));

    // Generate realistic platform-specific pricing & promo tags
    const quotes = PLATFORMS.map((platform, idx) => {
      const varianceSeed = (seed + idx * 37) % 100;
      let multiplier = 0.94;

      if (platform.id === 'dmart_jiomart') {
        multiplier = 0.84 + (varianceSeed % 9) * 0.01; // Deepest discount on bulk staples
      } else if (platform.id === 'bigbasket') {
        multiplier = 0.86 + (varianceSeed % 8) * 0.01;
      } else if (platform.id === 'amazon' || platform.id === 'flipkart') {
        multiplier = 0.87 + (varianceSeed % 9) * 0.01;
      } else {
        // Quick commerce (Blinkit, Zepto, Instamart)
        multiplier = 0.89 + (varianceSeed % 10) * 0.01;
      }

      const offerPrice = Math.max(10, Math.round(mrp * multiplier));
      const discountPct = Math.max(3, Math.round(((mrp - offerPrice) / mrp) * 100));

      const promoTags = [
        `${discountPct}% OFF`,
        'Bank 5% Cashback',
        'Combo Pack Saver',
        'SuperSaver Deal',
        'Member Price'
      ];
      const promoLabel = discountPct >= 14 ? `${discountPct}% OFF · Best Saver` : promoTags[(seed + idx) % promoTags.length];

      platformSums[platform.id] += offerPrice;

      return {
        platformId: platform.id,
        platformName: platform.name,
        eta: platform.eta,
        price: offerPrice,
        mrp,
        discountPct,
        promoLabel,
        url: platform.buildUrl(searchQuery)
      };
    });

    // Find lowest price for this item
    const sortedQuotes = [...quotes].sort((a, b) => a.price - b.price);
    const bestQuote = sortedQuotes[0];
    bestSplitTotal += bestQuote.price;

    return {
      itemId: item.id,
      name: item.name,
      qty: item.qty,
      unit: item.unit,
      brand: item.brand,
      mrp,
      searchQuery,
      bestQuote,
      quotes
    };
  });

  const platformTotals = PLATFORMS.map((p) => {
    const subtotal = platformSums[p.id];
    const delivery = subtotal >= p.minOrder ? 0 : p.deliveryFee;
    const finalTotal = subtotal + delivery;
    const savings = Math.max(0, totalMrp - finalTotal);
    const savingsPct = totalMrp > 0 ? Math.round((savings / totalMrp) * 100) : 0;

    return {
      ...p,
      subtotal,
      delivery,
      finalTotal,
      savings,
      savingsPct
    };
  }).sort((a, b) => a.finalTotal - b.finalTotal);

  return {
    itemComparisons,
    platformTotals,
    bestPlatform: platformTotals[0] || null,
    bestSplitTotal,
    totalMrp,
    maxSavings: Math.max(0, totalMrp - bestSplitTotal)
  };
}
