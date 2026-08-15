<?php

namespace App\Http\Requests;

use App\Context\Role;
use App\Context\Status;
use App\Context\StatusTrips;
use App\Models\Trip;
use App\Models\Truck;
use Carbon\Carbon;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class AssignTripRequest extends FormRequest
{
    /**
     * Only admin can assign trips (PRD Bagian 5.1, 14).
     */
    public function authorize(): bool
    {
        return $this->user()?->role === Role::ADMIN;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'truck_id' => ['required', 'exists:trucks,id'],
            'driver_id' => ['required', Rule::exists('users', 'id')->where('role', Role::DRIVER)],
            'chosen_departure_at' => ['required', 'date', 'after:now'],
        ];
    }

    public function messages(): array
    {
        return [
            'driver_id.exists' => 'driver_id must be a user with the driver role.',
            'chosen_departure_at.after' => 'chosen_departure_at must be a future date and time.',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            /** @var Trip $trip */
            $trip = $this->route('trip');

            if ($this->filled('truck_id') && ! $validator->errors()->has('truck_id')) {
                $truck = Truck::find($this->input('truck_id'));

                if ($truck && $truck->status !== Status::ACTIVE) {
                    $validator->errors()->add('truck_id', 'Truck is currently in maintenance and cannot be assigned.');
                }

                if ($truck && $this->isAlreadyOnAnotherActiveTrip('truck_id', $truck->id, $trip)) {
                    $validator->errors()->add('truck_id', 'This truck is already assigned to another active trip.');
                }
            }

            if ($this->filled('driver_id') && ! $validator->errors()->has('driver_id')
                && $this->isAlreadyOnAnotherActiveTrip('driver_id', $this->input('driver_id'), $trip)) {
                $validator->errors()->add('driver_id', 'This driver is already assigned to another active trip.');
            }

            if ($this->filled('chosen_departure_at') && ! $validator->errors()->has('chosen_departure_at')) {
                $this->validateChosenSlot($validator, $trip);
            }
        });
    }

    /**
     * A truck/driver can only be actively on one trip at a time — "active" meaning
     * anything from assigned through in-progress, excluding draft (not yet committed)
     * and completed/cancelled (already finished).
     */
    private function isAlreadyOnAnotherActiveTrip(string $column, int $id, Trip $trip): bool
    {
        return Trip::query()
            ->where($column, $id)
            ->where('id', '!=', $trip->id)
            ->whereNotIn('status', [StatusTrips::DRAFT, StatusTrips::COMPLETED, StatusTrips::CANCELLED])
            ->exists();
    }

    /**
     * chosen_departure_at must be one of the 3 slots /recommend generated (PRD Bagian
     * 5.1: "Admin memilih 1 slot waktu... dari rekomendasi sistem") — comparing actual
     * instants via Carbon, not raw strings, since equivalent timestamps can be
     * formatted differently by the client.
     */
    private function validateChosenSlot(Validator $validator, Trip $trip): void
    {
        if (empty($trip->recommended_slots)) {
            $validator->errors()->add('chosen_departure_at', 'Trip does not have recommendations yet — call /recommend first.');

            return;
        }

        $chosen = Carbon::parse($this->input('chosen_departure_at'));

        $matches = collect($trip->recommended_slots)
            ->contains(fn (array $slot) => Carbon::parse($slot['departure_at'])->equalTo($chosen));

        if (! $matches) {
            $validator->errors()->add('chosen_departure_at', 'chosen_departure_at must be one of the recommended_slots for this trip.');
        }
    }
}
