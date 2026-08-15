<?php

namespace App\Http\Requests;

use App\Context\EventType;
use App\Context\Role;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTripCheckpointRequest extends FormRequest
{
    /**
     * Ownership (must be this trip's own driver) is checked in the controller, not here,
     * it needs the route-bound Trip which authorize() can also reach via $this->route(),
     * but the 403 message there is trip-specific ("bukan milik Anda") matching every
     * other driver-ownership check in this app (TripController::show()), so it stays
     * consistent by living in the same place as those.
     */
    public function authorize(): bool
    {
        return $this->user()?->role === Role::DRIVER;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            // ship_departed/ship_arrived were originally meant to be system-generated from
            // VesselAPI polling only (that integration was never finished), but the driver
            // dashboard's Simulate Vessel feature now posts them the same way Simulate
            // Arrival already posts arrived_at_port/arrived_final/etc — a demo stand-in for
            // real GPS/AIS data, not a driver's browser doing anything a real one wouldn't.
            'event_type' => ['required', Rule::in([
                EventType::DEPARTED,
                EventType::GPS_PING,
                EventType::ARRIVED_AT_DESTINATION,
                EventType::ARRIVED_AT_PORT,
                EventType::ARRIVED_FINAL,
                EventType::TRUCK_RETURNED,
                EventType::SHIP_DEPARTED,
                EventType::SHIP_ARRIVED,
            ])],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            // ship_departed only: Simulate Vessel picks a random other-island port as the
            // crossing's destination and sends it here, overwriting the trip's originally
            // configured ship_destination_port_id for the duration of the simulated crossing.
            'destination_port_id' => ['nullable', 'integer', 'exists:ports,id'],
        ];
    }
}
