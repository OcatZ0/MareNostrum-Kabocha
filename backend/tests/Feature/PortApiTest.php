<?php

namespace Tests\Feature;

use App\Context\Country;
use App\Context\Role;
use App\Context\StatusTrips;
use App\Models\Port;
use App\Models\Trip;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PortApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Seed admin user for BypassAuthForTesting middleware
        User::create([
            'name' => 'Admin User',
            'username' => 'admin',
            'password' => bcrypt('password'),
            'role' => Role::ADMIN,
        ]);
    }

    public function test_can_get_paginated_ports_list(): void
    {
        Port::create([
            'name' => 'Batam Centre Ferry Terminal',
            'country' => Country::INDONESIA,
            'unlocode' => 'IDBTH',
            'latitude' => 1.1312345,
            'longitude' => 104.0532145,
        ]);

        $response = $this->getJson('/api/ports');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    '*' => ['id', 'name', 'country', 'unlocode', 'latitude', 'longitude', 'created_at', 'updated_at'],
                ],
                'meta' => ['current_page', 'total', 'per_page'],
            ]);
    }

    public function test_can_filter_ports_by_country_and_search(): void
    {
        Port::create([
            'name' => 'Batam Centre Ferry Terminal',
            'country' => Country::INDONESIA,
            'unlocode' => 'IDBTH',
            'latitude' => 1.131,
            'longitude' => 104.053,
        ]);

        Port::create([
            'name' => 'HarbourFront Centre',
            'country' => Country::SINGAPORE,
            'unlocode' => 'SGSIN',
            'latitude' => 1.265,
            'longitude' => 103.821,
        ]);

        // Filter by country
        $responseCountry = $this->getJson('/api/ports?country='.Country::INDONESIA);
        $responseCountry->assertStatus(200);
        $this->assertCount(1, $responseCountry->json('data'));
        $this->assertEquals(Country::INDONESIA, $responseCountry->json('data.0.country'));

        // Search by unlocode
        $responseSearch = $this->getJson('/api/ports?search=IDBTH');
        $responseSearch->assertStatus(200);
        $this->assertCount(1, $responseSearch->json('data'));
        $this->assertEquals('IDBTH', $responseSearch->json('data.0.unlocode'));
    }

    public function test_can_create_new_port(): void
    {
        $payload = [
            'name' => 'Sekupang International Ferry Terminal',
            'country' => Country::INDONESIA,
            'unlocode' => 'idskp', // lowercase should be normalized to uppercase IDSKP
            'latitude' => 1.1270000,
            'longitude' => 103.9210000,
        ];

        $response = $this->postJson('/api/ports', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Port created successfully.',
                'data' => [
                    'name' => 'Sekupang International Ferry Terminal',
                    'country' => Country::INDONESIA,
                    'unlocode' => 'IDSKP',
                ],
            ]);

        $this->assertDatabaseHas('ports', [
            'name' => 'Sekupang International Ferry Terminal',
            'unlocode' => 'IDSKP',
        ]);
    }

    public function test_create_port_fails_on_invalid_data(): void
    {
        $payload = [
            'name' => '', // Empty name
            'country' => 'invalid_country', // Invalid enum
            'unlocode' => 'TOO_LONG_CODE', // Exceeds 5 chars
            'latitude' => 999.0, // Out of range lat
            'longitude' => 104.0,
        ];

        $response = $this->postJson('/api/ports', $payload);

        $response->assertStatus(422)
            ->assertJsonStructure([
                'message',
                'errors' => ['name', 'country', 'unlocode', 'latitude'],
            ]);
    }

    public function test_can_show_port_details(): void
    {
        $port = Port::create([
            'name' => 'Target Port',
            'country' => Country::INDONESIA,
            'unlocode' => 'IDTGT',
            'latitude' => 1.100,
            'longitude' => 104.000,
        ]);

        $response = $this->getJson("/api/ports/{$port->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $port->id,
                    'name' => 'Target Port',
                    'unlocode' => 'IDTGT',
                ],
            ]);
    }

    public function test_can_update_port(): void
    {
        $port = Port::create([
            'name' => 'Old Port Name',
            'country' => Country::INDONESIA,
            'unlocode' => 'IDOLD',
            'latitude' => 1.100,
            'longitude' => 104.000,
        ]);

        $payload = [
            'name' => 'Updated Port Name',
            'unlocode' => 'idnew',
        ];

        $response = $this->putJson("/api/ports/{$port->id}", $payload);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $port->id,
                    'name' => 'Updated Port Name',
                    'unlocode' => 'IDNEW',
                ],
            ]);

        $this->assertDatabaseHas('ports', [
            'id' => $port->id,
            'name' => 'Updated Port Name',
            'unlocode' => 'IDNEW',
        ]);
    }

    public function test_can_delete_port(): void
    {
        $port = Port::create([
            'name' => 'Port To Delete',
            'country' => Country::INDONESIA,
            'unlocode' => 'IDDEL',
            'latitude' => 1.100,
            'longitude' => 104.000,
        ]);

        $response = $this->deleteJson("/api/ports/{$port->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Port deleted successfully.',
            ]);

        $this->assertDatabaseMissing('ports', [
            'id' => $port->id,
        ]);
    }

    public function test_cannot_delete_port_referenced_in_trips(): void
    {
        $port = Port::create([
            'name' => 'Active Cross-Border Port',
            'country' => Country::INDONESIA,
            'unlocode' => 'IDACT',
            'latitude' => 1.100,
            'longitude' => 104.000,
        ]);

        $admin = User::first();

        // Create a trip referencing this port as destination_port_id
        Trip::create([
            'origin_company_id' => null,
            'origin_port_id' => null,
            'destination_company_id' => null,
            'destination_port_id' => $port->id,
            'status' => StatusTrips::DRAFT,
            'created_by' => $admin->id,
        ]);

        $response = $this->deleteJson("/api/ports/{$port->id}");

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Cannot delete port referenced in trips.',
            ]);

        $this->assertDatabaseHas('ports', [
            'id' => $port->id,
        ]);
    }
}
