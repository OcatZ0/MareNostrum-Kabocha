<?php

namespace App\Http\Requests;

use App\Context\Country;
use App\Context\Role;
use App\Models\Company;
use App\Models\Port;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Shared origin/destination combination validation for creating and updating
 * a trip (PRD Bagian 5.1). Used by StoreTripRequest and UpdateTripRequest.
 */
abstract class TripComboRequest extends FormRequest
{
    /**
     * Company.city ('Batam'/'Singapura') <-> Port.country ('indonesia'/'singapore').
     * The app is symmetric: either side's company can originate a cross-border
     * trip, so "which country is local" is derived from the chosen company/port,
     * never hardcoded to Batam.
     */
    private const CITY_TO_COUNTRY = [
        'Batam' => Country::INDONESIA,
        'Singapura' => Country::SINGAPORE,
    ];

    /**
     * Only admin can create/edit trips (PRD Bagian 5.1, 14).
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
            'origin_company_id' => ['nullable', 'exists:companies,id'],
            'origin_port_id' => ['nullable', 'exists:ports,id'],
            'destination_company_id' => ['nullable', 'exists:companies,id'],
            'destination_port_id' => ['nullable', 'exists:ports,id'],
            'ship_destination_port_id' => ['nullable', 'exists:ports,id'],
        ];
    }

    /**
     * Enforce the 4 origin/destination combinations supported by PRD Bagian 5.1, symmetric
     * for either side of the border:
     *  - Company<->Company, same country (domestic)
     *  - Company -> Port + ship_destination_port_id (cross-border: local port must match the
     *    origin company's own country, ship_destination_port_id must be the other country)
     *  - Port -> Company, same country (goods already arrived locally)
     * Any other combination — including a domestic pairing across countries, or a cross-border
     * combo where the local port doesn't match the company's own side — is rejected.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $hasOriginCompany = $this->filled('origin_company_id');
            $hasOriginPort = $this->filled('origin_port_id');
            $hasDestCompany = $this->filled('destination_company_id');
            $hasDestPort = $this->filled('destination_port_id');
            $hasShipPort = $this->filled('ship_destination_port_id');

            if ($hasOriginCompany === $hasOriginPort) {
                $validator->errors()->add('origin_company_id', 'Select exactly one origin point: origin_company_id or origin_port_id.');

                return;
            }

            if ($hasDestCompany === $hasDestPort) {
                $validator->errors()->add('destination_company_id', 'Select exactly one destination point: destination_company_id or destination_port_id.');

                return;
            }

            // Bail out early if a referenced id failed the exists: rule — nothing below can
            // reason about country/city without the actual record.
            if ($validator->errors()->hasAny(['origin_company_id', 'origin_port_id', 'destination_company_id', 'destination_port_id', 'ship_destination_port_id'])) {
                return;
            }

            $originCompany = $hasOriginCompany ? Company::find($this->input('origin_company_id')) : null;
            $originPort = $hasOriginPort ? Port::find($this->input('origin_port_id')) : null;
            $destCompany = $hasDestCompany ? Company::find($this->input('destination_company_id')) : null;
            $destPort = $hasDestPort ? Port::find($this->input('destination_port_id')) : null;
            $shipPort = $hasShipPort ? Port::find($this->input('ship_destination_port_id')) : null;

            $isCrossBorder = $hasOriginCompany && $hasDestPort;
            $isDomestic = $hasOriginCompany && $hasDestCompany;
            $isArrival = $hasOriginPort && $hasDestCompany;

            if (! $isCrossBorder && ! $isDomestic && ! $isArrival) {
                $validator->errors()->add('destination_port_id', 'Unsupported origin/destination combination.');

                return;
            }

            if ($isDomestic) {
                if ($originCompany->id === $destCompany->id) {
                    $validator->errors()->add('destination_company_id', 'origin_company_id and destination_company_id cannot be the same company.');

                    return;
                }

                if ($originCompany->city !== $destCompany->city) {
                    $validator->errors()->add('destination_company_id', 'Domestic trips are only allowed between companies in the same city/country.');
                }

                if ($hasShipPort) {
                    $validator->errors()->add('ship_destination_port_id', 'ship_destination_port_id is only applicable for cross-border trips.');
                }

                return;
            }

            if ($isArrival) {
                $originCountry = self::CITY_TO_COUNTRY[$destCompany->city] ?? null;

                if ($originPort->country !== $originCountry) {
                    $validator->errors()->add('origin_port_id', 'origin_port_id must be in the same country as destination_company_id.');
                }

                if ($hasShipPort) {
                    $validator->errors()->add('ship_destination_port_id', 'ship_destination_port_id is only applicable for cross-border trips.');
                }

                return;
            }

            // Cross-border: destination_port_id must be the origin company's own local
            // port, ship_destination_port_id must be the other side.
            $localCountry = self::CITY_TO_COUNTRY[$originCompany->city] ?? null;

            if ($localCountry === null) {
                $validator->errors()->add('origin_company_id', 'Unrecognized company city (must be Batam or Singapore).');

                return;
            }

            if ($destPort->country !== $localCountry) {
                $validator->errors()->add('destination_port_id', 'destination_port_id must be a port in the same country as origin_company_id.');
            }

            if (! $hasShipPort) {
                $validator->errors()->add('ship_destination_port_id', 'ship_destination_port_id is required for cross-border trips.');
            } elseif ($shipPort->country === $localCountry) {
                $validator->errors()->add('ship_destination_port_id', 'ship_destination_port_id must be a port in a different country from origin_company_id.');
            }
        });
    }
}
