'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export interface MapServer {
  id: string;
  name: string;
  ipAddress: string;
  latitude: number;
  longitude: number;
  status: string;
  routerId?: string | null;
  _count?: { olts?: number };
}

export interface MapOLT {
  id: string;
  name: string;
  ipAddress: string;
  latitude: number;
  longitude: number;
  followRoad?: boolean;
  routers?: Array<{ id: string; router: { id: string; name: string } }>;
  _count?: { odcs?: number; odps?: number };
}

export interface MapODC {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  oltId: string;
  ponPort: number;
  portCount: number;
  followRoad?: boolean;
  olt?: { name: string };
}

export interface MapODP {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  odcId?: string | null;
  parentOdpId?: string | null;
  oltId: string;
  ponPort: number;
  portCount: number;
  followRoad?: boolean;
  status: string;
  odc?: { name: string };
  parentOdp?: { name: string };
  olt?: { name: string };
}

export interface MapCustomer {
  id: string;
  name: string;
  username: string;
  phone: string;
  address?: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  isOnline?: boolean;
}

export interface MapAssignment {
  customerId: string;
  odpId: string;
  portNumber: number;
  distance?: number;
  odp?: MapODP;
}

export interface MapAP {
  id: string;
  name: string;
  ipAddress: string;
  latitude: number;
  longitude: number;
  status: string;
}

export interface NetworkData {
  servers: MapServer[];
  olts: MapOLT[];
  odcs: MapODC[];
  odps: MapODP[];
  customers: MapCustomer[];
  customerAssignments?: MapAssignment[];
  customAps: MapAP[];
}

export interface VisibleLayers {
  servers: boolean;
  olts: boolean;
  odcs: boolean;
  odps: boolean;
  customers: boolean;
  cables: boolean;
  customAps: boolean;
}

export interface PonColor {
  port: number;
  color: string;
  name: string;
}

export interface NetworkMapComponentProps {
  networkData: NetworkData;
  visibleLayers: VisibleLayers;
  ponColors: PonColor[];
}

/* ------------------------------------------------------------------ */
/* Injected marker styles                                             */
/* ------------------------------------------------------------------ */

if (typeof window !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `
    .custom-customer-marker,
    .custom-server-marker,
    .custom-olt-marker,
    .custom-odc-marker,
    .custom-odp-marker,
    .custom-ap-marker {
      background: transparent !important;
      border: none !important;
    }
    @keyframes ping {
      75%, 100% { transform: scale(2); opacity: 0; }
    }
    .animate-ping { animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite; }
    .customer-marker-icon { filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }
    @keyframes dash { to { stroke-dashoffset: -30; } }
    .animated-path { animation: dash 1s linear infinite; }
  `;
  if (!document.head.querySelector('[data-map-styles]')) {
    style.setAttribute('data-map-styles', 'true');
    document.head.appendChild(style);
  }
}

/* ------------------------------------------------------------------ */
/* Basemaps                                                           */
/* ------------------------------------------------------------------ */

const MAP_LAYERS = {
  osm: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
  },
  dark: {
    name: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
  },
  topo: {
    name: 'Topographic',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org/">OpenTopoMap</a>',
  },
} as const;

