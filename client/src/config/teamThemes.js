export const teamThemes = {
  csk: {
    id: 'csk',
    code: 'CSK',
    name: 'Chennai Super Kings',
    slogan: 'Whistle Podu',
    sloganGraphic: ['WHISTLE', 'PODU'],
    heroFocus: '50% 25%',
    customBanner: '/assets/teams/csk/hero.png',
    watermarkType: 'svg',
    assets: {
      logoFull: '/teams/csk.svg',
      emblemOutline: '/teams/csk.svg',
      emblemCrop: '/teams/csk.svg',
      hero: '/assets/teams/csk/hero.png',
    },
    colors: {
      primary: '#F9CD05',       // Official CSK Canary Yellow
      secondary: '#004BA0',     // Official CSK Royal Navy Blue
      tertiary: '#FF822E',      // Lion mane fiery amber accent
      accentUi: '#F9CD05',      // Vibrant CSK Yellow for UI accents & badges (WCAG AAA with #050B16)
      liftedStrips: {
        primary: '#F9CD05',     // Canary Yellow
        secondary: '#1A5DB5',   // Lifted Royal Blue for strip contrast
        tertiary: '#FF822E',    // Fiery amber
      },
    },
  },
  dc: {
    id: 'dc',
    code: 'DC',
    name: 'Delhi Capitals',
    slogan: 'Roar Macha',
    sloganGraphic: ['ROAR', 'MACHA'],
    heroFocus: '50% 25%',
    watermarkType: 'svg',
    assets: {
      logoFull: '/assets/teams/dc/logo-full.png',
      emblemOutline: '/assets/teams/dc/emblem-outline.svg',
      emblemCrop: '/assets/teams/dc/emblem-crop.png',
      hero: '/assets/teams/dc/hero.webp',
    },
    colors: {
      primary: '#3254B1',       // Sampled jersey blue
      secondary: '#D71921',     // Sampled logo red
      tertiary: '#FAAE1A',      // Sampled logo gold shield edge
      accentUi: '#4A8DF0',      // WCAG AA 5.97:1 against #050B16
      liftedStrips: {
        primary: '#3C5EBB',     // Lifted for 3.06:1 strip contrast
        secondary: '#D71921',   // 3.53:1 contrast
        tertiary: '#FAAE1A',    // 9.71:1 contrast
      },
    },
  },
  kkr: {
    id: 'kkr',
    code: 'KKR',
    name: 'Kolkata Knight Riders',
    slogan: 'Korbo Lorbo Jeetbo Re',
    sloganGraphic: ['KORBO LORBO', 'JEETBO RE'],
    heroFocus: '50% 28%',
    watermarkType: 'svg',
    assets: {
      logoFull: '/assets/teams/kkr/logo-full.png',
      emblemOutline: '/assets/teams/kkr/emblem-outline.svg',
      emblemCrop: '/assets/teams/kkr/emblem-crop.png',
      hero: '/assets/teams/kkr/hero.webp',
    },
    colors: {
      primary: '#4A3E4B',       // Sampled jersey purple/charcoal
      secondary: '#F4C738',     // Sampled logo gold
      tertiary: '#7B4FC9',      // Lifted purple for accents
      accentUi: '#E5B93C',      // WCAG AA 10.64:1 against #050B16
      liftedStrips: {
        primary: '#6D616E',     // Lifted for 3.13:1 strip contrast
        secondary: '#F4C738',   // 11.40:1 contrast
        tertiary: '#7B4FC9',    // 3.32:1 contrast
      },
    },
  },
  pbks: {
    id: 'pbks',
    code: 'PBKS',
    name: 'Punjab Kings',
    slogan: 'Sadda Punjab',
    sloganGraphic: ['SADDA', 'PUNJAB'],
    heroFocus: '50% 28%',
    watermarkType: 'svg',
    assets: {
      logoFull: '/assets/teams/pbks/logo-full.png',
      emblemOutline: '/assets/teams/pbks/emblem-outline.svg',
      emblemCrop: '/assets/teams/pbks/emblem-crop.png',
      hero: '/assets/teams/pbks/hero.webp',
    },
    colors: {
      primary: '#CE3128',       // Sampled jersey red
      secondary: '#C59373',     // Sampled champagne gold from lion
      tertiary: '#3F5BA9',      // Sampled trouser navy
      accentUi: '#F53B47',      // WCAG AA 5.25:1 against #050B16
      liftedStrips: {
        primary: '#CE3128',     // 3.57:1 contrast
        secondary: '#C59373',   // 6.80:1 contrast
        tertiary: '#4460AE',    // Lifted for 3.02:1 strip contrast
      },
    },
  },
  rr: {
    id: 'rr',
    code: 'RR',
    name: 'Rajasthan Royals',
    slogan: 'Halla Bol',
    sloganGraphic: ['HALLA', 'BOL'],
    heroFocus: '50% 22%',
    watermarkType: 'svg',
    assets: {
      logoFull: '/assets/teams/rr/logo-full.png',
      emblemOutline: '/assets/teams/rr/emblem-outline.svg',
      emblemCrop: '/assets/teams/rr/emblem-crop.png',
      hero: '/assets/teams/rr/hero.webp',
    },
    colors: {
      primary: '#EA1A85',       // Primary pink from logo
      secondary: '#3C487C',     // Sampled deep indigo from jersey upper panel
      tertiary: '#F5B7D6',      // Tertiary soft pink
      accentUi: '#FF4DA6',      // WCAG AA 6.44:1 against #050B16
      liftedStrips: {
        primary: '#EA1A85',     // 4.35:1 contrast
        secondary: '#556195',   // Lifted for 3.08:1 strip contrast
        tertiary: '#F5B7D6',    // 11.01:1 contrast
      },
    },
  },
  srh: {
    id: 'srh',
    code: 'SRH',
    name: 'Sunrisers Hyderabad',
    slogan: 'Orange Army',
    sloganGraphic: ['ORANGE', 'ARMY'],
    heroFocus: '50% 30%',
    watermarkType: 'mask-fallback', // Quality gate approved fallback (smooth mask without JPEG artifacts)
    assets: {
      logoFull: '/assets/teams/srh/logo-full.png',
      emblemOutline: '/assets/teams/srh/emblem-outline.svg',
      emblemCrop: '/assets/teams/srh/emblem-crop.png',
      hero: '/assets/teams/srh/hero.webp',
    },
    colors: {
      primary: '#AF513C',       // Sampled jersey orange/terracotta
      secondary: '#B22026',     // Sampled logo red
      tertiary: '#F8A822',      // Sampled yellow sun rays
      accentUi: '#FF8A3D',      // WCAG AA 8.40:1 against #050B16
      liftedStrips: {
        primary: '#AF513C',     // 3.54:1 contrast
        secondary: '#BC2A30',   // Lifted for 3.06:1 strip contrast
        tertiary: '#F8A822',    // 9.25:1 contrast
      },
    },
  },
  mi: {
    id: 'mi',
    code: 'MI',
    name: 'Mumbai Indians',
    slogan: 'Duniya Hila Denge Hum',
    sloganGraphic: ['DUNIYA', 'HILA DENGE HUM'],
    heroFocus: '50% 25%',
    customBanner: '/assets/teams/mi/hero.png',
    watermarkType: 'svg',
    assets: {
      logoFull: '/teams/mi.svg',
      emblemOutline: '/teams/mi.svg',
      emblemCrop: '/teams/mi.svg',
      hero: '/assets/teams/mi/hero.png',
    },
    colors: {
      primary: '#004BA0',       // Official MI Royal Blue
      secondary: '#D1AB3E',     // Official MI Championship Gold
      tertiary: '#002D62',      // Deep Stadium Navy
      accentUi: '#0078FF',      // Vibrant Electric MI Blue for UI badges & accents
      liftedStrips: {
        primary: '#1A6ED8',     // Lifted Blue for card top strip contrast
        secondary: '#D1AB3E',   // Championship Gold
        tertiary: '#00A3FF',    // Electric Sky Blue highlight
      },
    },
  },
  lsg: {
    id: 'lsg',
    code: 'LSG',
    name: 'Lucknow Super Giants',
    slogan: 'Ab Apni Baari Hai',
    sloganGraphic: ['AB APNI', 'BAARI HAI'],
    heroFocus: '50% 25%',
    customBanner: '/assets/teams/lsg/hero.png',
    watermarkType: 'svg',
    assets: {
      logoFull: '/teams/lsg.svg',
      emblemOutline: '/teams/lsg.svg',
      emblemCrop: '/teams/lsg.svg',
      hero: '/assets/teams/lsg/hero.png',
    },
    colors: {
      primary: '#0A4D5C',       // Official LSG Deep Teal
      secondary: '#FF671F',     // Official LSG Saffron/Orange trim
      tertiary: '#002B36',      // Deep Stadium Navy/Teal
      accentUi: '#00C2E8',      // Vibrant LSG Cyan for UI badges & accents
      liftedStrips: {
        primary: '#00A3E0',     // LSG Cyan for card top strip contrast
        secondary: '#FF671F',   // Saffron Orange
        tertiary: '#00E5FF',    // Electric Turquoise highlight
      },
    },
  },
  gt: {
    id: 'gt',
    code: 'GT',
    name: 'Gujarat Titans',
    slogan: 'Aava De',
    sloganGraphic: ['AAVA', 'DE'],
    heroFocus: '50% 25%',
    customBanner: '/assets/teams/gt/hero.png',
    watermarkType: 'svg',
    assets: {
      logoFull: '/teams/gt.svg',
      emblemOutline: '/teams/gt.svg',
      emblemCrop: '/teams/gt.svg',
      hero: '/assets/teams/gt/hero.png',
    },
    colors: {
      primary: '#1C2841',       // Official GT Deep Space Navy
      secondary: '#C5A059',     // Official GT Trophy Gold
      tertiary: '#58B5E1',      // Lightning Bolt Electric Ice Blue
      accentUi: '#E2B857',      // Shimmering GT Gold for UI badges & accents
      liftedStrips: {
        primary: '#2A3A5D',     // Lifted Deep Navy for card top strip contrast
        secondary: '#E2B857',   // Trophy Gold
        tertiary: '#58B5E1',    // Lightning Ice Blue
      },
    },
  },
  rcb: {
    id: 'rcb',
    code: 'RCB',
    name: 'Royal Challengers Bengaluru',
    slogan: 'Play Bold',
    sloganGraphic: ['PLAY', 'BOLD'],
    heroFocus: '50% 25%',
    customBanner: '/assets/teams/rcb/hero.png',
    watermarkType: 'svg',
    assets: {
      logoFull: '/teams/rcb.svg',
      emblemOutline: '/teams/rcb.svg',
      emblemCrop: '/teams/rcb.svg',
      hero: '/assets/teams/rcb/hero.png',
    },
    colors: {
      primary: '#9E1B28',       // Official RCB Crimson Red
      secondary: '#D4AF37',     // Official RCB Rampant Lion Gold
      tertiary: '#1A1A1A',      // Carbon Black
      accentUi: '#E82E3A',      // Vibrant Play Bold Red for UI badges & accents
      liftedStrips: {
        primary: '#C8102E',     // Royal Red for card top strip contrast
        secondary: '#D4AF37',   // Lion Gold
        tertiary: '#FF5C67',    // Fiery Ember Red highlight
      },
    },
  },
};

