<?php

namespace Database\Seeders;

use App\Models\Company;
use Illuminate\Database\Seeder;

class CompanySeeder extends Seeder
{
    public function run(): void
    {
        Company::updateOrCreate(
            ['name' => 'Batamindo Industrial Park'],
            [
                'type' => 'internal',
                'city' => 'Batam',
                'address' => 'Batamindo Industrial Park, Mukakuning, Batam',
                'latitude' => 1.065171,
                'longitude' => 104.028693,
            ]
        );

        Company::updateOrCreate(
            ['name' => 'Kawasan Bintang Industri 2'],
            [
                'type' => 'partner',
                'city' => 'Batam',
                'address' => 'Kawasan Bintang Industri 2, Batam',
                'latitude' => 1.058993,
                'longitude' => 103.925484,
            ]
        );

        Company::updateOrCreate(
            ['name' => 'Panbil Industrial Park'],
            [
                'type' => 'partner',
                'city' => 'Batam',
                'address' => 'Panbil Industrial Park, Batam',
                'latitude' => 1.070307,
                'longitude' => 104.020694,
            ]
        );

        Company::updateOrCreate(
            ['name' => 'Executive Industrial Park'],
            [
                'type' => 'partner',
                'city' => 'Batam',
                'address' => 'Executive Industrial Park, Batam',
                'latitude' => 1.113038,
                'longitude' => 104.060832,
            ]
        );

        // Singapore-side partners. Coordinates are district/estate-level (from public
        // sources), not surveyed exact addresses — good enough for route planning demo
        // purposes, verify before relying on for anything precision-sensitive.
        Company::updateOrCreate(
            ['name' => 'Tuas Industrial Estate'],
            [
                'type' => 'partner',
                'city' => 'Singapura',
                'address' => 'Tuas Industrial Estate, Singapore',
                'latitude' => 1.294947,
                'longitude' => 103.630483,
            ]
        );

        Company::updateOrCreate(
            ['name' => 'Jurong Industrial Estate'],
            [
                'type' => 'partner',
                'city' => 'Singapura',
                'address' => 'Jurong Industrial Estate, Singapore',
                'latitude' => 1.3175,
                'longitude' => 103.69,
            ]
        );

        Company::updateOrCreate(
            ['name' => 'Tampines Industrial Park'],
            [
                'type' => 'partner',
                'city' => 'Singapura',
                'address' => 'Tampines Industrial Park, Singapore',
                'latitude' => 1.3547,
                'longitude' => 103.9437,
            ]
        );
    }
}
