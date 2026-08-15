<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\Trip;
use App\Models\Truck;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TruckApiTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::create([
            'name' => 'Admin Test',
            'username' => 'admin',
            'password' => bcrypt('password'),
            'role' => 'admin',
        ]);
    }

    public function test_can_get_paginated_trucks_list(): void
    {
        Truck::create([
            'plate_number' => 'BP 1001 XY',
            'brand' => 'Hino',
            'model' => 'Dutro 110 SD',
            'year' => 2023,
            'fuel_type' => 'diesel',
            'status' => 'active',
        ]);

        $response = $this->getJson('/api/trucks');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    '*' => ['id', 'plate_number', 'brand', 'model', 'year', 'age_years', 'fuel_type', 'status', 'created_at', 'updated_at'],
                ],
                'meta' => ['current_page', 'total', 'per_page'],
            ]);
    }

    public function test_can_filter_trucks_by_status_fuel_type_and_search(): void
    {
        Truck::create([
            'plate_number' => 'BP 1001 XY',
            'brand' => 'Hino',
            'model' => 'Dutro 110 SD',
            'year' => 2023,
            'fuel_type' => 'diesel',
            'status' => 'active',
        ]);

        Truck::create([
            'plate_number' => 'BP 2002 AB',
            'brand' => 'Isuzu',
            'model' => 'Elf',
            'year' => 2021,
            'fuel_type' => 'electric',
            'status' => 'maintenance',
        ]);

        // Filter by status
        $resStatus = $this->getJson('/api/trucks?status=maintenance');
        $resStatus->assertStatus(200);
        $this->assertCount(1, $resStatus->json('data'));
        $this->assertEquals('BP 2002 AB', $resStatus->json('data.0.plate_number'));

        // Filter by fuel_type
        $resFuel = $this->getJson('/api/trucks?fuel_type=diesel');
        $resFuel->assertStatus(200);
        $this->assertCount(1, $resFuel->json('data'));
        $this->assertEquals('Hino', $resFuel->json('data.0.brand'));

        // Search by keyword
        $resSearch = $this->getJson('/api/trucks?search=Isuzu');
        $resSearch->assertStatus(200);
        $this->assertCount(1, $resSearch->json('data'));
        $this->assertEquals('Elf', $resSearch->json('data.0.model'));
    }

    public function test_can_create_new_truck(): void
    {
        $payload = [
            'plate_number' => 'BP 9999 NEW',
            'brand' => 'Mitsubishi Fuso',
            'model' => 'Fighter FN 527',
            'year' => 2022,
            'fuel_type' => 'diesel',
            'status' => 'active',
        ];

        $response = $this->postJson('/api/trucks', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Truck created successfully.',
                'data' => [
                    'plate_number' => 'BP 9999 NEW',
                    'brand' => 'Mitsubishi Fuso',
                    'fuel_type' => 'diesel',
                ],
            ]);

        $this->assertDatabaseHas('trucks', [
            'plate_number' => 'BP 9999 NEW',
        ]);
    }

    public function test_create_truck_fails_on_duplicate_plate_and_invalid_fields(): void
    {
        Truck::create([
            'plate_number' => 'BP 1001 EX',
            'brand' => 'Hino',
            'year' => 2020,
            'fuel_type' => 'diesel',
        ]);

        $payload = [
            'plate_number' => 'BP 1001 EX', // Duplicate
            'brand' => '', // Empty
            'year' => 1800, // Out of range
            'fuel_type' => 'invalid_fuel',
        ];

        $response = $this->postJson('/api/trucks', $payload);

        $response->assertStatus(422)
            ->assertJsonStructure([
                'message',
                'errors' => ['plate_number', 'brand', 'year', 'fuel_type'],
            ]);
    }

    public function test_can_show_truck_details(): void
    {
        $truck = Truck::create([
            'plate_number' => 'BP 3333 SHOW',
            'brand' => 'Hino',
            'year' => 2022,
            'fuel_type' => 'diesel',
        ]);

        $response = $this->getJson("/api/trucks/{$truck->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $truck->id,
                    'plate_number' => 'BP 3333 SHOW',
                ],
            ]);
    }

    public function test_can_update_truck(): void
    {
        $truck = Truck::create([
            'plate_number' => 'BP 4444 OLD',
            'brand' => 'Hino',
            'year' => 2020,
            'fuel_type' => 'diesel',
            'status' => 'active',
        ]);

        $payload = [
            'plate_number' => 'BP 4444 UPDATED',
            'status' => 'maintenance',
        ];

        $response = $this->putJson("/api/trucks/{$truck->id}", $payload);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Truck updated successfully.',
                'data' => [
                    'id' => $truck->id,
                    'plate_number' => 'BP 4444 UPDATED',
                    'status' => 'maintenance',
                ],
            ]);

        $this->assertDatabaseHas('trucks', [
            'id' => $truck->id,
            'plate_number' => 'BP 4444 UPDATED',
            'status' => 'maintenance',
        ]);
    }

    public function test_can_delete_truck(): void
    {
        $truck = Truck::create([
            'plate_number' => 'BP 5555 DEL',
            'brand' => 'Isuzu',
            'year' => 2019,
            'fuel_type' => 'diesel',
        ]);

        $response = $this->deleteJson("/api/trucks/{$truck->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Truck deleted successfully.',
            ]);

        $this->assertDatabaseMissing('trucks', [
            'id' => $truck->id,
        ]);
    }

    public function test_cannot_delete_truck_referenced_in_trips(): void
    {
        $truck = Truck::create([
            'plate_number' => 'BP 6666 BUSY',
            'brand' => 'Hino',
            'year' => 2021,
            'fuel_type' => 'diesel',
        ]);

        $company = Company::create([
            'name' => 'Test Company',
            'type' => 'internal',
            'city' => 'Batam',
            'latitude' => 1.1,
            'longitude' => 104.0,
        ]);

        Trip::create([
            'origin_company_id' => $company->id,
            'truck_id' => $truck->id,
            'status' => 'assigned',
            'created_by' => $this->admin->id,
        ]);

        $response = $this->deleteJson("/api/trucks/{$truck->id}");

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Cannot delete truck referenced in trip history.',
            ]);

        $this->assertDatabaseHas('trucks', [
            'id' => $truck->id,
        ]);
    }

    public function test_can_get_truck_emissions_analytics(): void
    {
        $truck = Truck::create([
            'plate_number' => 'BP 7777 CO2',
            'brand' => 'Hino',
            'year' => 2022,
            'fuel_type' => 'diesel',
        ]);

        $company = Company::create([
            'name' => 'Emissions Origin',
            'type' => 'internal',
            'city' => 'Batam',
            'latitude' => 1.1,
            'longitude' => 104.0,
        ]);

        Trip::create([
            'origin_company_id' => $company->id,
            'truck_id' => $truck->id,
            'status' => 'completed',
            'distance_km' => 20.0,
            'estimated_co2_kg' => 5.0,
            'created_by' => $this->admin->id,
        ]);

        $response = $this->getJson("/api/trucks/{$truck->id}/emissions");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'truck' => ['id', 'plate_number'],
                    'emission_factor_kg_per_km',
                    'summary' => ['total_trips', 'total_distance_km', 'total_co2_kg', 'average_co2_per_trip_kg'],
                    'trips',
                ],
            ])
            ->assertJson([
                'success' => true,
                'data' => [
                    'summary' => [
                        'total_trips' => 1,
                        'total_distance_km' => 20.0,
                        'total_co2_kg' => 5.0,
                    ],
                ],
            ]);
    }
}
