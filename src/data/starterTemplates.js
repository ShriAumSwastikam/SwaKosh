// Pre-populated Starter Master Lists, Active Sub-Lists, Rich Notes, and Visiting Cards

function createCardPreviewDataUrl({ bg, accent, name, role, company, phone, email, address }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="300" viewBox="0 0 520 300">
    <rect width="520" height="300" rx="18" fill="${bg}" />
    <rect x="0" y="0" width="14" height="300" fill="${accent}" />
    <circle cx="465" cy="55" r="95" fill="${accent}" fill-opacity="0.12" />
    <text x="38" y="54" font-family="Inter, sans-serif" font-size="13" font-weight="700" fill="${accent}" letter-spacing="1.5">${company.toUpperCase()}</text>
    <text x="38" y="102" font-family="Inter, sans-serif" font-size="24" font-weight="800" fill="#f8fafc">${name}</text>
    <text x="38" y="128" font-family="Inter, sans-serif" font-size="14" font-weight="500" fill="#94a3b8">${role}</text>
    <line x1="38" y1="150" x2="280" y2="150" stroke="${accent}" stroke-opacity="0.4" stroke-width="1.5" />
    <text x="38" y="185" font-family="monospace" font-size="14" fill="#e2e8f0">📞 ${phone}</text>
    <text x="38" y="214" font-family="Inter, sans-serif" font-size="13" fill="#cbd5e1">✉️ ${email}</text>
    <text x="38" y="244" font-family="Inter, sans-serif" font-size="12" fill="#94a3b8">📍 ${address}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const STARTER_MASTER_LISTS = [
  {
    id: 'ml-indian-grocery',
    title: 'Monthly Indian Grocery Master List (मासिक राशन मास्टर लिस्ट)',
    category: 'Grocery & Kitchen',
    icon: '🛒',
    description: 'Complete Indian kitchen blueprint with staples, dals, spices, dairy, toiletries, and cleaning supplies.',
    updatedAt: '2026-11-08T10:00:00.000Z',
    items: [
      { id: 'm-1', name: 'Chakki Fresh Whole Wheat Atta (आटा)', category: 'Grains & Flours', defaultQty: 10, defaultUnit: 'kg', brand: 'Aashirvaad / Pillsbury', estimatedPrice: 460 },
      { id: 'm-2', name: 'Aged Basmati Rice (बासमती चावल)', category: 'Grains & Flours', defaultQty: 5, defaultUnit: 'kg', brand: 'India Gate / Daawat Rozana', estimatedPrice: 540 },
      { id: 'm-3', name: 'Unpolished Toor / Arhar Dal (तूर दाल)', category: 'Grains & Flours', defaultQty: 2, defaultUnit: 'kg', brand: 'Tata Sampann', estimatedPrice: 340 },
      { id: 'm-4', name: 'Yellow Moong Dal (मूंग दाल)', category: 'Grains & Flours', defaultQty: 1, defaultUnit: 'kg', brand: 'Tata Sampann', estimatedPrice: 155 },
      { id: 'm-5', name: 'Chana Dal & Besan (चना दाल व बेसन)', category: 'Grains & Flours', defaultQty: 1, defaultUnit: 'kg', brand: 'Rajdhani / Fortune', estimatedPrice: 120 },
      { id: 'm-6', name: 'Thick Poha & Sooji Rava (पोहा व सूजी)', category: 'Grains & Flours', defaultQty: 1, defaultUnit: 'kg', brand: '24 Mantra / Fortune', estimatedPrice: 85 },
      { id: 'm-7', name: 'Cold Pressed Mustard Oil (कच्ची घानी सरसों तेल)', category: 'Oils & Spices', defaultQty: 2, defaultUnit: 'L', brand: 'Fortune / Dhara Kachi Ghani', estimatedPrice: 360 },
      { id: 'm-8', name: 'Pure Cow Ghee (देसी घी)', category: 'Oils & Spices', defaultQty: 1, defaultUnit: 'L', brand: 'Amul / Mother Dairy', estimatedPrice: 630 },
      { id: 'm-9', name: 'Turmeric, Red Chilli & Coriander Powder (हल्दी, मिर्च, धनिया)', category: 'Oils & Spices', defaultQty: 3, defaultUnit: 'packet', brand: 'Everest / MDH (200g each)', estimatedPrice: 240 },
      { id: 'm-10', name: 'Whole Jeera & Rai (जीरा व राई)', category: 'Oils & Spices', defaultQty: 250, defaultUnit: 'gm', brand: 'Vedaka / Local Organic', estimatedPrice: 145 },
      { id: 'm-11', name: 'Iodized Vacuum Salt (नमक)', category: 'Oils & Spices', defaultQty: 1, defaultUnit: 'kg', brand: 'Tata Salt', estimatedPrice: 28 },
      { id: 'm-12', name: 'AssamCTC Tea Leaves (चाय पत्ती)', category: 'Dairy & Breakfast', defaultQty: 500, defaultUnit: 'gm', brand: 'Tata Tea Gold / Wagh Bakri', estimatedPrice: 270 },
      { id: 'm-13', name: 'Salted Pasteurized Butter (अमूल मक्खन)', category: 'Dairy & Breakfast', defaultQty: 500, defaultUnit: 'gm', brand: 'Amul', estimatedPrice: 275 },
      { id: 'm-14', name: 'Fresh Malai Paneer (मलाई पनीर)', category: 'Dairy & Breakfast', defaultQty: 400, defaultUnit: 'gm', brand: 'Amul / Milky Mist', estimatedPrice: 180 },
      { id: 'm-15', name: 'Sulphurless Sugar / Organic Jaggery (चीनी / गुड़)', category: 'Dairy & Breakfast', defaultQty: 2, defaultUnit: 'kg', brand: 'Madhur / 24 Mantra', estimatedPrice: 120 },
      { id: 'm-16', name: 'Herbal Toothpaste Family Pack (टूथपेस्ट)', category: 'Toiletries', defaultQty: 2, defaultUnit: 'pcs', brand: 'Colgate Visible White / Sensodyne', estimatedPrice: 230 },
      { id: 'm-17', name: 'Moisturizing Bath Soap Pack (नहाने का साबुन)', category: 'Toiletries', defaultQty: 4, defaultUnit: 'pcs', brand: 'Dove / Mysore Sandal', estimatedPrice: 220 },
      { id: 'm-18', name: 'Front-Load Liquid Detergent (कपड़े धोने का लिक्विड)', category: 'Household & Cleaning', defaultQty: 2, defaultUnit: 'L', brand: 'Surf Excel Matic / Ariel', estimatedPrice: 410 },
      { id: 'm-19', name: 'Lemon Dishwash Gel Pouch (बर्तन लिक्विड)', category: 'Household & Cleaning', defaultQty: 750, defaultUnit: 'ml', brand: 'Vim Gel', estimatedPrice: 155 }
    ]
  },
  {
    id: 'ml-travel-packing',
    title: 'Domestic & International Travel Master List (यात्रा पैकिंग ब्लूप्रिंट)',
    category: 'Travel & Outdoors',
    icon: '🧳',
    description: 'Never forget passports, chargers, medications, or thermals. Reusable across hills, beaches, and business trips.',
    updatedAt: '2026-11-08T10:05:00.000Z',
    items: [
      { id: 't-1', name: 'Original Aadhaar / Passport & Visa Printouts', category: 'Documents & Finance', defaultQty: 1, defaultUnit: 'set', brand: 'Keep in waterproof pouch + DigiLocker', estimatedPrice: 0 },
      { id: 't-2', name: 'Flight / Train Tickets & Hotel Vouchers', category: 'Documents & Finance', defaultQty: 1, defaultUnit: 'set', brand: 'Offline PDF saved in Notes', estimatedPrice: 0 },
      { id: 't-3', name: 'Emergency Cash + Zero-Forex Credit Card', category: 'Documents & Finance', defaultQty: 1, defaultUnit: 'set', brand: 'Scapia / Niyo Global + ₹5,000 cash', estimatedPrice: 0 },
      { id: 't-4', name: '20,000mAh Fast-Charge Power Bank', category: 'Electronics', defaultQty: 1, defaultUnit: 'pcs', brand: 'Mi / Anker Type-C PD (Cabin baggage only)', estimatedPrice: 1899 },
      { id: 't-5', name: 'Universal Multi-Country Travel Adapter', category: 'Electronics', defaultQty: 1, defaultUnit: 'pcs', brand: 'RTS / Belkin with surge protection', estimatedPrice: 899 },
      { id: 't-6', name: 'ANC Wireless Earbuds & Charging Cables', category: 'Electronics', defaultQty: 2, defaultUnit: 'pcs', brand: 'Type-C + Lightning braided cable', estimatedPrice: 499 },
      { id: 't-7', name: 'Fleece / Down Winter Jacket (हल्की गर्म जैकेट)', category: 'Clothing & Footwear', defaultQty: 1, defaultUnit: 'pcs', brand: 'Decathlon Forclaz (-5°C rated)', estimatedPrice: 2499 },
      { id: 't-8', name: 'Breathable Cotton T-Shirts & Base Layers', category: 'Clothing & Footwear', defaultQty: 5, defaultUnit: 'pcs', brand: 'Uniqlo Airism / Decathlon', estimatedPrice: 0 },
      { id: 't-9', name: 'Thermal Innerwear Set (थर्मल इनरवियर)', category: 'Clothing & Footwear', defaultQty: 2, defaultUnit: 'pair', brand: 'Lux Inferno / Jockey Thermal', estimatedPrice: 1190 },
      { id: 't-10', name: 'Trekking / Comfort Walking Shoes & Woolen Socks', category: 'Clothing & Footwear', defaultQty: 3, defaultUnit: 'pair', brand: 'Skechers / Quechua waterproof', estimatedPrice: 0 },
      { id: 't-11', name: 'Travel First-Aid Kit (Paracetamol,ORS, Band-Aid, Digene)', category: 'Toiletries & Medical', defaultQty: 1, defaultUnit: 'kit', brand: 'Include motion sickness tablets', estimatedPrice: 350 },
      { id: 't-12', name: 'SPF 50 Sunscreen & Lip Balm', category: 'Toiletries & Medical', defaultQty: 1, defaultUnit: 'pcs', brand: 'Minimalist / Neutrogena', estimatedPrice: 499 },
      { id: 't-13', name: 'Travel Toothbrush, Mini Toothpaste & Sanitizer', category: 'Toiletries & Medical', defaultQty: 1, defaultUnit: 'kit', brand: 'TSA 100ml compliant bottles', estimatedPrice: 220 }
    ]
  },
  {
    id: 'ml-festival-prep',
    title: 'Festival & Pooja Preparation Master List (त्योहार व पूजा तैयारी)',
    category: 'Festivals & Events',
    icon: '🪔',
    description: 'Complete checklist for Diwali, Navratri, Satyanarayan Pooja, and family celebrations.',
    updatedAt: '2026-11-08T10:10:00.000Z',
    items: [
      { id: 'f-1', name: 'Pure Bhimseni Camphor, Agarbatti & Cotton Wicks (कपूर, अगरबत्ती, रुई बत्ती)', category: 'Pooja Samagri', defaultQty: 1, defaultUnit: 'set', brand: 'Cycle Pure / Mangaldeep', estimatedPrice: 280 },
      { id: 'f-2', name: 'Clay Diyas & Brass Diya Polish (मिट्टी के दीये व पीतांबरी)', category: 'Pooja Samagri', defaultQty: 24, defaultUnit: 'pcs', brand: 'Local Artisan Potter + Pitambari', estimatedPrice: 180 },
      { id: 'f-3', name: 'Roli, Moli Kalawa, Akshat, Haldi & Supari', category: 'Pooja Samagri', defaultQty: 1, defaultUnit: 'kit', brand: 'Fresh Pooja Thali Pack', estimatedPrice: 150 },
      { id: 'f-4', name: 'California Almonds, Cashews & Pistachios (काजू, बादाम, पिस्ता)', category: 'Sweets & Dry Fruits', defaultQty: 1, defaultUnit: 'kg', brand: 'Happilo / Farmley Gift Pack', estimatedPrice: 980 },
      { id: 'f-5', name: 'Fresh Marigold & Mango Leaves Toran (गेंदे के फूल व आम के पत्ते)', category: 'Decor & Flowers', defaultQty: 4, defaultUnit: 'strings', brand: 'Morning Flower Market', estimatedPrice: 240 },
      { id: 'f-6', name: 'Warm White LED Fairy String Lights', category: 'Decor & Flowers', defaultQty: 4, defaultUnit: 'pcs', brand: 'Philips / Wipro Warm Gold', estimatedPrice: 760 }
    ]
  },
  {
    id: 'ml-home-maintenance',
    title: 'Home Maintenance & Annual Servicing Blueprint (घर रखरखाव सूची)',
    category: 'Home & Utilities',
    icon: '🛠️',
    description: 'RO filter changes, AC servicing, inverter battery check, pest control, and emergency hardware spares.',
    updatedAt: '2026-11-08T10:15:00.000Z',
    items: [
      { id: 'h-1', name: 'RO Water Purifier Sediment + Carbon Filter Kit', category: 'Appliances', defaultQty: 1, defaultUnit: 'kit', brand: 'Kent / Aquaguard Genuine', estimatedPrice: 1450 },
      { id: 'h-2', name: 'Split AC Jet Foam Service & Gas Check', category: 'Appliances', defaultQty: 2, defaultUnit: 'units', brand: 'Urban Company / Voltas Care', estimatedPrice: 1198 },
      { id: 'h-3', name: 'Inverter Tubular Battery Distilled Water Top-Up', category: 'Electrical', defaultQty: 5, defaultUnit: 'L', brand: 'Exide Battery Grade Water', estimatedPrice: 160 },
      { id: 'h-4', name: '9W Cool Daylight LED Bulbs & 3-Pin Plugs', category: 'Electrical', defaultQty: 4, defaultUnit: 'pcs', brand: 'Philips / Havells', estimatedPrice: 360 },
      { id: 'h-5', name: 'Odorless Herbal Cockroach & Ant Gel', category: 'Plumbing & Pest', defaultQty: 1, defaultUnit: 'pcs', brand: 'Bayer Maxforce / Hit Gel', estimatedPrice: 245 }
    ]
  }
];

export const STARTER_ACTIVE_LISTS = [
  {
    id: 'al-nov-grocery',
    title: 'November 2026 Monthly Grocery (नवंबर मासिक राशन)',
    masterListId: 'ml-indian-grocery',
    masterListTitle: 'Monthly Indian Grocery Master List',
    category: 'Grocery & Kitchen',
    icon: '🛒',
    createdAt: '2026-11-08T11:30:00.000Z',
    items: [
      { id: 'ai-1', masterItemId: 'm-1', name: 'Chakki Fresh Whole Wheat Atta (आटा)', category: 'Grains & Flours', qty: 10, unit: 'kg', brand: 'Aashirvaad Select', estimatedPrice: 460, checked: true },
      { id: 'ai-2', masterItemId: 'm-2', name: 'Aged Basmati Rice (बासमती चावल)', category: 'Grains & Flours', qty: 5, unit: 'kg', brand: 'India Gate Feast Rozana', estimatedPrice: 540, checked: true },
      { id: 'ai-3', masterItemId: 'm-3', name: 'Unpolished Toor / Arhar Dal (तूर दाल)', category: 'Grains & Flours', qty: 2, unit: 'kg', brand: 'Tata Sampann', estimatedPrice: 340, checked: false },
      { id: 'ai-4', masterItemId: 'm-7', name: 'Cold Pressed Mustard Oil (कच्ची घानी सरसों तेल)', category: 'Oils & Spices', qty: 2, unit: 'L', brand: 'Fortune Kachi Ghani', estimatedPrice: 360, checked: false },
      { id: 'ai-5', masterItemId: 'm-8', name: 'Pure Cow Ghee (देसी घी)', category: 'Oils & Spices', qty: 1, unit: 'L', brand: 'Amul Cow Ghee', estimatedPrice: 630, checked: false },
      { id: 'ai-6', masterItemId: 'm-12', name: 'Assam CTC Tea Leaves (चाय पत्ती)', category: 'Dairy & Breakfast', qty: 500, unit: 'gm', brand: 'Tata Tea Gold', estimatedPrice: 270, checked: false },
      { id: 'ai-7', masterItemId: 'm-13', name: 'Salted Pasteurized Butter (अमूल मक्खन)', category: 'Dairy & Breakfast', qty: 500, unit: 'gm', brand: 'Amul', estimatedPrice: 275, checked: true },
      { id: 'ai-8', masterItemId: 'm-17', name: 'Moisturizing Bath Soap Pack (नहाने का साबुन)', category: 'Toiletries', qty: 4, unit: 'pcs', brand: 'Dove Cream Bar', estimatedPrice: 220, checked: false },
      { id: 'ai-9', masterItemId: 'm-18', name: 'Front-Load Liquid Detergent (कपड़े धोने का लिक्विड)', category: 'Household & Cleaning', qty: 2, unit: 'L', brand: 'Surf Excel Matic', estimatedPrice: 410, checked: false }
    ]
  },
  {
    id: 'al-manali-trip',
    title: 'Manali & Sissu Winter Trip Packing (मनाली यात्रा)',
    masterListId: 'ml-travel-packing',
    masterListTitle: 'Domestic & International Travel Master List',
    category: 'Travel & Outdoors',
    icon: '🏔️',
    createdAt: '2026-11-08T12:15:00.000Z',
    items: [
      { id: 'at-1', masterItemId: 't-1', name: 'Original Aadhaar / Passport & Visa Printouts', category: 'Documents & Finance', qty: 2, unit: 'set', brand: 'DigiLocker + Physical ID', estimatedPrice: 0, checked: true },
      { id: 'at-2', masterItemId: 't-4', name: '20,000mAh Fast-Charge Power Bank', category: 'Electronics', qty: 1, unit: 'pcs', brand: 'Anker 22.5W PD', estimatedPrice: 1899, checked: true },
      { id: 'at-3', masterItemId: 't-7', name: 'Fleece / Down Winter Jacket (हल्की गर्म जैकेट)', category: 'Clothing & Footwear', qty: 2, unit: 'pcs', brand: 'Decathlon Forclaz -10°C', estimatedPrice: 2499, checked: false },
      { id: 'at-4', masterItemId: 't-9', name: 'Thermal Innerwear Set (थर्मल इनरवियर)', category: 'Clothing & Footwear', qty: 3, unit: 'pair', brand: 'Jockey Thermal', estimatedPrice: 1785, checked: false },
      { id: 'at-5', masterItemId: 't-11', name: 'Travel First-Aid Kit (Paracetamol, ORS, Diamox)', category: 'Toiletries & Medical', qty: 1, unit: 'kit', brand: 'High-altitude medical kit', estimatedPrice: 350, checked: false }
    ]
  }
];

export const STARTER_NOTES = [
  {
    id: 'note-1',
    title: 'Manali & Atal Tunnel 5-Day Itinerary + Homestay Details',
    content: `### Flight & Volvo Schedule\n- **Departure:** Delhi Majnu Ka Tilla at 8:30 PM (HPTDC Himsuta Volvo)\n- **Check-in:** Pinewood Orchard Cottage, Old Manali (Host: Vikram Thakur)\n\n### Checklist in Note\n- [x] Book Rohtang / Atal Tunnel cab with local union\n- [x] Carry cash for Sissu cafes (network can be patchy)\n- [ ] Buy fresh Himachali Apple cider & Kullu shawl from Bhuttico outlet`,
    tags: ['Travel', 'Manali', 'Itinerary'],
    color: 'teal',
    pinned: true,
    linkedListId: 'al-manali-trip',
    linkedCardId: 'card-3',
    updatedAt: '2026-11-08T14:20:00.000Z'
  },
  {
    id: 'note-2',
    title: 'Wholesale Kirana vs Quick-Commerce Monthly Notes (राशन बचत टिप्स)',
    content: `### Monthly Buying Strategy\n- **Grains & Whole Spices:** Buy 10kg **Aashirvaad Atta** and **Tata Sampann Dal** during monthly 1st–7th Super Saver days on BigBasket or JioMart.\n- **Dairy & Fresh Paneer:** Order via Blinkit / Zepto when needed fresh.\n\n### Family Preferences\n- Use *Kachi Ghani Mustard Oil* for parathas & pickles.\n- Keep 2 packs of ORS and Bhimseni Camphor stocked in pantry.`,
    tags: ['Grocery', 'Budget', 'Kitchen'],
    color: 'amber',
    pinned: true,
    linkedListId: 'al-nov-grocery',
    linkedCardId: 'card-1',
    updatedAt: '2026-11-08T15:00:00.000Z'
  },
  {
    id: 'note-3',
    title: 'AC & RO Filter Service Log (2026)',
    content: `### Last Service Details\n- **Master Bedroom Voltas AC:** Deep foam cleaned on 14 May 2026. Next check due before summer.\n- **Kent RO Filter:** Sediment & Carbon pre-filter changed by Rajesh Sharma (TDS calibrated to **85 ppm**).`,
    tags: ['Home', 'Maintenance', 'AMC'],
    color: 'emerald',
    pinned: false,
    linkedListId: '',
    linkedCardId: 'card-2',
    updatedAt: '2026-11-07T09:15:00.000Z'
  }
];

export const STARTER_CARDS = [
  {
    id: 'card-1',
    fullName: 'Suresh Khandelwal',
    designation: 'Proprietor · Dry Fruits & Wholesale Kirana',
    company: 'Shree Annapurna Agro & Kirana Mart',
    phone: '+91 98290 45112',
    altPhone: '+91 141 2389104',
    email: 'orders@annapurnamart.in',
    website: 'https://annapurnamart.in',
    address: 'Shop 42, Johari Bazar Main Road, Jaipur, Rajasthan 302003',
    category: 'Vendor',
    tags: ['Wholesale', 'Grocery', 'Dry Fruits', 'Home Delivery'],
    notes: 'Free home delivery on monthly grocery orders above ₹2,000. Accepts UPI.',
    createdAt: '2026-11-05T11:00:00.000Z',
    frontImage: createCardPreviewDataUrl({
      bg: '#0f172a',
      accent: '#f59e0b',
      name: 'Suresh Khandelwal',
      role: 'Proprietor · Wholesale Kirana & Dry Fruits',
      company: 'Shree Annapurna Agro Mart',
      phone: '+91 98290 45112',
      email: 'orders@annapurnamart.in',
      address: 'Shop 42, Johari Bazar, Jaipur 302003'
    })
  },
  {
    id: 'card-2',
    fullName: 'Er. Rajeshwar Sharma',
    designation: 'Senior HVAC, RO & Electrical Specialist',
    company: 'QuickFix Home Tech Services',
    phone: '+91 98114 78230',
    altPhone: '',
    email: 'rajesh.quickfix@gmail.com',
    website: 'https://quickfixhometech.in',
    address: 'B-19, Sector 18 Market, Noida, Uttar Pradesh 201301',
    category: 'Technician',
    tags: ['Electrician', 'RO Service', 'AC Repair', 'Emergency'],
    notes: 'Available 8 AM - 9 PM. Genuine Kent & Aquaguard filters stocked.',
    createdAt: '2026-11-06T16:40:00.000Z',
    frontImage: createCardPreviewDataUrl({
      bg: '#064e3b',
      accent: '#34d399',
      name: 'Er. Rajeshwar Sharma',
      role: 'Senior HVAC, RO & Electrical Specialist',
      company: 'QuickFix Home Tech Services',
      phone: '+91 98114 78230',
      email: 'rajesh.quickfix@gmail.com',
      address: 'B-19, Sector 18 Market, Noida 201301'
    })
  },
  {
    id: 'card-3',
    fullName: 'Dr. Ananya Deshmukh, MD',
    designation: 'Consultant Physician & Family Medicine',
    company: 'Surya Lifecare Polyclinic & Diagnostics',
    phone: '+91 98201 66390',
    altPhone: '+91 22 26409911',
    email: 'dr.ananya@suryalifecare.org',
    website: 'https://suryalifecare.org',
    address: '204, Emerald Plaza, Linking Road, Bandra West, Mumbai 400050',
    category: 'Doctor',
    tags: ['Family Doctor', 'Teleconsult', 'Diagnostics'],
    notes: 'OPD: Mon–Sat 10 AM to 1 PM & 6 PM to 8:30 PM. WhatsApp for prior slot.',
    createdAt: '2026-11-07T18:10:00.000Z',
    frontImage: createCardPreviewDataUrl({
      bg: '#134e4a',
      accent: '#2dd4bf',
      name: 'Dr. Ananya Deshmukh, MD',
      role: 'Consultant Physician & Family Medicine',
      company: 'Surya Lifecare Polyclinic',
      phone: '+91 98201 66390',
      email: 'dr.ananya@suryalifecare.org',
      address: '204 Emerald Plaza, Bandra West, Mumbai 400050'
    })
  }
];
