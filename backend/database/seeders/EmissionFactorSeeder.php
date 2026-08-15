<?php

namespace Database\Seeders;

use App\Models\EmissionFactor;
use Illuminate\Database\Seeder;

class EmissionFactorSeeder extends Seeder
{
    /**
     * Illustrative reference values (PRD Bagian 6.2/17) — not sourced from an
     * official emissions registry. Newer truck = lower factor, larger
     * category = higher factor, loosely mirroring the Euro 3/4/5/6 trend.
     * Replace with real figures if the demo needs to defend the numbers.
     */
    public function run(): void
    {
        $factors = [
            ['truck_category' => 'light', 'age_min_year' => 0, 'age_max_year' => 5, 'factor_kg_per_km' => 0.2500],
            ['truck_category' => 'light', 'age_min_year' => 6, 'age_max_year' => 10, 'factor_kg_per_km' => 0.3000],
            ['truck_category' => 'light', 'age_min_year' => 11, 'age_max_year' => null, 'factor_kg_per_km' => 0.3500],

            ['truck_category' => 'medium', 'age_min_year' => 0, 'age_max_year' => 5, 'factor_kg_per_km' => 0.5500],
            ['truck_category' => 'medium', 'age_min_year' => 6, 'age_max_year' => 10, 'factor_kg_per_km' => 0.6500],
            ['truck_category' => 'medium', 'age_min_year' => 11, 'age_max_year' => null, 'factor_kg_per_km' => 0.7500],

            ['truck_category' => 'heavy', 'age_min_year' => 0, 'age_max_year' => 5, 'factor_kg_per_km' => 0.8500],
            ['truck_category' => 'heavy', 'age_min_year' => 6, 'age_max_year' => 10, 'factor_kg_per_km' => 1.0000],
            ['truck_category' => 'heavy', 'age_min_year' => 11, 'age_max_year' => null, 'factor_kg_per_km' => 1.2000],
        ];

        foreach ($factors as $factor) {
            EmissionFactor::updateOrCreate(
                [
                    'truck_category' => $factor['truck_category'],
                    'age_min_year' => $factor['age_min_year'],
                ],
                $factor
            );
        }
    }
}
