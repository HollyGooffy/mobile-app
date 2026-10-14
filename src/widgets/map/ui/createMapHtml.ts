import type { MapMarker } from '../../../entities/marker';

import { MAP_STYLES } from './LabMap.styles';

export function createMapHtml(markers: MapMarker[]) {
  const serializedMarkers = JSON.stringify(
    markers.map(({ id, latitude, longitude, title }) => ({ id, latitude, longitude, title })),
  ).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>${MAP_STYLES}</style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      (function () {
        const send = (message) => window.ReactNativeWebView.postMessage(JSON.stringify(message));
        try {
          const map = L.map('map', { zoomControl: true }).setView([58.0105, 56.2294], 13);
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
          }).addTo(map);

          const markers = ${serializedMarkers};
          markers.forEach((marker, index) => {
            const icon = L.divIcon({
              className: 'lab-marker',
              html: '<div class="marker-pin ' + (index === 0 ? 'start' : '') + '"><span>' + (index + 1) + '</span></div>',
              iconSize: [44, 44], iconAnchor: [20, 40]
            });
            L.marker([marker.latitude, marker.longitude], { icon })
              .addTo(map).bindTooltip(marker.title)
              .on('click', () => send({ type: 'markerPress', id: marker.id }));
          });

          let userMarker = null;
          let accuracyCircle = null;
          let centeredOnUser = false;
          window.updateUserLocation = (location) => {
            if (!location) return;
            const point = [location.latitude, location.longitude];
            if (!userMarker) {
              userMarker = L.circleMarker(point, {
                radius: 9, color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1
              }).addTo(map).bindTooltip('Вы здесь');
              accuracyCircle = L.circle(point, {
                radius: Math.max(location.accuracy || 0, 5), color: '#2563eb',
                weight: 1, fillColor: '#60a5fa', fillOpacity: 0.12
              }).addTo(map);
            } else {
              userMarker.setLatLng(point);
              accuracyCircle.setLatLng(point).setRadius(Math.max(location.accuracy || 0, 5));
            }
            if (!centeredOnUser) {
              map.setView(point, Math.max(map.getZoom(), 15));
              centeredOnUser = true;
            }
          };

          window.centerOnUser = () => {
            if (!userMarker) return;
            map.setView(userMarker.getLatLng(), Math.max(map.getZoom(), 16), { animate: true });
            userMarker.openTooltip();
          };

          let lastLongPressAt = 0;
          const sendLongPress = (coordinates) => {
            const now = Date.now();
            if (now - lastLongPressAt < 800) return;
            lastLongPressAt = now;
            send({ type: 'longPress', latitude: coordinates.lat, longitude: coordinates.lng });
          };
          map.on('contextmenu', (event) => sendLongPress(event.latlng));

          const container = map.getContainer();
          let longPressTimer;
          let startPoint;
          container.addEventListener('touchstart', (event) => {
            if (event.touches.length !== 1) return;
            const touch = event.touches[0];
            const bounds = container.getBoundingClientRect();
            startPoint = { x: touch.clientX, y: touch.clientY };
            longPressTimer = setTimeout(() => {
              const point = L.point(startPoint.x - bounds.left, startPoint.y - bounds.top);
              sendLongPress(map.containerPointToLatLng(point));
            }, 650);
          }, { passive: true });
          container.addEventListener('touchmove', (event) => {
            if (!startPoint || event.touches.length !== 1) return;
            const touch = event.touches[0];
            if (Math.hypot(touch.clientX - startPoint.x, touch.clientY - startPoint.y) > 12) {
              clearTimeout(longPressTimer);
            }
          }, { passive: true });
          ['touchend', 'touchcancel'].forEach((eventName) => {
            container.addEventListener(eventName, () => {
              clearTimeout(longPressTimer);
              startPoint = null;
            }, { passive: true });
          });

          map.whenReady(() => send({ type: 'ready' }));
        } catch (error) {
          send({ type: 'error', message: error instanceof Error ? error.message : String(error) });
        }
      })();
    </script>
  </body>
</html>`;
}
