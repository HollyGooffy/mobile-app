import { cssInterop } from 'nativewind';
import { type ComponentProps, type ForwardRefExoticComponent, type RefAttributes, useCallback, useEffect, useMemo, useRef } from 'react';
import type { WebViewMessageEvent } from 'react-native-webview';
import { WebView } from 'react-native-webview';

import type { MapMarker } from '../../../entities/marker';
import type { Coordinates, UserLocation } from '../../../shared/model/geo';
import { createMapHtml } from './createMapHtml';

const StyledWebView = cssInterop(WebView, { className: 'style' });
type StyledWebViewProps = ComponentProps<typeof WebView> & { className?: string };
const StyledWebViewWithRef = StyledWebView as unknown as ForwardRefExoticComponent<StyledWebViewProps & RefAttributes<WebView>>;

type LabMapProps = {
  markers: MapMarker[];
  userLocation: UserLocation | null;
  centerOnUserRequest: number;
  onAddMarker: (coordinates: Coordinates) => void;
  onMarkerPress: (markerId: number) => void;
  onReady: () => void;
};

type MapMessage =
  | { type: 'ready' }
  | { type: 'longPress'; latitude: number; longitude: number }
  | { type: 'markerPress'; id: number }
  | { type: 'error'; message: string };

export function LabMap({ markers, userLocation, centerOnUserRequest, onAddMarker, onMarkerPress, onReady }: LabMapProps) {
  const html = useMemo(() => createMapHtml(markers), [markers]);
  const webViewRef = useRef<WebView>(null);

  const updateUserLocation = useCallback(() => {
    if (!userLocation) return;
    webViewRef.current?.injectJavaScript(
      `window.updateUserLocation && window.updateUserLocation(${JSON.stringify(userLocation)}); true;`,
    );
  }, [userLocation]);

  useEffect(updateUserLocation, [updateUserLocation]);
  useEffect(() => {
    if (centerOnUserRequest === 0 || !userLocation) return;
    updateUserLocation();
    webViewRef.current?.injectJavaScript('window.centerOnUser && window.centerOnUser(); true;');
  }, [centerOnUserRequest, updateUserLocation, userLocation]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as MapMessage;
      if (message.type === 'ready') {
        updateUserLocation();
        onReady();
      }
      if (message.type === 'longPress') onAddMarker({ latitude: message.latitude, longitude: message.longitude });
      if (message.type === 'markerPress') onMarkerPress(message.id);
      if (message.type === 'error') console.error('Ошибка карты:', message.message);
    } catch (error) {
      console.error('Некорректное сообщение карты:', error);
    }
  };

  return (
    <StyledWebViewWithRef
      ref={webViewRef}
      className="flex-1 bg-slate-200"
      javaScriptEnabled
      onLoadEnd={updateUserLocation}
      onMessage={handleMessage}
      originWhitelist={['*']}
      setSupportMultipleWindows={false}
      source={{ html, baseUrl: 'https://localhost' }}
    />
  );
}