export const resolveTeamKey = (input) => {
  if (!input) return null;
  const str = String(input).toLowerCase().trim();
  if (teamThemes[str]) return str;
  if (str.includes('chennai') || str.includes('super kings') || str.includes('_csk') || str.endsWith('csk') || str === 'csk') return 'csk';
  if (str.includes('gujarat') || str.includes('titans') || str.includes('giants') || str.includes('_gt') || str.endsWith('gt') || str === 'gt') return 'gt';
  if (str.includes('lucknow') || str.includes('super giants') || str.includes('_lsg') || str.endsWith('lsg') || str === 'lsg') return 'lsg';
  if (str.includes('mumbai') || str.includes('indians') || str.includes('_mi') || str.endsWith('mi') || str === 'mi') return 'mi';
  if (str.includes('rajasthan') || str.includes('_rr') || str.endsWith('rr') || str === 'rr') return 'rr';
  if (str.includes('bangalore') || str.includes('bengaluru') || str.includes('challengers') || str.includes('_rcb') || str.endsWith('rcb') || str === 'rcb') return 'rcb';
  if (str.includes('kolkata') || str.includes('knight') || str.includes('_kkr') || str.endsWith('kkr') || str === 'kkr') return 'kkr';
  if (str.includes('punjab') || str.includes('pbks') || str.includes('_pbks') || str.endsWith('pbks')) return 'pbks';
  if (str.includes('hyderabad') || str.includes('sunrisers') || str.includes('_srh') || str.endsWith('srh') || str === 'srh') return 'srh';
  if (str.includes('delhi') || str.includes('capitals') || str.includes('_dc') || str.endsWith('dc') || str === 'dc') return 'dc';
  return null;
};

