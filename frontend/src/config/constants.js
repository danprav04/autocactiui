// frontend/src/config/constants.js
import routerBlackIcon from '../assets/icons/router-black.png';
import routerWhiteIcon from '../assets/icons/router-white.png';
import switchBlackIcon from '../assets/icons/switch-black.png';
import switchWhiteIcon from '../assets/icons/switch-white.png';
import firewallIcon from '../assets/icons/firewall.png';
// NOTE: Using firewall icon as a placeholder for unknown/encryptor types
import unknownIcon from '../assets/icons/firewall.png'; 

/**
 * Defines the icon assets to be used for each device type, based on the current theme.
 */
export const ICONS_BY_THEME = {
  'Router': { light: routerBlackIcon, dark: routerWhiteIcon },
  'Switch': { light: switchBlackIcon, dark: switchWhiteIcon },
  'Firewall': { light: firewallIcon, dark: firewallIcon },
  'Encryptor': { light: firewallIcon, dark: firewallIcon }, // Placeholder
  'Unknown': {light: unknownIcon, dark: unknownIcon },
};

/**
 * The default device type to use for the very first node placed on the map
 * if the user doesn't select a different one.
 */
export const INITIAL_ICON_NAME = 'Router';