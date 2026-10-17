export const teamThemes = {
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
};

export const resolveTeamKey = (input) => {
  if (!input) return null;
  const str = String(input).toLowerCase().trim();
  if (teamThemes[str]) return str;
  if (str.includes('rajasthan') || str.includes('_rr') || str.endsWith('rr') || str === 'rr') return 'rr';
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

export const THEMED_FRANCHISE_KEYS = ['dc', 'kkr', 'pbks', 'rr', 'srh'];

export const isCustomThemedTeam = (teamKeyOrObject) => {
  const key = resolveTeamKey(
    typeof teamKeyOrObject === 'object' && teamKeyOrObject !== null
      ? (teamKeyOrObject.shortName || teamKeyOrObject.code || teamKeyOrObject.name || teamKeyOrObject.id || teamKeyOrObject.username)
      : teamKeyOrObject
  );
  return Boolean(key && THEMED_FRANCHISE_KEYS.includes(key));
};


