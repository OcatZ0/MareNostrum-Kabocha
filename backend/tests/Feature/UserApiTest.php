<?php

namespace Tests\Feature;

use App\Context\Role;
use App\Context\StatusTrips;
use App\Models\Trip;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class UserApiTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        // Seed admin user for BypassAuthForTesting middleware
        $this->admin = User::create([
            'name' => 'Admin User',
            'username' => 'admin',
            'password' => Hash::make('password'),
            'role' => Role::ADMIN,
            'phone' => '+62811111111',
        ]);
    }

    public function test_can_get_paginated_users_list(): void
    {
        User::create([
            'name' => 'Driver Budi',
            'username' => 'driver_budi',
            'password' => Hash::make('secret123'),
            'role' => Role::DRIVER,
            'phone' => '+62812345678',
        ]);

        $response = $this->getJson('/api/users');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    '*' => ['id', 'name', 'username', 'role', 'phone', 'created_at', 'updated_at'],
                ],
                'meta' => ['current_page', 'total', 'per_page'],
            ]);
    }

    public function test_can_filter_users_by_role_and_search(): void
    {
        User::create([
            'name' => 'Driver Budi',
            'username' => 'driver_budi',
            'password' => Hash::make('secret123'),
            'role' => Role::DRIVER,
            'phone' => '+62812345678',
        ]);

        User::create([
            'name' => 'Admin Sarah',
            'username' => 'admin_sarah',
            'password' => Hash::make('secret123'),
            'role' => Role::ADMIN,
            'phone' => '+62899999999',
        ]);

        // Filter by role
        $responseRole = $this->getJson('/api/users?role='.Role::DRIVER);
        $responseRole->assertStatus(200);
        $this->assertCount(1, $responseRole->json('data'));
        $this->assertEquals(Role::DRIVER, $responseRole->json('data.0.role'));

        // Search by username
        $responseSearch = $this->getJson('/api/users?search=sarah');
        $responseSearch->assertStatus(200);
        $this->assertCount(1, $responseSearch->json('data'));
        $this->assertEquals('admin_sarah', $responseSearch->json('data.0.username'));
    }

    public function test_can_create_new_user(): void
    {
        $payload = [
            'name' => 'Driver Joko',
            'username' => 'driver_joko',
            'password' => 'password123',
            'role' => Role::DRIVER,
            'phone' => '+628123456789',
        ];

        $response = $this->postJson('/api/users', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'User created successfully.',
                'data' => [
                    'name' => 'Driver Joko',
                    'username' => 'driver_joko',
                    'role' => Role::DRIVER,
                ],
            ]);

        $this->assertDatabaseHas('users', [
            'username' => 'driver_joko',
            'role' => Role::DRIVER,
        ]);

        // Ensure password is not plain text in DB
        $user = User::where('username', 'driver_joko')->first();
        $this->assertTrue(Hash::check('password123', $user->password));
    }

    public function test_create_user_fails_on_duplicate_username_or_invalid_data(): void
    {
        $payload = [
            'name' => '',
            'username' => 'admin', // already taken
            'password' => '123', // too short
            'role' => 'superman', // invalid enum
        ];

        $response = $this->postJson('/api/users', $payload);

        $response->assertStatus(422)
            ->assertJsonStructure([
                'message',
                'errors' => ['name', 'username', 'password', 'role'],
            ]);
    }

    public function test_can_show_user_details(): void
    {
        $user = User::create([
            'name' => 'Driver Andi',
            'username' => 'driver_andi',
            'password' => Hash::make('password123'),
            'role' => Role::DRIVER,
            'phone' => '+628129999888',
        ]);

        $response = $this->getJson("/api/users/{$user->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $user->id,
                    'name' => 'Driver Andi',
                    'username' => 'driver_andi',
                    'role' => Role::DRIVER,
                ],
            ])
            ->assertJsonMissing(['password']);
    }

    public function test_can_update_user_without_changing_password(): void
    {
        $user = User::create([
            'name' => 'Driver Andi',
            'username' => 'driver_andi',
            'password' => Hash::make('initialpassword'),
            'role' => Role::DRIVER,
            'phone' => '+628129999888',
        ]);

        $payload = [
            'name' => 'Driver Andi Pratama',
            'phone' => '+628129999000',
        ];

        $response = $this->putJson("/api/users/{$user->id}", $payload);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'name' => 'Driver Andi Pratama',
                    'phone' => '+628129999000',
                ],
            ]);

        $user->refresh();
        $this->assertEquals('Driver Andi Pratama', $user->name);
        $this->assertTrue(Hash::check('initialpassword', $user->password));
    }

    public function test_can_update_user_password(): void
    {
        $user = User::create([
            'name' => 'Driver Andi',
            'username' => 'driver_andi',
            'password' => Hash::make('initialpassword'),
            'role' => Role::DRIVER,
        ]);

        $payload = [
            'password' => 'newpassword123',
        ];

        $response = $this->putJson("/api/users/{$user->id}", $payload);

        $response->assertStatus(200);

        $user->refresh();
        $this->assertTrue(Hash::check('newpassword123', $user->password));
    }

    public function test_can_delete_user(): void
    {
        $user = User::create([
            'name' => 'Driver To Delete',
            'username' => 'driver_del',
            'password' => Hash::make('password123'),
            'role' => Role::DRIVER,
        ]);

        $response = $this->deleteJson("/api/users/{$user->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'User deleted successfully.',
            ]);

        $this->assertDatabaseMissing('users', [
            'id' => $user->id,
        ]);
    }

    public function test_cannot_delete_user_referenced_in_trips(): void
    {
        $driver = User::create([
            'name' => 'Active Driver',
            'username' => 'driver_active',
            'password' => Hash::make('password123'),
            'role' => Role::DRIVER,
        ]);

        // Create a trip assigned to this driver
        Trip::create([
            'driver_id' => $driver->id,
            'status' => StatusTrips::ASSIGNED,
            'created_by' => $this->admin->id,
        ]);

        $response = $this->deleteJson("/api/users/{$driver->id}");

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Cannot delete user referenced in logistics trip history.',
            ]);

        $this->assertDatabaseHas('users', [
            'id' => $driver->id,
        ]);
    }

    public function test_cannot_delete_own_active_account(): void
    {
        // Admin attempting to delete themselves
        $response = $this->deleteJson("/api/users/{$this->admin->id}");

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Cannot delete your own active account.',
            ]);

        $this->assertDatabaseHas('users', [
            'id' => $this->admin->id,
        ]);
    }
}
