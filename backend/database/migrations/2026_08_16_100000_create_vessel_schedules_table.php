<?php

use App\Context\VesselScheduleStatus;
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
        Schema::create('vessel_schedules', function (Blueprint $table) {
            $table->id();
            $table->string('vessel_name');
            $table->string('ship_ref_id', 30)->comment('MMSI or IMO number of the vessel');
            $table->string('voyage_number', 50)->nullable();
            $table->foreignId('origin_port_id')->constrained('ports')->cascadeOnDelete();
            $table->foreignId('destination_port_id')->constrained('ports')->cascadeOnDelete();
            $table->timestamp('scheduled_departure_at');
            $table->timestamp('scheduled_arrival_at');
            $table->timestamp('actual_departure_at')->nullable();
            $table->timestamp('actual_arrival_at')->nullable();
            $table->timestamp('estimated_arrival_at')->nullable();
            $table->enum('status', VesselScheduleStatus::all())->default(VesselScheduleStatus::SCHEDULED);
            $table->decimal('current_latitude', 10, 7)->nullable();
            $table->decimal('current_longitude', 10, 7)->nullable();
            $table->decimal('current_speed_knots', 6, 2)->nullable();
            $table->decimal('distance_to_destination_km', 8, 2)->nullable();
            $table->decimal('distance_to_destination_nm', 8, 2)->nullable();
            $table->integer('variance_minutes')->default(0)->comment('Positive = delayed, Negative = early');
            $table->integer('tolerance_minutes')->default(30)->comment('Threshold in minutes for alert trigger');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['ship_ref_id', 'status']);
            $table->index(['origin_port_id', 'destination_port_id']);
            $table->index('scheduled_arrival_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('vessel_schedules');
    }
};
