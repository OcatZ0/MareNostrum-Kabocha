<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('trip_checkpoints', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trip_id')->constrained('trips');

            $table->enum('event_type', [
                'departed',
                'gps_ping',
                'arrived_at_destination',
                'arrived_at_port',
                'ship_departed',
                'ship_arrived',
                'arrived_final',
                'truck_returned',
            ]);

            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->enum('source', ['gps', 'manual', 'api']);
            $table->timestamp('recorded_at');

            $table->timestamp('created_at')->useCurrent();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('trip_checkpoints');
    }
};
