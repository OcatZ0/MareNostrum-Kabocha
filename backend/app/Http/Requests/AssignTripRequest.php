<?php

namespace App\Http\Requests;

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
        return $this->user()?->role === 'admin';
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'truck_id' => ['required', 'exists:trucks,id'],
            'driver_id' => ['required', Rule::exists('users', 'id')->where('role', 'driver')],
            'chosen_departure_at' => ['required', 'date', 'after:now'],
        ];
    }

    public function messages(): array
    {
        return [
            'driver_id.exists' => 'driver_id harus berupa user dengan role driver.',
            'chosen_departure_at.after' => 'chosen_departure_at harus di masa depan.',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            /** @var Trip $trip */
            $trip = $this->route('trip');

            if ($this->filled('truck_id') && ! $validator->errors()->has('truck_id')) {
                $truck = Truck::find($this->input('truck_id'));

                if ($truck && $truck->status !== 'active') {
                    $validator->errors()->add('truck_id', 'Truk sedang maintenance, tidak bisa di-assign.');
                }

                if ($truck && $this->isAlreadyOnAnotherActiveTrip('truck_id', $truck->id, $trip)) {
                    $validator->errors()->add('truck_id', 'Truk ini sudah ditugaskan ke trip lain yang masih berjalan.');
                }
            }

            if ($this->filled('driver_id') && ! $validator->errors()->has('driver_id')
                && $this->isAlreadyOnAnotherActiveTrip('driver_id', $this->input('driver_id'), $trip)) {
                $validator->errors()->add('driver_id', 'Driver ini sudah ditugaskan ke trip lain yang masih berjalan.');
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
            ->whereNotIn('status', ['draft', 'completed', 'cancelled'])
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
            $validator->errors()->add('chosen_departure_at', 'Trip belum punya rekomendasi — panggil /recommend dulu.');

            return;
        }

        $chosen = Carbon::parse($this->input('chosen_departure_at'));

        $matches = collect($trip->recommended_slots)
            ->contains(fn (array $slot) => Carbon::parse($slot['departure_at'])->equalTo($chosen));

        if (! $matches) {
            $validator->errors()->add('chosen_departure_at', 'chosen_departure_at harus salah satu dari recommended_slots trip ini.');
        }
    }
}
