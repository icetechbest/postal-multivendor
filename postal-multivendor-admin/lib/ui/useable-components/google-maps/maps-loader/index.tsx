// Interfaces
import { IGoogleMapsLoaderComponentProps } from '@/lib/utils/interfaces';

/**
 * With OpenStreetMap there is no external JS SDK to preload, so this loader is
 * kept only as a pass-through so existing layouts keep working unchanged.
 */
export const GoogleMapsLoader = ({
  children,
}: IGoogleMapsLoaderComponentProps) => {
  return <>{children}</>;
};
