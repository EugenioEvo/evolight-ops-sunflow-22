import L from 'leaflet';

// Create custom icon to avoid production build issues
export const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Set the default icon for all markers
L.Marker.prototype.options.icon = defaultIcon;

// Create numbered marker icon
export const createNumberedIcon = (number: number, prioridade: string) => {
  const colorMap: Record<string, string> = {
    critica: '#dc2626', // red-600
    alta: '#f97316',    // orange-500
    media: '#eab308',   // yellow-500
    baixa: '#22c55e'    // green-500
  };
  
  const color = colorMap[prioridade] || '#3b82f6';
  
  return L.divIcon({
    className: 'custom-numbered-icon',
    html: `
      <div style="
        background-color: ${color};
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 16px;
        color: white;
      ">
        ${number}
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
  });
};

// Create Evolight start point marker (special icon)
export const createEvolightIcon = () => {
  return L.divIcon({
    className: 'custom-evolight-icon',
    html: `
      <div style="
        background-color: #8B5CF6;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: 4px solid white;
        box-shadow: 0 4px 12px rgba(139, 92, 246, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
      ">
        🏢
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22]
  });
};

// Haversine distance calculation (km)
export const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Normaliza e corrige coordenadas (lat, lon) para o Brasil
export const normalizeCoordinates = (lat: any, lon: any): [number, number] => {
  let latitude = typeof lat === 'string' ? parseFloat(lat) : lat;
  let longitude = typeof lon === 'string' ? parseFloat(lon) : lon;

  const isLatInBR = latitude >= -34 && latitude <= 6;
  const isLonInBR = longitude >= -74 && longitude <= -34;

  // Se estiverem fora do range do Brasil, tentar inverter
  const swappedLat = typeof lon === 'string' ? parseFloat(lon) : lon;
  const swappedLon = typeof lat === 'string' ? parseFloat(lat) : lat;
  const swapIsBetter = !isLatInBR || !isLonInBR
    ? (swappedLat >= -34 && swappedLat <= 6) && (swappedLon >= -74 && swappedLon <= -34)
    : false;

  if (swapIsBetter) {
    return [swappedLat, swappedLon];
  }

  return [latitude, longitude];
};

// Calculate route totals (distance and time)
export const calculateRouteTotals = (tickets: any[]) => {
  let totalDistance = 0;
  let totalTime = 0;
  
  const ticketsWithCoords = tickets.filter(t => t.hasRealCoords);
  
  if (ticketsWithCoords.length < 2) {
    return {
      distance: '0 km',
      time: '0h 0min'
    };
  }
  
  for (let i = 0; i < ticketsWithCoords.length - 1; i++) {
    const dist = haversineDistance(
      ticketsWithCoords[i].coordenadas[0], ticketsWithCoords[i].coordenadas[1],
      ticketsWithCoords[i+1].coordenadas[0], ticketsWithCoords[i+1].coordenadas[1]
    );
    totalDistance += dist;
    
    // Estimate 30 km/h urban traffic + 15min per stop
    const travelTime = (dist / 30) * 60; // minutes
    totalTime += travelTime + 15; // +15min stop time
  }
  
  // Add service time
  const serviceTime = tickets.reduce((sum, t) => {
    const tempo = parseInt(t.estimativa) || 0;
    return sum + tempo * 60;
  }, 0);
  totalTime += serviceTime;
  
  return {
    distance: `${totalDistance.toFixed(1)} km`,
    time: `${Math.floor(totalTime / 60)}h ${Math.floor(totalTime % 60)}min`
  };
};

// Priority color helper
export const getPrioridadeColor = (prioridade: string) => {
  switch (prioridade) {
    case "alta": return "bg-red-100 text-red-800";
    case "media": return "bg-yellow-100 text-yellow-800";
    case "baixa": return "bg-green-100 text-green-800";
    default: return "bg-muted text-muted-foreground";
  }
};

// Status color helper
export const getStatusColor = (status: string) => {
  switch (status) {
    case "pendente": return "bg-gray-100 text-gray-800";
    case "em_andamento": return "bg-blue-100 text-blue-800";
    case "concluido": return "bg-green-100 text-green-800";
    default: return "bg-muted text-muted-foreground";
  }
};

// Evolight headquarters coordinates
export const EVOLIGHT_COORDS: [number, number] = [-16.6869, -49.2648];
