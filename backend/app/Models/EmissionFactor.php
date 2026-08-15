<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmissionFactor extends Model
{
    protected $fillable = [
        'truck_category',
        'age_min_year',
        'age_max_year',
        'factor_kg_per_km',
    ];

    public static function getFactorForTruck(Truck $truck): float
    {
        $age = max(0, now()->year - $truck->year);

        $brandLower = strtolower($truck->brand . ' ' . ($truck->model ?? ''));
        if (str_contains($brandLower, 'light') || str_contains($brandLower, 'dutro') || str_contains($brandLower, 'canter') || str_contains($brandLower, 'elf')) {
            $category = 'light';
        } elseif (str_contains($brandLower, 'heavy') || str_contains($brandLower, 'giga') || str_contains($brandLower, 'fighter') || str_contains($brandLower, 'tronton')) {
            $category = 'heavy';
        } else {
            $category = 'medium';
        }

        $factor = static::where('truck_category', $category)
            ->where('age_min_year', '<=', $age)
            ->where(function ($q) use ($age) {
                $q->whereNull('age_max_year')
                  ->orWhere('age_max_year', '>=', $age);
            })
            ->value('factor_kg_per_km');

        if ($factor !== null) {
            return (float) $factor;
        }

        $fallback = static::where('age_min_year', '<=', $age)
            ->where(function ($q) use ($age) {
                $q->whereNull('age_max_year')
                  ->orWhere('age_max_year', '>=', $age);
            })
            ->value('factor_kg_per_km');

        return $fallback !== null ? (float) $fallback : 0.5500;
    }

    public static function calculateCo2(Truck $truck, ?float $distanceKm): ?float
    {
        if ($distanceKm === null || $distanceKm <= 0) {
            return null;
        }

        $factor = static::getFactorForTruck($truck);
        return round($distanceKm * $factor, 2);
    }
}
