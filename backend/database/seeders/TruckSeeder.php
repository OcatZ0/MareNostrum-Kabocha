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

        // Electric truck — exercises the emissions calculator's low end and gives the
        // fleet filter something to actually filter for fuel_type=electric.
        Truck::updateOrCreate(
            ['plate_number' => 'BP 1004 XY'],
            [
                'brand' => 'BYD',
                'model' => 'T5',
                'year' => 2024,
                'fuel_type' => FuelType::ELECTRIC,
                'status' => Status::ACTIVE,
            ]
        );

        // Deliberately left unassigned to any demo trip (DemoTripSeeder) — a
        // maintenance-status truck should look genuinely out of service, not just
        // labeled that way while still hauling cargo.
        Truck::updateOrCreate(
            ['plate_number' => 'BP 1005 XY'],
            [
                'brand' => 'Hino',
                'model' => 'Dutro 130 HD',
                'year' => 2020,
                'fuel_type' => FuelType::DIESEL,
                'status' => Status::MAINTENANCE,
            ]
        );
    }
}
