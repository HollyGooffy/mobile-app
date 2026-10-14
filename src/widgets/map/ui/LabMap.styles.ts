export const MAP_STYLES = `
  html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; }
  body { background: #e2e8f0; }
  .leaflet-control-attribution { font: 9px/1.2 system-ui, sans-serif; }
  .lab-marker { background: transparent; border: 0; }
  .marker-pin {
    display: flex; align-items: center; justify-content: center;
    width: 38px; height: 38px; color: white; background: #2563eb;
    border: 3px solid white; border-radius: 50% 50% 50% 0;
    box-shadow: 0 3px 8px rgba(15, 23, 42, .35);
    font: 800 13px/1 system-ui, sans-serif; transform: rotate(-45deg);
  }
  .marker-pin.start { background: #f59e0b; }
  .marker-pin span { transform: rotate(45deg); }
`;
