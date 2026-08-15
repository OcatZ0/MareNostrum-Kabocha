<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotificationApiTest extends TestCase
{
    use RefreshDatabase;

    protected User $driver;

    protected function setUp(): void
    {
        parent::setUp();

        $this->driver = User::create([
            'name' => 'Driver Test',
            'username' => 'driver1',
            'password' => bcrypt('password'),
            'role' => 'driver',
        ]);
    }

    public function test_can_get_notifications_list(): void
    {
        Notification::create([
            'user_id' => $this->driver->id,
            'type' => 'trip_assigned',
            'message' => 'Anda ditugaskan pada trip #1',
            'is_read' => false,
        ]);

        $response = $this->getJson("/api/notifications?user_id={$this->driver->id}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'unread_count',
                'data' => [
                    '*' => ['id', 'user_id', 'trip_id', 'type', 'message', 'is_read', 'created_at'],
                ],
                'meta' => ['current_page', 'total', 'per_page'],
            ])
            ->assertJson([
                'success' => true,
                'unread_count' => 1,
            ]);
    }

    public function test_can_filter_unread_notifications(): void
    {
        Notification::create([
            'user_id' => $this->driver->id,
            'type' => 'trip_assigned',
            'message' => 'Unread Message',
            'is_read' => false,
        ]);

        Notification::create([
            'user_id' => $this->driver->id,
            'type' => 'trip_completed',
            'message' => 'Read Message',
            'is_read' => true,
        ]);

        $response = $this->getJson("/api/notifications?user_id={$this->driver->id}&unread=true");

        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data'));
        $this->assertEquals('Unread Message', $response->json('data.0.message'));
    }

    public function test_can_mark_single_notification_as_read(): void
    {
        $notification = Notification::create([
            'user_id' => $this->driver->id,
            'type' => 'departure_reminder',
            'message' => 'Segera berangkat',
            'is_read' => false,
        ]);

        $response = $this->postJson("/api/notifications/{$notification->id}/read");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $notification->id,
                    'is_read' => true,
                ],
            ]);

        $this->assertDatabaseHas('notifications', [
            'id' => $notification->id,
            'is_read' => true,
        ]);
    }

    public function test_can_mark_all_notifications_as_read(): void
    {
        Notification::create([
            'user_id' => $this->driver->id,
            'type' => 'trip_assigned',
            'message' => 'Msg 1',
            'is_read' => false,
        ]);

        Notification::create([
            'user_id' => $this->driver->id,
            'type' => 'trip_assigned',
            'message' => 'Msg 2',
            'is_read' => false,
        ]);

        $response = $this->postJson("/api/notifications/read-all?user_id={$this->driver->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'updated_count' => 2,
                ],
            ]);

        $this->assertEquals(0, Notification::where('user_id', $this->driver->id)->where('is_read', false)->count());
    }
}
