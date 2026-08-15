<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\Trip;
use App\Models\Truck;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AnalyticsApiTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected Company $company;
    protected Truck $truck;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::create([
            'name' => 'Admin Test',
            'username' => 'admin',
            'password' => bcrypt('password'),
            'role' => 'admin',
        ]);

        $this->company = Company::create([
            'name' => 'Company A',
            'type' => 'internal',
            'city' => 'Batam',
            'latitude' => 1.123,
            'longitude' => 104.012,
        ]);

        $this->truck = Truck::create([
            'plate_number' => 'BP 1111 AN',
            'brand' => 'Hino',
            'year' => 2022,
            'fuel_type' => 'diesel',
        ]);
    }

    public function test_can_get_dashboard_analytics_summary(): void
    {
        Trip::create([
            'origin_company_id' => $this->company->id,
            'truck_id' => $this->truck->id,
            'status' => 'completed',
            'distance_km' => 30.5,
            'estimated_co2_kg' => 7.6,
            'estimated_duration_min' => 45,
            'actual_departure_at' => Carbon::now()->subHour(),
            'actual_arrival_at' => Carbon::now()->subMinutes(15),
            'created_by' => $this->admin->id,
        ]);

        $response = $this->getJson('/api/analytics/dashboard');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'period',
                    'summary' => [
                        'total_trips',
                        'completed_trips',
                        'in_transit_trips',
                        'assigned_trips',
                        'draft_trips',
                        'cancelled_trips',
                        'total_distance_km',
                        'total_co2_kg',
                        'average_delay_minutes',
                        'recommendation_accuracy_percentage',
                    ],
                    'emissions_by_truck_category',
                    'top_emitting_trucks',
                    'recent_trips',
                ],
            ])
            ->assertJson([
                'success' => true,
                'data' => [
                    'summary' => [
                        'total_trips' => 1,
                        'completed_trips' => 1,
                        'total_distance_km' => 30.5,
                        'total_co2_kg' => 7.6,
                    ],
                ],
            ]);
    }

    public function test_can_get_detailed_trip_analytics_list(): void
    {
        Trip::create([
            'origin_company_id' => $this->company->id,
            'truck_id' => $this->truck->id,
            'status' => 'completed',
            'distance_km' => 25.0,
            'estimated_co2_kg' => 6.25,
            'estimated_duration_min' => 30,
            'actual_departure_at' => Carbon::now()->subMinutes(40),
            'actual_arrival_at' => Carbon::now()->subMinutes(5),
            'created_by' => $this->admin->id,
        ]);

        $response = $this->getJson('/api/analytics/trips');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    '*' => [
                        'id',
                        'origin',
                        'destination',
                        'truck',
                        'driver',
                        'status',
                        'distance_km',
                        'estimated_co2_kg',
                        'estimated_duration_min',
                        'actual_duration_min',
                        'delay_minutes',
                        'is_delayed',
                        'chosen_departure_at',
                        'actual_departure_at',
                        'actual_arrival_at',
                        'created_at',
                    ],
                ],
                'meta' => ['current_page', 'total', 'per_page'],
            ]);
    }
}
