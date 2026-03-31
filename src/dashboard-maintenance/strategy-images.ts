const svgToDataUri = (svg: string): string =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const maintenanceDashboardLightSvg = `<svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="160" height="160" rx="8" fill="white"/>
  <rect x="0.5" y="0.5" width="159" height="159" rx="7.5" stroke="black" stroke-opacity="0.12"/>
  <rect x="8" y="8" width="144" height="11" rx="5.5" fill="black" fill-opacity="0.32"/>

  <rect x="8" y="27" width="68" height="56" rx="8" fill="#E9E9E9"/>
  <rect x="84" y="27" width="68" height="25" rx="8" fill="#E9E9E9"/>
  <rect x="84" y="56" width="68" height="77" rx="8" fill="#E9E9E9"/>
  <rect x="8" y="87" width="68" height="46" rx="8" fill="#E9E9E9"/>

  <rect x="24" y="44" width="34" height="22" rx="5" fill="#03A9F4"/>
  <rect x="58" y="50" width="4" height="10" rx="2" fill="#03A9F4"/>
  <path d="M42 49H40V53H36V55H40V59H42V55H46V53H42V49Z" fill="white"/>

  <rect x="92" y="34" width="44" height="4" rx="2" fill="black" fill-opacity="0.24"/>
  <rect x="92" y="41" width="30" height="4" rx="2" fill="black" fill-opacity="0.12"/>

  <rect x="92" y="66" width="38" height="4" rx="2" fill="black" fill-opacity="0.24"/>
  <rect x="92" y="74" width="30" height="4" rx="2" fill="black" fill-opacity="0.12"/>
  <rect x="92" y="82" width="44" height="4" rx="2" fill="black" fill-opacity="0.12"/>
  <rect x="92" y="90" width="30" height="4" rx="2" fill="black" fill-opacity="0.12"/>
  <rect x="92" y="98" width="44" height="4" rx="2" fill="black" fill-opacity="0.12"/>
  <rect x="92" y="106" width="30" height="4" rx="2" fill="black" fill-opacity="0.12"/>
  <rect x="92" y="114" width="44" height="4" rx="2" fill="black" fill-opacity="0.12"/>

  <rect x="16" y="96" width="34" height="4" rx="2" fill="black" fill-opacity="0.24"/>
  <rect x="16" y="104" width="24" height="4" rx="2" fill="black" fill-opacity="0.12"/>
  <circle cx="59" cy="98" r="4" fill="black" fill-opacity="0.24"/>
  <circle cx="59" cy="112" r="4" fill="black" fill-opacity="0.12"/>
  <rect x="16" y="112" width="24" height="4" rx="2" fill="black" fill-opacity="0.12"/>
</svg>`;

const maintenanceDashboardDarkSvg = `<svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M0 8C0 3.58172 3.58172 0 8 0H152C156.418 0 160 3.58172 160 8V152C160 156.418 156.418 160 152 160H8C3.58172 160 0 156.418 0 152V8Z" fill="#1C1C1C"/>
  <path d="M8 0.5H152C156.142 0.5 159.5 3.85787 159.5 8V152C159.5 156.142 156.142 159.5 152 159.5H8C3.85787 159.5 0.5 156.142 0.5 152V8C0.5 3.85787 3.85787 0.5 8 0.5Z" stroke="white" stroke-opacity="0.24"/>
  <rect x="8" y="8" width="144" height="11" rx="5.5" fill="white" fill-opacity="0.48"/>

  <rect x="8" y="27" width="68" height="56" rx="8" fill="#1C1C1C"/>
  <rect x="8.5" y="27.5" width="67" height="55" rx="7.5" stroke="white" stroke-opacity="0.24"/>
  <rect x="84" y="27" width="68" height="25" rx="8" fill="#1C1C1C"/>
  <rect x="84.5" y="27.5" width="67" height="24" rx="7.5" stroke="white" stroke-opacity="0.24"/>
  <rect x="84" y="56" width="68" height="77" rx="8" fill="#1C1C1C"/>
  <rect x="84.5" y="56.5" width="67" height="76" rx="7.5" stroke="white" stroke-opacity="0.24"/>
  <rect x="8" y="87" width="68" height="46" rx="8" fill="#1C1C1C"/>
  <rect x="8.5" y="87.5" width="67" height="45" rx="7.5" stroke="white" stroke-opacity="0.24"/>

  <rect x="24" y="44" width="34" height="22" rx="5" fill="#03A9F4"/>
  <rect x="58" y="50" width="4" height="10" rx="2" fill="#03A9F4"/>
  <path d="M42 49H40V53H36V55H40V59H42V55H46V53H42V49Z" fill="#1C1C1C"/>

  <rect x="92" y="34" width="44" height="4" rx="2" fill="white" fill-opacity="0.48"/>
  <rect x="92" y="41" width="30" height="4" rx="2" fill="white" fill-opacity="0.24"/>

  <rect x="92" y="66" width="38" height="4" rx="2" fill="white" fill-opacity="0.48"/>
  <rect x="92" y="74" width="30" height="4" rx="2" fill="white" fill-opacity="0.24"/>
  <rect x="92" y="82" width="44" height="4" rx="2" fill="white" fill-opacity="0.24"/>
  <rect x="92" y="90" width="30" height="4" rx="2" fill="white" fill-opacity="0.24"/>
  <rect x="92" y="98" width="44" height="4" rx="2" fill="white" fill-opacity="0.24"/>
  <rect x="92" y="106" width="30" height="4" rx="2" fill="white" fill-opacity="0.24"/>
  <rect x="92" y="114" width="44" height="4" rx="2" fill="white" fill-opacity="0.24"/>

  <rect x="16" y="96" width="34" height="4" rx="2" fill="white" fill-opacity="0.48"/>
  <rect x="16" y="104" width="24" height="4" rx="2" fill="white" fill-opacity="0.24"/>
  <circle cx="59" cy="98" r="4" fill="white" fill-opacity="0.48"/>
  <circle cx="59" cy="112" r="4" fill="white" fill-opacity="0.24"/>
  <rect x="16" y="112" width="24" height="4" rx="2" fill="white" fill-opacity="0.24"/>
</svg>`;

export const MAINTENANCE_DASHBOARD_IMAGES = {
  light: svgToDataUri(maintenanceDashboardLightSvg),
  dark: svgToDataUri(maintenanceDashboardDarkSvg),
};
