<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Trip extends Model
{
    protected $fillable = [
        'origin_company_id',
        'origin_port_id',
        'destination_company_id',
        'destination_port_id',
        'ship_destination_port_id',
        'truck_id',
        'driver_id',
        'ship_ref_id',
        'recommended_slots',
        'chosen_departure_at',
        'status',
        'distance_km',
        'estimated_co2_kg',
        'estimated_duration_min',
        'actual_departure_at',
        'actual_arrival_at',
        'truck_returned_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'recommended_slots' => 'array',
            'chosen_departure_at' => 'datetime',
            'actual_departure_at' => 'datetime',
            'actual_arrival_at' => 'datetime',
            'truck_returned_at' => 'datetime',
        ];
    }

    public function originCompany(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'origin_company_id');
    }

    public function originPort(): BelongsTo
    {
        return $this->belongsTo(Port::class, 'origin_port_id');
    }

    public function destinationCompany(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'destination_company_id');
    }

    public function destinationPort(): BelongsTo
    {
        return $this->belongsTo(Port::class, 'destination_port_id');
    }

    public function shipDestinationPort(): BelongsTo
    {
        return $this->belongsTo(Port::class, 'ship_destination_port_id');
    }

    public function truck(): BelongsTo
    {
        return $this->belongsTo(Truck::class);
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'driver_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function checkpoints(): HasMany
    {
        return $this->hasMany(TripCheckpoint::class);
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    }
}
