<?php

namespace Tests\Feature;

use App\Models\EmissionFactor;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EmissionFactorApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        User::create([
            'name' => 'Admin User',
            'username' => 'admin',
            'password' => bcrypt('password'),
            'role' => 'admin',
        ]);
    }

    public function test_can_get_emission_factors_list(): void
    {
        EmissionFactor::create([
            'truck_category' => 'medium',
            'age_min_year' => 0,
            'age_max_year' => 5,
            'factor_kg_per_km' => 0.5500,
        ]);

        $response = $this->getJson('/api/emission-factors');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    '*' => ['id', 'truck_category', 'age_min_year', 'age_max_year', 'factor_kg_per_km', 'created_at', 'updated_at'],
                ],
                'meta' => ['current_page', 'total', 'per_page'],
            ]);
    }

    public function test_can_filter_emission_factors_by_category(): void
    {
        EmissionFactor::create([
            'truck_category' => 'light',
            'age_min_year' => 0,
            'age_max_year' => 5,
            'factor_kg_per_km' => 0.2500,
        ]);

        EmissionFactor::create([
            'truck_category' => 'heavy',
            'age_min_year' => 0,
            'age_max_year' => 5,
            'factor_kg_per_km' => 0.8500,
        ]);

        $response = $this->getJson('/api/emission-factors?truck_category=heavy');

        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data'));
        $this->assertEquals('heavy', $response->json('data.0.truck_category'));
        $this->assertEquals(0.85, $response->json('data.0.factor_kg_per_km'));
    }

    public function test_can_show_emission_factor_details(): void
    {
        $factor = EmissionFactor::create([
            'truck_category' => 'medium',
            'age_min_year' => 6,
            'age_max_year' => 10,
            'factor_kg_per_km' => 0.6500,
        ]);

        $response = $this->getJson("/api/emission-factors/{$factor->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $factor->id,
                    'truck_category' => 'medium',
                    'factor_kg_per_km' => 0.65,
                ],
            ]);
    }
}