type LayerKey = keyof typeof MAP_LAYERS;

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function NetworkMapComponent({
  networkData,
  visibleLayers,
  ponColors,
}: NetworkMapComponentProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentLayer, setCurrentLayer] = useState<LayerKey>('osm');
  const [isFullscreen, setIsFullscreen] = useState(false);

  /* ---------------- Init map ---------------- */
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView(
        [-6.7924, 39.2083],
        12
      );

      const layer = MAP_LAYERS[currentLayer];
      tileLayerRef.current = L.tileLayer(layer.url, {
        attribution: layer.attribution,
        maxZoom: 19,
      }).addTo(mapRef.current);

      markersRef.current = L.layerGroup().addTo(mapRef.current);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- Draw markers whenever data changes ---------------- */
  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;
    markersRef.current.clearLayers();

    /* ----- Servers ----- */
    if (visibleLayers.servers) {
      networkData.servers.forEach((server) => {
        const iconHtml = `
          <div style="position: relative; width: 40px; height: 40px;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="3" width="20" height="6" rx="1" fill="#3B82F6" stroke="#1E40AF" stroke-width="1.5"/>
              <rect x="2" y="11" width="20" height="6" rx="1" fill="#3B82F6" stroke="#1E40AF" stroke-width="1.5"/>
              <rect x="2" y="19" width="20" height="2" rx="1" fill="#3B82F6" stroke="#1E40AF" stroke-width="1.5"/>
              <circle cx="5" cy="6" r="0.8" fill="#10B981"/>
              <circle cx="5" cy="14" r="0.8" fill="#10B981"/>
            </svg>
          </div>`;
        const marker = L.marker([server.latitude, server.longitude], {
          icon: L.divIcon({
            className: 'custom-server-marker',
            html: iconHtml,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          }),
        });
        marker.bindPopup(`
          <div class="p-2">
            <h3 class="font-bold text-blue-600">🖥️ Server</h3>
            <p class="text-sm"><strong>${server.name}</strong></p>
            <p class="text-xs text-gray-600">${server.ipAddress}</p>
            <p class="text-xs text-gray-500">Status: ${server.status}</p>
            <p class="text-xs text-gray-500">OLTs: ${server._count?.olts || 0}</p>
          </div>`);
        markersRef.current?.addLayer(marker);
      });
    }

    /* ----- OLTs ----- */
    if (visibleLayers.olts) {
      networkData.olts.forEach((olt) => {
        const iconHtml = `
          <div style="position: relative; width: 36px; height: 36px;">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="5" width="18" height="14" rx="2" fill="#A855F7" stroke="#7C3AED" stroke-width="1.5"/>
              <rect x="6" y="8" width="4" height="3" rx="0.5" fill="#E9D5FF"/>
              <rect x="6" y="12" width="4" height="3" rx="0.5" fill="#E9D5FF"/>
              <rect x="14" y="8" width="4" height="3" rx="0.5" fill="#E9D5FF"/>
              <rect x="14" y="12" width="4" height="3" rx="0.5" fill="#E9D5FF"/>
            </svg>
          </div>`;
        const marker = L.marker([olt.latitude, olt.longitude], {
          icon: L.divIcon({
            className: 'custom-olt-marker',
            html: iconHtml,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          }),
        });
        const routerNames =
          olt.routers?.map((r) => r.router?.name).filter(Boolean).join(', ') ||
          '-';
        marker.bindPopup(`
          <div class="p-2">
            <h3 class="font-bold text-purple-600">📡 OLT</h3>
            <p class="text-sm"><strong>${olt.name}</strong></p>
            <p class="text-xs text-gray-600">${olt.ipAddress}</p>
            <p class="text-xs text-gray-500">Routers: ${routerNames}</p>
            <p class="text-xs text-gray-500">ODCs: ${olt._count?.odcs || 0}</p>
            <p class="text-xs text-gray-500">ODPs: ${olt._count?.odps || 0}</p>
          </div>`);
        markersRef.current?.addLayer(marker);
      });
    }

    /* ----- ODCs ----- */
    if (visibleLayers.odcs) {
      networkData.odcs.forEach((odc) => {
        const ponColor =
          ponColors.find((p) => p.port === odc.ponPort)?.color || '#EAB308';
        const directOdps = networkData.odps.filter((o) => o.odcId === odc.id);
        const getTotalOdps = (parentOdpIds: string[]): number => {
          const childOdps = networkData.odps.filter((o) =>
            parentOdpIds.includes(o.parentOdpId || '')
          );
          if (childOdps.length === 0) return 0;
          return childOdps.length + getTotalOdps(childOdps.map((o) => o.id));
        };
        const totalOdps =
          directOdps.length + getTotalOdps(directOdps.map((o) => o.id));
        const iconHtml = `
          <div style="position: relative; width: 32px; height: 32px;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="6" width="16" height="12" rx="1.5" fill="${ponColor}" stroke="#854D0E" stroke-width="1.5"/>
              <rect x="7" y="9" width="2" height="2" rx="0.5" fill="white" opacity="0.9"/>
              <rect x="11" y="9" width="2" height="2" rx="0.5" fill="white" opacity="0.9"/>
              <rect x="15" y="9" width="2" height="2" rx="0.5" fill="white" opacity="0.9"/>
            </svg>
          </div>`;
        const marker = L.marker([odc.latitude, odc.longitude], {
          icon: L.divIcon({
            className: 'custom-odc-marker',
            html: iconHtml,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          }),
        });
        marker.bindPopup(`
          <div class="p-2">
            <h3 class="font-bold text-yellow-600">📻 ODC</h3>
            <p class="text-sm"><strong>${odc.name}</strong></p>
            <p class="text-xs text-gray-600">PON Port: ${odc.ponPort}</p>
            <p class="text-xs text-gray-500">OLT: ${odc.olt?.name || '-'}</p>
            <p class="text-xs text-gray-500">Port Count: ${odc.portCount}</p>
            <p class="text-xs text-gray-500">ODPs: ${totalOdps}</p>
          </div>`);
        markersRef.current?.addLayer(marker);
      });
    }

    /* ----- ODPs ----- */
    if (visibleLayers.odps) {
      networkData.odps.forEach((odp) => {
        const ponColor =
          ponColors.find((p) => p.port === odp.ponPort)?.color || '#10B981';
        const iconHtml = `
          <div style="position: relative; width: 28px; height: 28px;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" fill="${ponColor}" stroke="#065F46" stroke-width="1.5"/>
              <circle cx="12" cy="12" r="6" fill="white" opacity="0.3"/>
            </svg>
          </div>`;
        const marker = L.marker([odp.latitude, odp.longitude], {
          icon: L.divIcon({
            className: 'custom-odp-marker',
            html: iconHtml,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
        });
        marker.bindPopup(`
          <div class="p-2">
            <h3 class="font-bold text-green-600">📶 ODP</h3>
            <p class="text-sm"><strong>${odp.name}</strong></p>
            <p class="text-xs text-gray-600">PON Port: ${odp.ponPort}</p>
            <p class="text-xs text-gray-500">Port Count: ${odp.portCount || 8}</p>
            ${odp.odc ? `<p class="text-xs text-gray-500">ODC: ${odp.odc.name}</p>` : ''}
            ${odp.parentOdp ? `<p class="text-xs text-gray-500">Parent ODP: ${odp.parentOdp.name}</p>` : ''}
            <p class="text-xs text-gray-500">OLT: ${odp.olt?.name || '-'}</p>
            <p class="text-xs text-gray-500">Status: ${odp.status}</p>
          </div>`);
        markersRef.current?.addLayer(marker);
      });
    }

    /* ----- Customers ----- */
    if (visibleLayers.customers) {
      networkData.customers.forEach((customer) => {
        if (customer.latitude != null && customer.longitude != null) {
          const isOnline = !!customer.isOnline;
          const isActive = customer.status === 'active';
          const iconHtml = isOnline
            ? `
              <div class="relative flex items-center justify-center">
                <div class="absolute w-9 h-9 bg-green-400 rounded-full animate-ping opacity-75"></div>
                <div class="relative customer-marker-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" fill="#10B981" stroke="white" stroke-width="2"/>
                  </svg>
                </div>
              </div>`
            : `
              <div class="relative flex items-center justify-center">
                <div class="absolute w-9 h-9 bg-red-400 rounded-full animate-ping opacity-75"></div>
                <div class="relative customer-marker-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" fill="${isActive ? '#EF4444' : '#9CA3AF'}" stroke="white" stroke-width="2"/>
                  </svg>
                </div>
              </div>`;
          const marker = L.marker(
            [customer.latitude, customer.longitude],
            {
              icon: L.divIcon({
                className: 'custom-customer-marker',
                html: iconHtml,
                iconSize: [32, 32],
                iconAnchor: [16, 16],
              }),
            }
          );
          const assignment = networkData.customerAssignments?.find(
            (a) => a.customerId === customer.id
          );
          marker.bindPopup(`
            <div class="p-2">
              <h3 class="font-bold text-blue-600 flex items-center gap-1">
                👤 Customer
                ${isOnline
                  ? '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700">Online</span>'
                  : '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">Offline</span>'}
              </h3>
              <p class="text-sm mt-1"><strong>${customer.name}</strong></p>
              <p class="text-xs text-gray-600">${customer.username}</p>
              <p class="text-xs text-gray-500">Phone: ${customer.phone}</p>
              ${customer.address ? `<p class="text-xs text-gray-500">Address: ${customer.address}</p>` : ''}
              ${assignment ? `<p class="text-xs text-gray-500 mt-1">📶 ODP: ${assignment.odp?.name || '-'} - Port ${assignment.portNumber}</p>` : ''}
              <p class="text-xs mt-1">
                <span class="font-semibold">Account:</span>
                <span class="${isActive ? 'text-green-600' : 'text-red-600'}">${isActive ? 'Active' : 'Inactive'}</span>
              </p>
            </div>`);
          markersRef.current?.addLayer(marker);
        }
      });
    }

    /* ----- Custom APs ----- */
    if (visibleLayers.customAps && networkData.customAps) {
      networkData.customAps.forEach((ap) => {
        const isOnline = ap.status === 'online';
        const iconHtml = `
          <div style="position:relative;width:32px;height:32px;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="5" width="18" height="14" rx="2" fill="${isOnline ? '#10B981' : '#6B7280'}" stroke="${isOnline ? '#047857' : '#374151'}" stroke-width="1.5"/>
              <path d="M7 10h10M7 14h6" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
              <circle cx="17" cy="14" r="1.5" fill="white"/>
            </svg>
          </div>`;
        const marker = L.marker([ap.latitude, ap.longitude], {
          icon: L.divIcon({
            className: 'custom-ap-marker',
            html: iconHtml,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          }),
        });
        marker.bindPopup(`
          <div class="p-2">
            <h3 class="font-bold text-teal-600">📶 Custom AP</h3>
            <p><strong>${ap.name}</strong></p>
            <p class="text-xs text-gray-600">IP: ${ap.ipAddress}</p>
            <p class="text-xs">Status: ${isOnline ? '🟢 Online' : '🔴 Offline'}</p>
          </div>`);
        markersRef.current?.addLayer(marker);
      });
    }

    /* ----- Cables (customer → ODP lines) ----- */
    if (
      visibleLayers.cables &&
      visibleLayers.customers &&
      networkData.customerAssignments
    ) {
      networkData.customerAssignments.forEach((assignment) => {
        const customer = networkData.customers.find(
          (c) => c.id === assignment.customerId
        );
        const odp = networkData.odps.find((o) => o.id === assignment.odpId);

        if (
          customer &&
          odp &&
          customer.latitude != null &&
          customer.longitude != null
        ) {
          const isOnline = !!customer.isOnline;
          const lineColor = isOnline ? '#10B981' : '#EF4444';

          const borderLine = L.polyline(
            [
              [odp.latitude, odp.longitude],
              [customer.latitude, customer.longitude],
            ],
            {
              color: '#FFFFFF',
              weight: 4,
              opacity: 0.9,
              dashArray: '10,10',
              className: 'animated-path',
            }
          );
          const polyline = L.polyline(
            [
              [odp.latitude, odp.longitude],
              [customer.latitude, customer.longitude],
            ],
            {
              color: lineColor,
              weight: 2,
              opacity: 0.8,
              dashArray: '10,10',
              className: 'animated-path',
            }
          );
          polyline.bindPopup(`
            <div class="text-sm">
              <strong>${customer.name}</strong> → <strong>${odp.name}</strong><br/>
              Port: ${assignment.portNumber}<br/>
              ${assignment.distance ? `Distance: ${assignment.distance.toFixed(2)} km<br/>` : ''}
              Status: <span class="${isOnline ? 'text-green-600' : 'text-red-600'}">${isOnline ? '🟢 Online' : '🔴 Offline'}</span>
            </div>`);
          markersRef.current?.addLayer(borderLine);
          markersRef.current?.addLayer(polyline);
        }
      });
    }

    /* ----- OLT-Server, OLT-ODC, ODC/ODP-ODP connections ----- */
    if (visibleLayers.cables) {
      (async () => {
        const drawStraightLine = (
          source: { latitude: number; longitude: number; name: string },
          target: { latitude: number; longitude: number; name: string },
          color: string,
          label: string
        ) => {
          const polyline = L.polyline(
            [
              [source.latitude, source.longitude],
              [target.latitude, target.longitude],
            ],
            {
              color,
              weight: 2,
              opacity: 0.6,
              dashArray: '10,10',
              className: 'animated-path',
            }
          );
          polyline.bindPopup(`
            <div class="text-sm">
              <strong>${source.name}</strong> → <strong>${target.name}</strong><br/>
              ${label} ➡️ Straight line
            </div>`);
          markersRef.current?.addLayer(polyline);
        };

        const drawRoadConnection = async (
          source: { latitude: number; longitude: number; name: string },
          target: { latitude: number; longitude: number; name: string },
          color: string,
          label: string
        ): Promise<boolean> => {
          try {
            const url = `https://osrm.gnetid.xyz/route/v1/driving/${source.longitude},${source.latitude};${target.longitude},${target.latitude}?overview=full&geometries=geojson`;
            const res = await fetch(url, {
              headers: { Accept: 'application/json' },
            });
            if (!res.ok) return false;
            const data = await res.json();
            if (data.code !== 'Ok' || !data.routes?.[0]) return false;
            const coords = data.routes[0].geometry.coordinates.map(
              ([lng, lat]: [number, number]) => [lat, lng]
            );
            const polyline = L.polyline(coords, {
              color,
              weight: 2.5,
              opacity: 0.7,
              dashArray: '10,10',
              className: 'animated-path',
            });
            polyline.bindPopup(`
              <div class="text-sm">
                <strong>${source.name}</strong> → <strong>${target.name}</strong><br/>
                ${label}<br/>
                Distance: ${(data.routes[0].distance / 1000).toFixed(2)} km<br/>
                🛣️ Following road
              </div>`);
            markersRef.current?.addLayer(polyline);
            return true;
          } catch {
            return false;
          }
        };

        /* OLT-Server */
        for (const olt of networkData.olts) {
          const oltRouters = olt.routers || [];
          for (const oltRouter of oltRouters) {
            const router = oltRouter.router;
            if (!router) continue;
            const server = networkData.servers.find(
              (s) => s.routerId === router.id
            );
            if (!server) continue;

            if (olt.followRoad) {
              const ok = await drawRoadConnection(
                server,
                olt,
                '#A855F7',
                `Router: ${router.name}`
              );
              if (ok) continue;
            }
            drawStraightLine(
              server,
              olt,
              '#A855F7',
              `<strong>${router.name}</strong><br/>`
            );
          }
        }

        /* OLT-ODC */
        for (const odc of networkData.odcs) {
          const olt = networkData.olts.find((o) => o.id === odc.oltId);
          if (!olt) continue;
          const ponColor =
            ponColors.find((p) => p.port === odc.ponPort)?.color || '#EAB308';

          if (odc.followRoad) {
            const ok = await drawRoadConnection(
              olt,
              odc,
              ponColor,
              `PON Port: ${odc.ponPort}`
            );
            if (ok) continue;
          }
          drawStraightLine(olt, odc, ponColor, `PON Port: ${odc.ponPort}`);
        }

        /* ODC/ODP-ODP */
        for (const odp of networkData.odps) {
          const ponColor =
            ponColors.find((p) => p.port === odp.ponPort)?.color || '#10B981';

          if (odp.odcId) {
            const odc = networkData.odcs.find((o) => o.id === odp.odcId);
            if (odc) {
              if (odp.followRoad) {
                const ok = await drawRoadConnection(
                  odc,
                  odp,
                  ponColor,
                  `PON Port: ${odp.ponPort}`
                );
                if (ok) continue;
              }
              drawStraightLine(odc, odp, ponColor, `PON Port: ${odp.ponPort}`);
            }
          } else if (odp.parentOdpId) {
            const parentOdp = networkData.odps.find(
              (o) => o.id === odp.parentOdpId
            );
            if (parentOdp) {
              if (odp.followRoad) {
                const ok = await drawRoadConnection(
                  parentOdp,
                  odp,
                  ponColor,
                  `PON Port: ${odp.ponPort}`
                );
                if (ok) continue;
              }
              drawStraightLine(
                parentOdp,
                odp,
                ponColor,
                `PON Port: ${odp.ponPort}`
              );
            }
          }
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkData, visibleLayers, ponColors]);

  /* ---------------- Layer switcher ---------------- */
  const handleLayerChange = (layerKey: LayerKey) => {
    if (mapRef.current && tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
      const layer = MAP_LAYERS[layerKey];
      tileLayerRef.current = L.tileLayer(layer.url, {
        attribution: layer.attribution,
        maxZoom: 19,
      }).addTo(mapRef.current);
      setCurrentLayer(layerKey);
    }
  };

  /* ---------------- Fullscreen ---------------- */
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 100);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-gray-900">
      <div ref={mapContainerRef} className="w-full h-full" />

      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-1">
        {(Object.keys(MAP_LAYERS) as LayerKey[]).map((key) => (
          <button
            key={key}
            onClick={() => handleLayerChange(key)}
            title={MAP_LAYERS[key].name}
            className={`w-9 h-9 rounded shadow-lg transition-all ${
              currentLayer === key
                ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <span className="text-xs font-semibold">
              {key === 'osm' && '🗺️'}
              {key === 'satellite' && '🛰️'}
              {key === 'dark' && '🌙'}
              {key === 'topo' && '⛰️'}
            </span>
          </button>
        ))}
      </div>

      <button
        onClick={toggleFullscreen}
        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        className="absolute bottom-4 right-4 z-[1000] w-10 h-10 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded shadow-lg transition-all flex items-center justify-center"
      >
        <span className="text-lg">{isFullscreen ? '❌' : '⛶'}</span>
      </button>
    </div>
  );
}