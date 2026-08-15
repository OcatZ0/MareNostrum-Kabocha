<?php

namespace Database\Seeders;

use App\Context\Country;
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
                'country' => Country::INDONESIA,
                'unlocode' => 'IDBUR',
                'latitude' => 1.16713,
                'longitude' => 103.99680,
            ]
        );

        Port::updateOrCreate(
            ['name' => 'Batam Centre Ferry Terminal'],
            [
                'country' => Country::INDONESIA,
                'unlocode' => 'IDBTH',
                'latitude' => 1.130856,
                'longitude' => 104.055225,
            ]
        );

        Port::updateOrCreate(
            ['name' => 'Sekupang Port'],
            [
                'country' => Country::INDONESIA,
                'unlocode' => 'IDSKP',
                'latitude' => 1.08,
                'longitude' => 103.90,
            ]
        );

        // Singapore side.
        Port::updateOrCreate(
            ['name' => 'Port of Singapore (PSA)'],
            [
                'country' => Country::SINGAPORE,
                'unlocode' => 'SGSIN',
                'latitude' => 1.2650,
                'longitude' => 103.8200,
            ]
        );

        Port::updateOrCreate(
            ['name' => 'Jurong Port'],
            [
                'country' => Country::SINGAPORE,
                'unlocode' => 'SGJUR',
                'latitude' => 1.28,
                'longitude' => 103.73,
            ]
        );

        Port::updateOrCreate(
            ['name' => 'Tuas Port'],
            [
                'country' => Country::SINGAPORE,
                'unlocode' => 'SGTUA',
                'latitude' => 1.3167,
                'longitude' => 103.65,
            ]
        );

        Port::updateOrCreate(
            ['name' => 'Sembawang Wharves'],
            [
                'country' => Country::SINGAPORE,
                'unlocode' => 'SGSEM',
                'latitude' => 1.4625,
                'longitude' => 103.83639,
            ]
        );
    }
}
