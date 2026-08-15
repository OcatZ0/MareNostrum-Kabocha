<?php

namespace Database\Seeders;

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
                'role' => 'admin',
                'phone' => null,
            ]
        );

        User::updateOrCreate(
            ['username' => 'driver'],
            [
                'name' => 'Driver',
                'password' => 'driver',
                'role' => 'driver',
                'phone' => null,
            ]
        );
    }
}
