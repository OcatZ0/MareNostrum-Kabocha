<?php

namespace Tests\Feature;

use App\Context\CompanyType;
use App\Context\Role;
use App\Context\StatusTrips;
use App\Models\Company;
use App\Models\Trip;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CompanyApiTest extends TestCase
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

    public function test_can_get_paginated_companies_list(): void
    {
        Company::create([
            'name' => 'Company A Logistics',
            'type' => CompanyType::INTERNAL,
            'city' => 'Batam',
            'address' => 'Batam Center',
            'latitude' => 1.1234567,
            'longitude' => 104.0123456,
        ]);

        $response = $this->getJson('/api/companies');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    '*' => ['id', 'name', 'type', 'city', 'address', 'latitude', 'longitude', 'created_at', 'updated_at'],
                ],
                'meta' => ['current_page', 'total', 'per_page'],
            ]);
    }

    public function test_can_filter_companies_by_type_and_search(): void
    {
        Company::create([
            'name' => 'Batam Central Depot',
            'type' => CompanyType::INTERNAL,
            'city' => 'Batam',
            'latitude' => 1.123,
            'longitude' => 104.012,
        ]);

        Company::create([
            'name' => 'Singapore Distribution Partner',
            'type' => CompanyType::PARTNER,
            'city' => 'Singapore',
            'latitude' => 1.290,
            'longitude' => 103.851,
        ]);

        // Filter by type
        $responseType = $this->getJson('/api/companies?type='.CompanyType::INTERNAL);
        $responseType->assertStatus(200);
        $this->assertCount(1, $responseType->json('data'));
        $this->assertEquals(CompanyType::INTERNAL, $responseType->json('data.0.type'));

        // Search by keyword
        $responseSearch = $this->getJson('/api/companies?search=Singapore');
        $responseSearch->assertStatus(200);
        $this->assertCount(1, $responseSearch->json('data'));
        $this->assertEquals('Singapore', $responseSearch->json('data.0.city'));
    }

    public function test_can_create_new_company(): void
    {
        $payload = [
            'name' => 'New Partner Warehouse',
            'type' => CompanyType::PARTNER,
            'city' => 'Batam',
            'address' => 'Kawasan Industri Batu Ampar',
            'latitude' => 1.1567000,
            'longitude' => 104.0012000,
        ];

        $response = $this->postJson('/api/companies', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Perusahaan berhasil ditambahkan.',
                'data' => [
                    'name' => 'New Partner Warehouse',
                    'type' => CompanyType::PARTNER,
                    'city' => 'Batam',
                ],
            ]);

        $this->assertDatabaseHas('companies', [
            'name' => 'New Partner Warehouse',
            'type' => CompanyType::PARTNER,
        ]);
    }

    public function test_create_company_fails_on_invalid_data(): void
    {
        $payload = [
            'name' => '', // Empty name
            'type' => 'invalid_type', // Invalid enum
            'city' => 'Batam',
            'latitude' => 999.0, // Out of range lat
            'longitude' => 104.0,
        ];

        $response = $this->postJson('/api/companies', $payload);

        $response->assertStatus(422)
            ->assertJsonStructure([
                'message',
                'errors' => ['name', 'type', 'latitude'],
            ]);
    }

    public function test_can_show_company_details(): void
    {
        $company = Company::create([
            'name' => 'Specific Target Company',
            'type' => 'partner',
            'city' => 'Batam',
            'latitude' => 1.100,
            'longitude' => 104.000,
        ]);

        $response = $this->getJson("/api/companies/{$company->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $company->id,
                    'name' => 'Specific Target Company',
                ],
            ]);
    }

    public function test_can_update_company(): void
    {
        $company = Company::create([
            'name' => 'Old Name Company',
            'type' => 'partner',
            'city' => 'Batam',
            'latitude' => 1.100,
            'longitude' => 104.000,
        ]);

        $payload = [
            'name' => 'Updated Name Company',
            'city' => 'Singapura',
        ];

        $response = $this->putJson("/api/companies/{$company->id}", $payload);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $company->id,
                    'name' => 'Updated Name Company',
                    'city' => 'Singapura',
                ],
            ]);

        $this->assertDatabaseHas('companies', [
            'id' => $company->id,
            'name' => 'Updated Name Company',
            'city' => 'Singapura',
        ]);
    }

    public function test_can_delete_company(): void
    {
        $company = Company::create([
            'name' => 'Company To Delete',
            'type' => CompanyType::PARTNER,
            'city' => 'Batam',
            'latitude' => 1.100,
            'longitude' => 104.000,
        ]);

        $response = $this->deleteJson("/api/companies/{$company->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Perusahaan berhasil dihapus.',
            ]);

        $this->assertDatabaseMissing('companies', [
            'id' => $company->id,
        ]);
    }

    public function test_cannot_delete_company_referenced_in_trips(): void
    {
        $company = Company::create([
            'name' => 'Active Business Partner',
            'type' => CompanyType::PARTNER,
            'city' => 'Batam',
            'latitude' => 1.100,
            'longitude' => 104.000,
        ]);

        $admin = User::first();

        // Create a trip referencing this company
        Trip::create([
            'origin_company_id' => $company->id,
            'destination_company_id' => null,
            'status' => StatusTrips::DRAFT,
            'created_by' => $admin->id,
        ]);

        $response = $this->deleteJson("/api/companies/{$company->id}");

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Tidak dapat menghapus perusahaan yang masih terhubung dengan data trip.',
            ]);

        $this->assertDatabaseHas('companies', [
            'id' => $company->id,
        ]);
    }
}
