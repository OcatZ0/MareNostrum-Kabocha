const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY || '';

/**
 * Fetch a live-traffic road route between two points and return its
 * geometry as a flat [lng,lat] coordinate path, ready to draw as a
 * GeoJSON LineString.
 *
 * Orbis v3 route-planning endpoint — requires apiVersion=3 and an
 * "Attributes: routes" header to select the top-level response field;
 * geometry comes back at routes[].legs[].path.coordinates, already in
 * [lng,lat] order. Verified against a live call (the publicly documented
 * Orbis v2 calculateRoute page describes a different, path-based endpoint
 * with a points[] shape) — see DriverDashboard.jsx for the original
 * investigation.
 */
export const fetchRoutePath = async (originLat, originLng, destLat, destLng) => {
  const url = `https://api.tomtom.com/maps/orbis/routing/routes/calculate?key=${TOMTOM_API_KEY}&apiVersion=3`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Attributes': 'routes' },
    body: JSON.stringify({
      routePlanningLocations: {
        origin:      { type: 'Point', coordinates: [originLng, originLat] },
        destination: { type: 'Point', coordinates: [destLng, destLat] },
      },
      routeType: 'efficient',
      traffic: 'live',
    }),
  });

  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) throw new Error(data.detailedError?.message || 'No route found');

  return route.legs.flatMap((leg) => leg.path.coordinates);
};