export const getTeamTheme = (teamKeyOrObject) => {
  if (!teamKeyOrObject) return teamThemes.dc;

  if (typeof teamKeyOrObject === 'object') {
    const key = resolveTeamKey(teamKeyOrObject.shortName) ||
                resolveTeamKey(teamKeyOrObject.code) ||
                resolveTeamKey(teamKeyOrObject.name) ||
                resolveTeamKey(teamKeyOrObject.id) ||
                resolveTeamKey(teamKeyOrObject.username);
    if (key && teamThemes[key]) return teamThemes[key];
  }

  const resolved = resolveTeamKey(teamKeyOrObject);
  if (resolved && teamThemes[resolved]) return teamThemes[resolved];

  const key = String(teamKeyOrObject).toLowerCase();
  return teamThemes[key] || null;
};

export const THEMED_FRANCHISE_KEYS = ['csk', 'dc', 'gt', 'kkr', 'lsg', 'mi', 'pbks', 'rcb', 'rr', 'srh'];

export const isCustomThemedTeam = (teamKeyOrObject) => {
  const key = resolveTeamKey(
    typeof teamKeyOrObject === 'object' && teamKeyOrObject !== null
      ? (teamKeyOrObject.shortName || teamKeyOrObject.code || teamKeyOrObject.name || teamKeyOrObject.id || teamKeyOrObject.username)
      : teamKeyOrObject
  );
  return Boolean(key && THEMED_FRANCHISE_KEYS.includes(key));
};


