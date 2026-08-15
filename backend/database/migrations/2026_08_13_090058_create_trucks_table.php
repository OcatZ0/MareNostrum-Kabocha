<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Context\FuelType;
use App\Context\Status;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('trucks', function (Blueprint $table) {
            $table->id();
            $table->string('plate_number')->unique();
            $table->string('brand');
            $table->string('model')->nullable();
            $table->integer('year');
            $table->enum('fuel_type', [FuelType::DIESEL, FuelType::GASOLINE, FuelType::ELECTRIC]);
            $table->enum('status', [Status::ACTIVE, Status::MAINTENANCE])->default(Status::ACTIVE);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('trucks');
    }
};
