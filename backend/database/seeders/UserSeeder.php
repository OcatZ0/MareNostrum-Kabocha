<?php

namespace Database\Seeders;

use App\Context\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['username' => 'admin'],
            [
                'name' => 'Admin',
                'password' => 'admin',
                'role' => Role::ADMIN,
                'phone' => null,
            ]
        );

        User::updateOrCreate(
            ['username' => 'driver'],
            [
                'name' => 'Driver',
                'password' => 'driver',
                'role' => Role::DRIVER,
                'phone' => null,
            ]
        );

        // A handful more drivers so assign/dropdown flows have real variety to pick
        // from instead of always resolving to the same one demo driver.
        $moreDrivers = [
            ['username' => 'driver2', 'name' => 'Budi Santoso', 'phone' => '+6281234500002'],
            ['username' => 'driver3', 'name' => 'Slamet Riyadi', 'phone' => '+6281234500003'],
            ['username' => 'driver4', 'name' => 'Ahmad Fauzi', 'phone' => '+6281234500004'],
            ['username' => 'driver5', 'name' => 'Joko Prasetyo', 'phone' => '+6281234500005'],
        ];

        foreach ($moreDrivers as $driver) {
            User::updateOrCreate(
                ['username' => $driver['username']],
                [
                    'name' => $driver['name'],
                    'password' => $driver['username'],
                    'role' => Role::DRIVER,
                    'phone' => $driver['phone'],
                ]
            );
        }
    }
}
