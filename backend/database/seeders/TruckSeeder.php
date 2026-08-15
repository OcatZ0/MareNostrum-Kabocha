<?php

namespace Database\Seeders;

use App\Context\FuelType;
use App\Context\Status;
use App\Models\Truck;
use Illuminate\Database\Seeder;

class TruckSeeder extends Seeder
{
    public function run(): void
    {
        Truck::updateOrCreate(
            ['plate_number' => 'BP 1001 XY'],
            [
                'brand' => 'Hino',
                'model' => 'Dutro 110 SD',
                'year' => 2023,
                'fuel_type' => FuelType::DIESEL,
                'status' => Status::ACTIVE,
            ]
        );

        Truck::updateOrCreate(
            ['plate_number' => 'BP 1002 XY'],
            [
                'brand' => 'Mitsubishi Fuso',
                'model' => 'Fighter FN 527',
                'year' => 2018,
                'fuel_type' => FuelType::DIESEL,
                'status' => Status::ACTIVE,
            ]
        );

        Truck::updateOrCreate(
            ['plate_number' => 'BP 1003 XY'],
            [
                'brand' => 'Isuzu',
                'model' => 'Giga FVM',
                'year' => 2012,
                'fuel_type' => FuelType::DIESEL,
                'status' => Status::ACTIVE,
            ]
        );
    }
}
