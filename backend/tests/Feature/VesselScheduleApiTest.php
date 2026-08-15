<?php

namespace Tests\Feature;

use App\Context\NotificationType;
use App\Context\Role;
use App\Context\VesselScheduleStatus;
use App\Models\Notification;
use App\Models\Port;
use App\Models\User;
use App\Models\VesselSchedule;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class VesselScheduleApiTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected Port $originPort;
    protected Port $destinationPort;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'role' => Role::ADMIN,
        ]);

        $this->originPort = Port::create([
            'name' => 'Batu Ampar Port',
            'country' => 'indonesia',
            'unlocode' => 'IDBUR',
            'latitude' => 1.16713,
            'longitude' => 103.99680,
        ]);

        $this->destinationPort = Port::create([
            'name' => 'Port of Singapore (PSA)',
            'country' => 'singapore',
            'unlocode' => 'SGSIN',
            'latitude' => 1.2650,
            'longitude' => 103.8200,
        ]);
    }

    public function test_can_get_paginated_vessel_schedules_list(): void
    {
        VesselSchedule::create([
            'vessel_name' => 'Batam Fast 18',
            'ship_ref_id' => '563123456',
            'voyage_number' => 'BF-01',
            'origin_port_id' => $this->originPort->id,
            'destination_port_id' => $this->destinationPort->id,
            'scheduled_departure_at' => Carbon::now()->addHours(1),
            'scheduled_arrival_at' => Carbon::now()->addHours(3),
            'status' => VesselScheduleStatus::SCHEDULED,
        ]);

        $response = $this->actingAs($this->admin)->getJson('/api/vessel-schedules');

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.vessel_name', 'Batam Fast 18');
    }

    public function test_can_create_vessel_schedule(): void
    {
        $payload = [
            'vessel_name' => 'Majestic 7',
            'ship_ref_id' => '563987654',
            'voyage_number' => 'MJ-104',
            'origin_port_id' => $this->originPort->id,
            'destination_port_id' => $this->destinationPort->id,
            'scheduled_departure_at' => Carbon::now()->addHours(2)->toISOString(),
            'scheduled_arrival_at' => Carbon::now()->addHours(4)->toISOString(),
            'tolerance_minutes' => 20,
            'notes' => 'Container batch A',
        ];

        $response = $this->actingAs($this->admin)->postJson('/api/vessel-schedules', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.vessel_name', 'Majestic 7')
            ->assertJsonPath('data.ship_ref_id', '563987654');

        $this->assertDatabaseHas('vessel_schedules', [
            'vessel_name' => 'Majestic 7',
            'ship_ref_id' => '563987654',
        ]);
    }

    public function test_can_update_and_delete_vessel_schedule(): void
    {
        $schedule = VesselSchedule::create([
            'vessel_name' => 'Asian Fast 1',
            'ship_ref_id' => '563000111',
            'origin_port_id' => $this->originPort->id,
            'destination_port_id' => $this->destinationPort->id,
            'scheduled_departure_at' => Carbon::now()->addHours(1),
            'scheduled_arrival_at' => Carbon::now()->addHours(3),
            'status' => VesselScheduleStatus::SCHEDULED,
        ]);

        $updateResponse = $this->actingAs($this->admin)->putJson("/api/vessel-schedules/{$schedule->id}", [
            'vessel_name' => 'Asian Fast 1 Updated',
            'status' => VesselScheduleStatus::DEPARTED,
        ]);

        $updateResponse->assertStatus(200)
            ->assertJsonPath('data.vessel_name', 'Asian Fast 1 Updated')
            ->assertJsonPath('data.status', VesselScheduleStatus::DEPARTED);

        $deleteResponse = $this->actingAs($this->admin)->deleteJson("/api/vessel-schedules/{$schedule->id}");
        $deleteResponse->assertStatus(200);

        $this->assertDatabaseMissing('vessel_schedules', ['id' => $schedule->id]);
    }

    public function test_check_status_triggers_delay_notification_when_exceeding_tolerance(): void
    {
        $now = Carbon::now();

        $schedule = VesselSchedule::create([
            'vessel_name' => 'Samudera 8',
            'ship_ref_id' => '563223344',
            'origin_port_id' => $this->originPort->id,
            'destination_port_id' => $this->destinationPort->id,
            'scheduled_departure_at' => $now->copy()->subHours(2),
            'scheduled_arrival_at' => $now->copy()->subMinutes(10), // Was supposed to arrive 10 mins ago
            'tolerance_minutes' => 20,
            'status' => VesselScheduleStatus::DEPARTED,
        ]);

        // Kapal masih 15 km dari pelabuhan, kecepatan 8 knot -> butuh waktu ~1 jam lagi
        $response = $this->actingAs($this->admin)->postJson("/api/vessel-schedules/{$schedule->id}/check-status", [
            'latitude' => 1.1800,
            'longitude' => 103.9500,
            'speed_knots' => 8.0,
            'notify' => true,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.analysis.is_delayed', true)
            ->assertJsonPath('data.analysis.notification_sent', true)
            ->assertJsonPath('data.analysis.notification_type', NotificationType::VESSEL_DELAY_WARNING);

        $this->assertDatabaseHas('notifications', [
            'user_id' => $this->admin->id,
            'type' => NotificationType::VESSEL_DELAY_WARNING,
        ]);
    }

    public function test_check_status_triggers_early_arrival_notification_when_arriving_too_fast(): void
    {
        $now = Carbon::now();

        $schedule = VesselSchedule::create([
            'vessel_name' => 'Speed Runner 1',
            'ship_ref_id' => '563998877',
            'origin_port_id' => $this->originPort->id,
            'destination_port_id' => $this->destinationPort->id,
            'scheduled_departure_at' => $now->copy()->subMinutes(30),
            'scheduled_arrival_at' => $now->copy()->addHours(2), // Scheduled 2 hours later
            'tolerance_minutes' => 25,
            'status' => VesselScheduleStatus::DEPARTED,
        ]);

        // Kapal melaju 25 knot dan sudah sangat dekat (3 km), estimasi tiba 5 menit lagi (jauh lebih cepat dari 2 jam)
        $response = $this->actingAs($this->admin)->postJson("/api/vessel-schedules/{$schedule->id}/check-status", [
            'latitude' => 1.2500,
            'longitude' => 103.8300,
            'speed_knots' => 25.0,
            'notify' => true,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.analysis.is_early', true)
            ->assertJsonPath('data.analysis.notification_sent', true)
            ->assertJsonPath('data.analysis.notification_type', NotificationType::VESSEL_EARLY_ALERT);

        $this->assertDatabaseHas('notifications', [
            'user_id' => $this->admin->id,
            'type' => NotificationType::VESSEL_EARLY_ALERT,
        ]);
    }

    public function test_can_import_vessel_schedules_from_csv_file(): void
    {
        $csvContent = "vessel_name,ship_ref_id,voyage_number,origin_port,destination_port,scheduled_departure_at,scheduled_arrival_at,tolerance_minutes,notes\n" .
                      "Cargo Pioneer,563771122,CP-101,Batu Ampar Port,Port of Singapore (PSA),2026-08-20 08:00:00,2026-08-20 10:00:00,30,Imported via test\n";

        $file = UploadedFile::fake()->createWithContent('schedules.csv', $csvContent);

        $response = $this->actingAs($this->admin)->postJson('/api/vessel-schedules/import', [
            'file' => $file,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.imported_count', 1);

        $this->assertDatabaseHas('vessel_schedules', [
            'vessel_name' => 'Cargo Pioneer',
            'ship_ref_id' => '563771122',
        ]);
    }
}
