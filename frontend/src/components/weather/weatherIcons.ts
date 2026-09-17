import type { ElementType } from 'react';
import { Sun, CloudSun, Cloud, CloudFog, CloudRain, CloudSnow, CloudLightning } from 'lucide-react';

export function getWeatherIcon(code: number): ElementType {
  // WMO codes based on WMO 4677 standard (used by Open-Meteo)
  if (code === 0) return Sun; // Clear sky
  if (code === 1 || code === 2) return CloudSun; // Mainly clear, Partly cloudy
  if (code === 3) return Cloud; // Overcast
  if (code === 45 || code === 48) return CloudFog; // Fog
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return CloudRain; // Drizzle, Rain, Showers
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return CloudSnow; // Snow
  if (code >= 95 && code <= 99) return CloudLightning; // Thunderstorm
  return Cloud;
}

export function getWeatherTheme(code: number): {
  iconColor: string;
  bgGradient: string;
} {
  if (code === 0 || code === 1) {
    return {
      iconColor: 'text-amber-500',
      bgGradient: 'from-amber-500/10 to-orange-500/5',
    };
  }
  if (code === 2 || code === 3) {
    return {
      iconColor: 'text-sky-500',
      bgGradient: 'from-sky-500/10 to-blue-500/5',
    };
  }
  if (code >= 51 && code <= 82) {
    return {
      iconColor: 'text-blue-600',
      bgGradient: 'from-blue-500/10 to-indigo-500/5',
    };
  }
  if (code >= 95) {
    return {
      iconColor: 'text-purple-600',
      bgGradient: 'from-purple-500/10 to-indigo-500/5',
    };
  }
  return {
    iconColor: 'text-sand-600',
    bgGradient: 'from-sand-500/10 to-sand-500/5',
  };
}
