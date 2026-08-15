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
        Schema::create('trips', function (Blueprint $table) {
            $table->id();

            $table->foreignId('origin_company_id')->nullable()->constrained('companies');
            $table->foreignId('origin_port_id')->nullable()->constrained('ports');
            $table->foreignId('destination_company_id')->nullable()->constrained('companies');
            $table->foreignId('destination_port_id')->nullable()->constrained('ports');
            $table->foreignId('ship_destination_port_id')->nullable()->constrained('ports');

            $table->foreignId('truck_id')->nullable()->constrained('trucks');
            $table->foreignId('driver_id')->nullable()->constrained('users');

            $table->string('ship_ref_id')->nullable();
            $table->jsonb('recommended_slots')->nullable();
            $table->jsonb('route_geometry')->nullable();
            $table->timestamp('chosen_departure_at')->nullable();

            $table->enum('status', [
                'draft',
                'assigned',
                'in_transit_origin',
                'at_origin_port',
                'on_ship',
                'at_destination_port',
                'in_transit_destination',
                'arrived',
                'completed',
                'cancelled',
            ])->default('draft');

            $table->decimal('distance_km', 8, 2)->nullable();
            $table->decimal('estimated_co2_kg', 8, 2)->nullable();
            $table->integer('estimated_duration_min')->nullable();
            $table->timestamp('actual_departure_at')->nullable();
            $table->timestamp('actual_arrival_at')->nullable();

            $table->foreignId('created_by')->constrained('users');

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('trips');
    }
};
