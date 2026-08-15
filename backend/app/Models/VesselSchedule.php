<?php

namespace App\Models;

use App\Context\NotificationType;
use App\Context\Role;
use App\Context\VesselScheduleStatus;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VesselSchedule extends Model
{
    protected $fillable = [
        'vessel_name',
        'ship_ref_id',
        'voyage_number',
        'origin_port_id',
        'destination_port_id',
        'scheduled_departure_at',
        'scheduled_arrival_at',
        'actual_departure_at',
        'actual_arrival_at',
        'estimated_arrival_at',
        'status',
        'current_latitude',
        'current_longitude',
        'current_speed_knots',
        'distance_to_destination_km',
        'distance_to_destination_nm',
        'variance_minutes',
        'tolerance_minutes',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'scheduled_departure_at' => 'datetime',
        'scheduled_arrival_at' => 'datetime',
        'actual_departure_at' => 'datetime',
        'actual_arrival_at' => 'datetime',
        'estimated_arrival_at' => 'datetime',
        'current_latitude' => 'float',
        'current_longitude' => 'float',
        'current_speed_knots' => 'float',
        'distance_to_destination_km' => 'float',
        'distance_to_destination_nm' => 'float',
        'variance_minutes' => 'integer',
        'tolerance_minutes' => 'integer',
    ];

    public function originPort(): BelongsTo
    {
        return $this->belongsTo(Port::class, 'origin_port_id');
    }

    public function destinationPort(): BelongsTo
    {
        return $this->belongsTo(Port::class, 'destination_port_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Calculate distance using Haversine formula (in km and nautical miles).
     */
    public static function haversineDistance(float $lat1, float $lon1, float $lat2, float $lon2): array
    {
        $earthRadiusKm = 6371;

        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);

        $a = sin($dLat / 2) * sin($dLat / 2) +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
             sin($dLon / 2) * sin($dLon / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
        $distanceKm = $earthRadiusKm * $c;
        $distanceNm = $distanceKm * 0.539957; // 1 km = 0.539957 Nautical Miles

        return [
            'km' => round($distanceKm, 2),
            'nm' => round($distanceNm, 2),
        ];
    }

    /**
     * Update live position, calculate distance to destination port,
     * evaluate punctuality (delayed / early / on_time), and trigger notifications.
     */
    public function updatePunctualityAndAlert(
        ?float $latitude = null,
        ?float $longitude = null,
        ?float $speedKnots = null,
        bool $dispatchNotifications = true
    ): array {
        $this->loadMissing(['originPort', 'destinationPort']);

        $lat = $latitude ?? $this->current_latitude;
        $lng = $longitude ?? $this->current_longitude;
        $speed = $speedKnots ?? $this->current_speed_knots ?? 0;

        $distanceKm = null;
        $distanceNm = null;
        $varianceMinutes = 0;
        $oldStatus = $this->status;
        $newStatus = $this->status;
        $notificationTriggered = null;

        $destPort = $this->destinationPort;

        if ($destPort && $lat !== null && $lng !== null) {
            $distances = self::haversineDistance(
                (float) $lat,
                (float) $lng,
                (float) $destPort->latitude,
                (float) $destPort->longitude
            );

            $distanceKm = $distances['km'];
            $distanceNm = $distances['nm'];

            // If speed > 0 and distance is known, estimate remaining travel time
            if ($speed > 0.5 && $distanceNm > 0.1) {
                $hoursRemaining = $distanceNm / $speed;
                $minutesRemaining = (int) round($hoursRemaining * 60);
                $this->estimated_arrival_at = Carbon::now()->addMinutes($minutesRemaining);
            } elseif ($this->estimated_arrival_at === null) {
                $this->estimated_arrival_at = $this->scheduled_arrival_at;
            }

            // If within 300 meters of destination port, consider berthing/arrived
            if ($distanceKm <= 0.3) {
                $newStatus = VesselScheduleStatus::ARRIVED;
                if (! $this->actual_arrival_at) {
                    $this->actual_arrival_at = Carbon::now();
                }
            } elseif ($distanceKm <= 1.0) {
                $newStatus = VesselScheduleStatus::BERTHING;
            }
        }

        // Calculate variance in minutes between estimated/actual arrival and scheduled arrival
        $referenceArrival = $this->actual_arrival_at ?? $this->estimated_arrival_at ?? $this->scheduled_arrival_at;

        if ($referenceArrival && $this->scheduled_arrival_at) {
            // positive = arriving after scheduled time (delayed)
            // negative = arriving before scheduled time (early)
            $varianceMinutes = (int) $this->scheduled_arrival_at->diffInMinutes($referenceArrival, false);
        }

        $tolerance = $this->tolerance_minutes ?? 30;

        // If not arrived or berthing, evaluate schedule variance
        if (! in_array($newStatus, [VesselScheduleStatus::ARRIVED, VesselScheduleStatus::BERTHING, VesselScheduleStatus::CANCELLED], true)) {
            if ($varianceMinutes > $tolerance) {
                $newStatus = VesselScheduleStatus::DELAYED;
            } elseif ($varianceMinutes < (-1 * $tolerance)) {
                $newStatus = VesselScheduleStatus::EARLY;
            } elseif ($this->actual_departure_at || $this->status === VesselScheduleStatus::DEPARTED) {
                $newStatus = VesselScheduleStatus::ON_TIME;
            } else {
                $newStatus = VesselScheduleStatus::SCHEDULED;
            }
        }

        $this->current_latitude = $lat;
        $this->current_longitude = $lng;
        $this->current_speed_knots = $speed;
        $this->distance_to_destination_km = $distanceKm;
        $this->distance_to_destination_nm = $distanceNm;
        $this->variance_minutes = $varianceMinutes;
        $this->status = $newStatus;
        $this->save();

        // Dispatch notifications if status changed or variance exceeded threshold
        if ($dispatchNotifications && ($oldStatus !== $newStatus || abs($varianceMinutes) > $tolerance)) {
            $notificationTriggered = $this->sendPunctualityNotification($newStatus, $varianceMinutes);
        }

        return [
            'status' => $newStatus,
            'previous_status' => $oldStatus,
            'distance_to_destination_km' => $distanceKm,
            'distance_to_destination_nm' => $distanceNm,
            'variance_minutes' => $varianceMinutes,
            'estimated_arrival_at' => $this->estimated_arrival_at?->toISOString(),
            'scheduled_arrival_at' => $this->scheduled_arrival_at?->toISOString(),
            'notification_triggered' => $notificationTriggered,
        ];
    }

    /**
     * Dispatch in-app notifications to Admin and relevant drivers.
     */
    protected function sendPunctualityNotification(string $status, int $varianceMinutes): ?string
    {
        $admins = User::where('role', Role::ADMIN)->get();
        if ($admins->isEmpty()) {
            return null;
        }

        $vesselName = $this->vessel_name;
        $destPortName = $this->destinationPort?->name ?? 'Destination Port';
        $absVariance = abs($varianceMinutes);

        $notificationType = NotificationType::GENERAL;
        $message = '';

        if ($status === VesselScheduleStatus::DELAYED) {
            $notificationType = NotificationType::VESSEL_DELAY_WARNING;
            $message = "⚠️ Peringatan Keterlambatan: Kapal {$vesselName} diprediksi terlambat {$absVariance} menit menuju {$destPortName}. Mohon sesuaikan jadwal truk bongkar muat.";
        } elseif ($status === VesselScheduleStatus::EARLY) {
            $notificationType = NotificationType::VESSEL_EARLY_ALERT;
            $message = "⚡ Peringatan Kedatangan Cepat: Kapal {$vesselName} diprediksi tiba {$absVariance} menit LEBIH CEPAT di {$destPortName}. Harap instruksikan truk penjemput untuk bersiap lebih awal.";
        } elseif ($status === VesselScheduleStatus::ARRIVED) {
            $notificationType = NotificationType::SHIP_ARRIVED;
            $message = "⚓ Kapal {$vesselName} telah tiba dan bersandar di {$destPortName}. Proses bongkar muatan dapat segera dimulai.";
        } else {
            return null;
        }

        foreach ($admins as $admin) {
            Notification::create([
                'user_id' => $admin->id,
                'trip_id' => null,
                'type' => $notificationType,
                'message' => $message,
                'is_read' => false,
            ]);
        }

        return $notificationType;
    }
}
