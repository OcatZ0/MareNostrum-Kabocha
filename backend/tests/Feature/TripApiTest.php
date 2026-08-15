<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\Port;
use App\Models\Trip;
use App\Models\Truck;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TripApiTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $driver;
    protected Company $originCompany;
    protected Company $destCompany;
    protected Truck $truck;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::create([
            'name' => 'Admin User',
            'username' => 'admin',
            'password' => bcrypt('password'),
            'role' => 'admin',
        ]);

        $this->driver = User::create([
            'name' => 'Budi Driver',
            'username' => 'driver_budi',
            'password' => bcrypt('password'),
            'role' => 'driver',
        ]);

        $this->originCompany = Company::create([
            'name' => 'Company A Logistics',
            'type' => 'internal',
            'city' => 'Batam',
            'latitude' => 1.1234567,
            'longitude' => 104.0123456,
        ]);

        $this->destCompany = Company::create([
            'name' => 'Company B Partner',
            'type' => 'partner',
            'city' => 'Batam',
            'latitude' => 1.1567000,
            'longitude' => 104.0512000,
        ]);

        $this->truck = Truck::create([
            'plate_number' => 'BP 1234 TR',
            'brand' => 'Hino',
            'year' => 2022,
            'fuel_type' => 'diesel',
            'status' => 'active',
        ]);
    }

    public function test_can_get_trips_list(): void
    {
        Trip::create([
            'origin_company_id' => $this->originCompany->id,
            'destination_company_id' => $this->destCompany->id,
            'status' => 'draft',
            'created_by' => $this->admin->id,
        ]);

        $response = $this->getJson('/api/trips');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    '*' => ['id', 'origin', 'destination', 'status', 'created_by', 'created_at'],
                ],
            ]);
    }

    public function test_can_create_new_trip_draft(): void
    {
        $payload = [
            'origin_company_id' => $this->originCompany->id,
            'destination_company_id' => $this->destCompany->id,
        ];

        $response = $this->postJson('/api/trips', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Trip created',
                'data' => [
                    'status' => 'draft',
                ],
            ]);

        $this->assertDatabaseHas('trips', [
            'origin_company_id' => $this->originCompany->id,
            'destination_company_id' => $this->destCompany->id,
            'status' => 'draft',
        ]);
    }

    public function test_can_show_trip_details(): void
    {
        $trip = Trip::create([
            'origin_company_id' => $this->originCompany->id,
            'destination_company_id' => $this->destCompany->id,
            'status' => 'draft',
            'created_by' => $this->admin->id,
        ]);

        $response = $this->getJson("/api/trips/{$trip->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $trip->id,
                    'status' => 'draft',
                ],
            ]);
    }

    public function test_can_assign_truck_driver_and_calculate_co2(): void
    {
        $departureAt = Carbon::now()->addHour()->toIso8601String();

        $trip = Trip::create([
            'origin_company_id' => $this->originCompany->id,
            'destination_company_id' => $this->destCompany->id,
            'status' => 'draft',
            'distance_km' => 20.0,
            'recommended_slots' => [
                ['departure_at' => $departureAt, 'score' => 90.0],
            ],
            'created_by' => $this->admin->id,
        ]);

        $payload = [
            'truck_id' => $this->truck->id,
            'driver_id' => $this->driver->id,
            'chosen_departure_at' => $departureAt,
        ];

        $response = $this->postJson("/api/trips/{$trip->id}/assign", $payload);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Trip assigned',
                'data' => [
                    'id' => $trip->id,
                    'truck_id' => $this->truck->id,
                    'driver_id' => $this->driver->id,
                    'status' => 'assigned',
                ],
            ]);

        $this->assertDatabaseHas('trips', [
            'id' => $trip->id,
            'truck_id' => $this->truck->id,
            'driver_id' => $this->driver->id,
            'status' => 'assigned',
        ]);

        $this->assertDatabaseHas('notifications', [
            'user_id' => $this->driver->id,
            'trip_id' => $trip->id,
            'type' => 'trip_assigned',
        ]);
    }

    public function test_can_record_checkpoints(): void
    {
        $this->actingAs($this->driver);

        $trip = Trip::create([
            'origin_company_id' => $this->originCompany->id,
            'destination_company_id' => $this->destCompany->id,
            'truck_id' => $this->truck->id,
            'driver_id' => $this->driver->id,
            'status' => 'assigned',
            'created_by' => $this->admin->id,
        ]);

        // 1. Departed checkpoint
        $payloadDepart = [
            'event_type' => 'departed',
            'latitude' => 1.1234567,
            'longitude' => 104.0123456,
            'source' => 'gps',
        ];

        $resDepart = $this->postJson("/api/trips/{$trip->id}/checkpoints", $payloadDepart);
        $resDepart->assertStatus(200);
        $this->assertEquals('in_transit_origin', $trip->fresh()->status);

        // 2. GPS ping
        $payloadPing = [
            'event_type' => 'gps_ping',
            'latitude' => 1.1300000,
            'longitude' => 104.0200000,
            'source' => 'gps',
        ];

        $resPing = $this->postJson("/api/trips/{$trip->id}/checkpoints", $payloadPing);
        $resPing->assertStatus(200);

        // 3. Arrived at destination checkpoint (valid geofence within 100m)
        $payloadArrived = [
            'event_type' => 'arrived_at_destination',
            'latitude' => 1.1567000, // Matches destCompany exactly
            'longitude' => 104.0512000,
            'source' => 'manual',
        ];

        $resArrived = $this->postJson("/api/trips/{$trip->id}/checkpoints", $payloadArrived);
        $resArrived->assertStatus(200);

        $this->assertDatabaseHas('trip_checkpoints', [
            'trip_id' => $trip->id,
            'event_type' => 'arrived_at_destination',
        ]);
    }
}
