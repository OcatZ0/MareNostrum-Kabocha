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
}
