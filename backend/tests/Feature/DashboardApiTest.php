<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\Trip;
use App\Models\Truck;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardApiTest extends TestCase
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
            'username' => 'admin_dash',
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
            'plate_number' => 'BP 9999 DASH',
            'brand' => 'Hino',
            'year' => 2023,
            'fuel_type' => 'diesel',
            'status' => 'active',
        ]);

        Trip::create([
            'origin_company_id' => $this->company->id,
            'truck_id' => $this->truck->id,
            'status' => 'in_transit_origin',
            'distance_km' => 45.0,
            'estimated_co2_kg' => 11.2,
            'estimated_duration_min' => 60,
            'actual_departure_at' => Carbon::now()->subMinutes(20),
            'created_by' => $this->admin->id,
        ]);
    }

    public function test_can_get_primary_dashboard_data(): void
    {
        $response = $this->actingAs($this->admin)->getJson('/api/dashboard?section=primary');

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
                    'live_operations' => [
                        'active_trips',
                        'primary_trip',
                        'checkpoints',
                    ],
                    'recent_trips',
                    'unread_notifications',
                ],
            ])
            ->assertJson([
                'success' => true,
                'data' => [
                    'summary' => [
                        'total_trips' => 1,
                        'in_transit_trips' => 1,
                    ],
                ],
            ]);
    }

    public function test_can_get_secondary_dashboard_data(): void
    {
        $response = $this->actingAs($this->admin)->getJson('/api/dashboard?section=secondary');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'monthly_volume',
                    'emissions' => [
                        'total_co2_kg',
                        'category_breakdown',
                        'top_emitting_trucks',
                        'monthly_trend',
                    ],
                    'fleet' => [
                        'summary',
                        'trucks',
                    ],
                ],
            ])
            ->assertJson([
                'success' => true,
            ]);
    }

    public function test_can_get_unified_dashboard_data(): void
    {
        $response = $this->actingAs($this->admin)->getJson('/api/dashboard');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'period',
                    'summary',
                    'live_operations',
                    'recent_trips',
                    'unread_notifications',
                    'monthly_volume',
                    'emissions',
                    'fleet',
                ],
            ]);
    }
}
