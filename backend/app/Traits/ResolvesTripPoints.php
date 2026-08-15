<?php

namespace App\Traits;

use App\Models\Trip;

trait ResolvesTripPoints
{
    /**
     * Resolve the lat/lng of a trip's origin or destination point, whichever of the
     * company/port pair is actually set for that side (PRD Bagian 5.1 combos).
     */
    protected function resolvePoint(Trip $trip, string $side): array
    {
        $model = $side === 'origin'
            ? ($trip->originCompany ?? $trip->originPort)
            : ($trip->destinationCompany ?? $trip->destinationPort);

        return [
            'lat' => (float) $model->latitude,
            'lng' => (float) $model->longitude,
        ];
    }

    /**
     * PRD Bagian 5.2 point 4 / Bagian 16: a return leg back to Company A is only needed
     * when Company A itself (internal) is the origin delivering TO a partner, arriving
     * FROM a partner or a port always already ends at Company A by construction (PRD
     * Bagian 5.1 combos: Port->Company A and Company B->Company A are one-way).
     */
    protected function needsReturnLeg(Trip $trip): bool
    {
        return $trip->originCompany?->type === 'internal' && $trip->destinationCompany?->type === 'partner';
    }

    /**
     * Broader than needsReturnLeg(): does the TRUCK do 2 legs (there + back), regardless
     * of trip type. True for domestic round trips (needsReturnLeg) AND unconditionally
     * for cross-border, the truck always returns to origin after dropping cargo at the
     * port, that's independent of `status` (which tracks the ship, not the truck) and
     * independent of Company.type since the truck is always Company A's own asset.
     * Used for duration-calculation branching (leg-sum vs single diff), not for
     * status-transition routing (that stays split per event in TripCheckpointController).
     */
    protected function hasTruckReturnLeg(Trip $trip): bool
    {
        return $this->needsReturnLeg($trip) || $trip->ship_destination_port_id !== null;
    }

    /**
     * PRD Bagian 18, verbatim. Shared by TripCheckpointController (truck arrival
     * checks) and TripController (ship arrival Haversine fallback, Bagian 8.2/5.3).
     */
    protected function haversineDistanceMeters(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadiusMeters = 6371000;

        $latDelta = deg2rad($lat2 - $lat1);
        $lngDelta = deg2rad($lng2 - $lng1);

        $a = sin($latDelta / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($lngDelta / 2) ** 2;
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return round($earthRadiusMeters * $c, 1);
    }
}
