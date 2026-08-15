<?php

namespace Database\Seeders;

use App\Models\Port;
use Illuminate\Database\Seeder;

class PortSeeder extends Seeder
{
    public function run(): void
    {
        // Batam (Indonesia) side.
        Port::updateOrCreate(
            ['name' => 'Batu Ampar Port'],
            [
                'country' => 'indonesia',
                'unlocode' => 'IDBUR',
                'latitude' => 1.16713,
                'longitude' => 103.99680,
            ]
        );

        Port::updateOrCreate(
            ['name' => 'Batam Centre Ferry Terminal'],
            [
                'country' => 'indonesia',
                'unlocode' => 'IDBTH',
                'latitude' => 1.130856,
                'longitude' => 104.055225,
            ]
        );

        Port::updateOrCreate(
            ['name' => 'Sekupang Port'],
            [
                'country' => 'indonesia',
                'unlocode' => 'IDSKP',
                'latitude' => 1.08,
                'longitude' => 103.90,
            ]
        );

        // Singapore side.
        Port::updateOrCreate(
            ['name' => 'Port of Singapore (PSA)'],
            [
                'country' => 'singapore',
                'unlocode' => 'SGSIN',
                'latitude' => 1.2650,
                'longitude' => 103.8200,
            ]
        );

        Port::updateOrCreate(
            ['name' => 'Jurong Port'],
            [
                'country' => 'singapore',
                'unlocode' => 'SGJUR',
                'latitude' => 1.28,
                'longitude' => 103.73,
            ]
        );

        Port::updateOrCreate(
            ['name' => 'Tuas Port'],
            [
                'country' => 'singapore',
                'unlocode' => 'SGTUA',
                'latitude' => 1.3167,
                'longitude' => 103.65,
            ]
        );

        Port::updateOrCreate(
            ['name' => 'Sembawang Wharves'],
            [
                'country' => 'singapore',
                'unlocode' => 'SGSEM',
                'latitude' => 1.4625,
                'longitude' => 103.83639,
            ]
        );
    }
}
