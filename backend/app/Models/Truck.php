<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Truck extends Model
{
    protected $fillable = [
        'plate_number',
        'brand',
        'model',
        'year',
        'fuel_type',
        'status',
    ];
}
