<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Context\EventType;
use App\Context\Source;

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
                EventType::DEPARTED,
                EventType::GPS_PING,
                EventType::ARRIVED_AT_DESTINATION,
                EventType::ARRIVED_AT_PORT,
                EventType::SHIP_DEPARTED,
                EventType::SHIP_ARRIVED,
                EventType::ARRIVED_FINAL,
                EventType::TRUCK_RETURNED,
            ]);

            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->enum('source', [Source::GPS, Source::MANUAL, Source::API]);
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
