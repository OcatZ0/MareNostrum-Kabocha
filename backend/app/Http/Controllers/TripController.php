<?php

namespace App\Http\Controllers;

use App\Http\Requests\AssignTripRequest;
use App\Http\Requests\StoreTripRequest;
use App\Http\Requests\UpdateTripRequest;
use App\Http\Resources\TripResource;
use App\Models\Notification;
use App\Models\Trip;
use App\Traits\ApiResponse;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use OpenApi\Attributes as OA;
use RuntimeException;

class TripController extends Controller
{
    use ApiResponse;

    protected array $with = [
        'originCompany',
        'originPort',
        'destinationCompany',
        'destinationPort',
        'shipDestinationPort',
    ];

    protected array $comboFields = [
        'origin_company_id',
        'origin_port_id',
        'destination_company_id',
        'destination_port_id',
        'ship_destination_port_id',
    ];

    /**
     * The 3 recommendation slots each come from searching one of these ranges for its
     * best-scoring departure time. Range 3 deliberately extends past midnight into
     * 22:00-05:00 so a night candidate stays possible — otherwise the "night slot never
     * wins" rule (PRD Bagian 5.1) would never have anything to demote.
     */
    protected array $searchRanges = [
        ['start_hour' => 6, 'start_day_offset' => 0, 'end_hour' => 12, 'end_day_offset' => 0],
        ['start_hour' => 12, 'start_day_offset' => 0, 'end_hour' => 18, 'end_day_offset' => 0],
        ['start_hour' => 18, 'start_day_offset' => 0, 'end_hour' => 5, 'end_day_offset' => 1],
    ];

    #[OA\Get(
        path: '/trips',
        summary: 'List trips',
        description: 'Admin sees all trips. Driver sees only trips assigned to them (driver_id).',
        security: [['sanctum' => []]],
        tags: ['Trips'],
        parameters: [
            new OA\Parameter(name: 'per_page', in: 'query', required: false, schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'OK',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(property: 'message', type: 'string', example: 'OK'),
                        new OA\Property(property: 'data', type: 'array', items: new OA\Items(ref: '#/components/schemas/Trip')),
                        new OA\Property(property: 'meta', properties: [
                            new OA\Property(property: 'current_page', type: 'integer'),
                            new OA\Property(property: 'total', type: 'integer'),
                            new OA\Property(property: 'per_page', type: 'integer'),
                        ], type: 'object'),
                    ]
                )
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
        ]
    )]
    public function index(Request $request)
    {
        $query = Trip::query()->with($this->with)->latest();

        if ($request->user()->role !== 'admin') {
            $query->where('driver_id', $request->user()->id);
        }

        $trips = $query->paginate($request->integer('per_page', 15));

        return $this->success(TripResource::collection($trips));
    }

    #[OA\Post(
        path: '/trips',
        summary: 'Create a trip',
        description: 'Admin only. Creates a trip in draft status. Exactly one origin field and one destination '
            .'field must be provided, matching one of the supported combinations (PRD Bagian 5.1). The app is '
            .'symmetric — either a Batam-side or Singapore-side company can originate a cross-border trip: '
            .'Company<->Company (domestic, both sides must be in the same city), Company->Port + '
            .'ship_destination_port_id (cross-border — destination_port_id must be in the SAME country as '
            .'origin_company_id, ship_destination_port_id must be in the OTHER country), Port->Company '
            .'(goods arriving from a port in the same country as the destination company).',
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'origin_company_id', type: 'integer', nullable: true, description: 'Any company, either side of the border.'),
                    new OA\Property(property: 'origin_port_id', type: 'integer', nullable: true, description: 'Must be in the same country as destination_company_id.'),
                    new OA\Property(property: 'destination_company_id', type: 'integer', nullable: true, description: 'Any company, either side of the border.'),
                    new OA\Property(property: 'destination_port_id', type: 'integer', nullable: true, description: 'Must be in the same country as origin_company_id — this is where the TRUCK stops, not the ship\'s final port.'),
                    new OA\Property(property: 'ship_destination_port_id', type: 'integer', nullable: true, description: 'Required only for cross-border trips. Must be in a DIFFERENT country than origin_company_id — this is where the SHIP ends up.'),
                ],
                examples: [
                    new OA\Examples(
                        example: 'domestic',
                        summary: 'Domestic: Batamindo -> Kawasan Bintang Industri 2 (or reverse), same city',
                        value: ['origin_company_id' => 1, 'destination_company_id' => 2]
                    ),
                    new OA\Examples(
                        example: 'cross_border_outbound',
                        summary: 'Cross-border (Batam -> Singapore): Batamindo -> Batu Ampar port -> Port of Singapore',
                        description: 'destination_port_id is the Batam port the TRUCK drives to (same country as origin_company_id). ship_destination_port_id is the Singapore port the SHIP continues to (the other country).',
                        value: ['origin_company_id' => 1, 'destination_port_id' => 1, 'ship_destination_port_id' => 4]
                    ),
                    new OA\Examples(
                        example: 'cross_border_reverse',
                        summary: 'Cross-border (Singapore -> Batam): Tuas Industrial Estate -> Port of Singapore -> Batu Ampar port',
                        description: 'Same combination, mirrored: destination_port_id is now the Singapore port (matches origin_company_id\'s own country), ship_destination_port_id is the Batam port.',
                        value: ['origin_company_id' => 5, 'destination_port_id' => 4, 'ship_destination_port_id' => 1]
                    ),
                    new OA\Examples(
                        example: 'port_to_company',
                        summary: 'Port Z -> Batamindo (goods arriving from a port, same country)',
                        value: ['origin_port_id' => 1, 'destination_company_id' => 1]
                    ),
                ]
            )
        ),
        tags: ['Trips'],
        responses: [
            new OA\Response(
                response: 201,
                description: 'Created',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(property: 'message', type: 'string', example: 'Trip created'),
                        new OA\Property(property: 'data', ref: '#/components/schemas/Trip'),
                    ]
                )
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Forbidden — driver cannot create trips'),
            new OA\Response(
                response: 422,
                description: 'Validation error',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(property: 'message', type: 'string', example: 'Validation error'),
                        new OA\Property(property: 'errors', type: 'object'),
                    ]
                )
            ),
        ]
    )]
    public function store(StoreTripRequest $request)
    {
        $trip = Trip::create([
            ...$request->validated(),
            'status' => 'draft',
            'created_by' => $request->user()->id,
        ])->load($this->with);

        return $this->success(new TripResource($trip), 'Trip created', 201);
    }

    #[OA\Get(
        path: '/trips/{id}',
        summary: 'Get a single trip',
        description: 'Admin can view any trip. Driver can only view a trip assigned to them (driver_id).',
        security: [['sanctum' => []]],
        tags: ['Trips'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'OK',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(property: 'message', type: 'string', example: 'OK'),
                        new OA\Property(property: 'data', ref: '#/components/schemas/Trip'),
                    ]
                )
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Forbidden — trip not assigned to this driver'),
            new OA\Response(response: 404, description: 'Trip not found'),
        ]
    )]
    public function show(Request $request, Trip $trip)
    {
        if ($request->user()->role !== 'admin' && $trip->driver_id !== $request->user()->id) {
            abort(403, 'Trip ini bukan milik Anda.');
        }

        return $this->success(new TripResource($trip->load($this->with)));
    }

    #[OA\Put(
        path: '/trips/{id}',
        summary: 'Update a trip\'s origin/destination',
        description: 'Admin only. Only allowed while the trip is still in draft status — once assigned, use '
            .'the dedicated /assign, /recommend, /ship endpoints instead. Same combination rules as creating a '
            .'trip, including origin_company_id/destination_company_id never being the same company. Changing '
            .'the combo clears any previously computed recommended_slots/route_geometry/distance_km/'
            .'estimated_co2_kg/estimated_duration_min (those were calculated for the old route — call /recommend '
            .'again), and clears ship_ref_id if the new combo is no longer cross-border.',
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'origin_company_id', type: 'integer', nullable: true),
                    new OA\Property(property: 'origin_port_id', type: 'integer', nullable: true),
                    new OA\Property(property: 'destination_company_id', type: 'integer', nullable: true),
                    new OA\Property(property: 'destination_port_id', type: 'integer', nullable: true),
                    new OA\Property(property: 'ship_destination_port_id', type: 'integer', nullable: true),
                ],
                examples: [
                    new OA\Examples(example: 'domestic', summary: 'Domestic: Batamindo -> Kawasan Bintang Industri 2', value: ['origin_company_id' => 1, 'destination_company_id' => 2]),
                    new OA\Examples(example: 'cross_border_outbound', summary: 'Cross-border: Batamindo -> Batu Ampar port -> Port of Singapore', value: ['origin_company_id' => 1, 'destination_port_id' => 1, 'ship_destination_port_id' => 4]),
                ]
            )
        ),
        tags: ['Trips'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'OK',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(property: 'message', type: 'string', example: 'Trip updated'),
                        new OA\Property(property: 'data', ref: '#/components/schemas/Trip'),
                    ]
                )
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Forbidden — driver cannot update trips'),
            new OA\Response(response: 404, description: 'Trip not found'),
            new OA\Response(response: 422, description: 'Validation error, or trip is no longer in draft status'),
        ]
    )]
    public function update(UpdateTripRequest $request, Trip $trip)
    {
        if ($trip->status !== 'draft') {
            return $this->error('Trip hanya bisa diubah selagi masih berstatus draft.', 422);
        }

        // Full replacement of the origin/destination combo: fields omitted from the
        // request must be cleared, not left stale — otherwise switching combos (e.g.
        // domestic -> cross-border) can leave both an old destination_company_id and
        // a new destination_port_id set at once, an invalid state store() would reject.
        $comboData = collect($this->comboFields)->mapWithKeys(
            fn (string $field) => [$field => $request->input($field)]
        )->all();

        // Changing the combo invalidates anything computed for the OLD route: /recommend
        // fills these while status is still draft, before /assign moves it off draft —
        // so a PUT here can land between those two calls. Force a fresh /recommend by
        // clearing them rather than leaving stale distance/CO2/geometry attached to a
        // trip that no longer goes where they were calculated for.
        $comboData['recommended_slots'] = null;
        $comboData['route_geometry'] = null;
        $comboData['distance_km'] = null;
        $comboData['estimated_co2_kg'] = null;
        $comboData['estimated_duration_min'] = null;

        // ship_ref_id only makes sense on a cross-border trip (destination_port_id set
        // alongside ship_destination_port_id) — drop it if the new combo isn't one.
        if (! $comboData['ship_destination_port_id']) {
            $comboData['ship_ref_id'] = null;
        }

        $trip->update($comboData);

        return $this->success(new TripResource($trip->load($this->with)), 'Trip updated');
    }

    #[OA\Post(
        path: '/trips/{id}/recommend',
        summary: 'Generate 3 departure time recommendations',
        description: 'Admin only, draft trips only. Searches 3 ranges on the trip\'s truck route (origin to '
            .'destination_port_id/destination_company_id — NEVER ship_destination_port_id, the ship leg isn\'t a '
            .'TomTom-routable road trip): 06:00-12:00, 12:00-18:00, and 18:00-05:00 (next day, deliberately '
            .'reaching into night hours). Each range is searched coarse-to-fine — hourly via TomTom Calculate '
            .'Route (Bagian 8.1) first, then refined +/-45min in 15-min steps around the best hour — and its '
            .'single best-scoring departure time becomes that range\'s recommended slot. Scoring (Bagian 17): '
            .'score = 100 - traffic_penalty - delay_penalty - night_penalty. A slot in 22:00-05:00 is never '
            .'picked as the primary recommendation, only kept as an alternative. All ranges/hours are in the '
            .'trip\'s own local timezone: Asia/Jakarta (WIB) for a Batam-side company, Asia/Singapore (SGT, 1hr '
            .'ahead) for a Singapore-side one — resolved from whichever company is on the trip. Roughly 35-40 '
            .'TomTom calls per execution (cached 15min each) — this is an expensive endpoint, avoid calling it '
            .'in a loop. Saves recommended_slots, and copies distance_km/route_geometry/estimated_duration_min '
            .'from the winning slot onto the trip.',
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: false,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'date', type: 'string', format: 'date', nullable: true, description: 'Defaults to tomorrow.'),
                ]
            )
        ),
        tags: ['Trips'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'OK',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(property: 'message', type: 'string', example: 'Trip recommendations generated'),
                        new OA\Property(property: 'data', ref: '#/components/schemas/Trip'),
                    ]
                )
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Forbidden — admin only'),
            new OA\Response(response: 404, description: 'Trip not found'),
            new OA\Response(response: 422, description: 'Trip is not in draft status'),
            new OA\Response(response: 502, description: 'TomTom API request failed'),
        ]
    )]
    public function recommend(Request $request, Trip $trip)
    {
        if ($request->user()->role !== 'admin') {
            abort(403, 'Hanya admin yang bisa membuat rekomendasi trip.');
        }

        if ($trip->status !== 'draft') {
            return $this->error('Rekomendasi hanya bisa dibuat selagi trip berstatus draft.', 422);
        }

        $trip->loadMissing(['originCompany', 'originPort', 'destinationCompany', 'destinationPort']);

        $origin = $this->resolvePoint($trip, 'origin');
        $destination = $this->resolvePoint($trip, 'destination');
        $timezone = $this->resolveTimezone($trip);
        $date = $request->filled('date')
            ? Carbon::parse($request->input('date'), $timezone)
            : Carbon::tomorrow($timezone);

        try {
            $slots = collect($this->searchRanges)->map(function (array $range) use ($trip, $origin, $destination, $date, $timezone) {
                $start = $date->copy()->addDays($range['start_day_offset'])->setTime($range['start_hour'], 0);
                $end = $date->copy()->addDays($range['end_day_offset'])->setTime($range['end_hour'], 0);

                return $this->searchBestInRange($trip, $origin, $destination, $start, $end, $timezone);
            });
        } catch (RuntimeException $e) {
            return $this->error('Gagal menghubungi TomTom API: '.$e->getMessage(), 502);
        }

        // Night slot can never be the primary recommendation (PRD Bagian 5.1) — pick the
        // best non-night slot. Only range 3 can ever produce a night result (ranges 1/2
        // are 06:00-18:00, entirely daytime), so at most 1 of the 3 slots is ever night;
        // the "?? overall best" fallback is a safety net in case searchRanges changes.
        $winner = $slots->reject(fn (array $slot) => $slot['is_night'])->sortByDesc('score')->first()
            ?? $slots->sortByDesc('score')->first();

        $persistedSlots = $slots->map(function (array $slot) use ($winner) {
            $slot['is_recommended'] = $slot['departure_at'] === $winner['departure_at'];
            $slot['reason'] = $this->buildReason($slot);
            $slot['distance_km'] = round($slot['distance_meters'] / 1000, 2);
            unset($slot['is_night'], $slot['route_geometry'], $slot['distance_meters']);

            return $slot;
        })->values()->all();

        $trip->update([
            'recommended_slots' => $persistedSlots,
            'distance_km' => round($winner['distance_meters'] / 1000, 2),
            'route_geometry' => $winner['route_geometry'],
            'estimated_duration_min' => (int) round($winner['travel_time_seconds'] / 60),
        ]);

        return $this->success(new TripResource($trip->load($this->with)), 'Trip recommendations generated');
    }

    #[OA\Post(
        path: '/trips/{id}/assign',
        summary: 'Assign a truck, driver, and confirmed departure time',
        description: 'Admin only, draft trips only. chosen_departure_at must be one of the 3 departure times '
            .'/recommend generated (PRD Bagian 5.1) — call /recommend first if recommended_slots is empty. The '
            .'truck must be status=active (not under maintenance), and neither the truck nor the driver may '
            .'already be on another non-draft, non-finished trip. Transitions the trip from draft to assigned '
            .'(PRD Bagian 16) and sends a trip_assigned notification to the driver.',
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['truck_id', 'driver_id', 'chosen_departure_at'],
                properties: [
                    new OA\Property(property: 'truck_id', type: 'integer'),
                    new OA\Property(property: 'driver_id', type: 'integer', description: 'Must be a user with role=driver.'),
                    new OA\Property(property: 'chosen_departure_at', type: 'string', format: 'date-time', description: 'Must exactly match one of recommended_slots[].departure_at.'),
                ]
            )
        ),
        tags: ['Trips'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'OK',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(property: 'message', type: 'string', example: 'Trip assigned'),
                        new OA\Property(property: 'data', ref: '#/components/schemas/Trip'),
                    ]
                )
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Forbidden — admin only'),
            new OA\Response(response: 404, description: 'Trip not found'),
            new OA\Response(response: 422, description: 'Validation error, or trip is no longer in draft status'),
        ]
    )]
    public function assign(AssignTripRequest $request, Trip $trip)
    {
        if ($trip->status !== 'draft') {
            return $this->error('Trip hanya bisa di-assign selagi masih berstatus draft.', 422);
        }

        $trip->update([
            'truck_id' => $request->input('truck_id'),
            'driver_id' => $request->input('driver_id'),
            'chosen_departure_at' => $request->input('chosen_departure_at'),
            'status' => 'assigned',
        ]);

        Notification::create([
            'user_id' => $trip->driver_id,
            'trip_id' => $trip->id,
            'type' => 'trip_assigned',
            'message' => "Anda ditugaskan pada trip #{$trip->id}, keberangkatan ".Carbon::parse($trip->chosen_departure_at)->format('Y-m-d H:i'),
        ]);

        return $this->success(new TripResource($trip->load($this->with)), 'Trip assigned');
    }

    /**
     * Coarse-to-fine search for the single best-scoring departure time within [start,
     * end): hourly first, then refined +/-45min in 15-min steps around the best hour
     * found. Full 15-min brute force across a 6-11h range would be 24-44 TomTom calls
     * per range on its own (72-130 total across all 3 ranges) — this cuts that to
     * roughly 12-18 calls per range while still landing on a 15-min-precision answer.
     */
    protected function searchBestInRange(Trip $trip, array $origin, array $destination, Carbon $start, Carbon $end, string $timezone): array
    {
        $evaluated = collect();

        $cursor = $start->copy();
        while ($cursor->lt($end)) {
            $evaluated->push($this->evaluateSlot($trip, $origin, $destination, $cursor->copy(), $timezone));
            $cursor->addHour();
        }

        $bestHour = Carbon::parse($evaluated->sortByDesc('score')->first()['departure_at']);

        foreach ([-45, -30, -15, 15, 30, 45] as $offsetMinutes) {
            $candidate = $bestHour->copy()->addMinutes($offsetMinutes);

            if ($candidate->lt($start) || $candidate->gte($end)) {
                continue;
            }

            $evaluated->push($this->evaluateSlot($trip, $origin, $destination, $candidate, $timezone));
        }

        return $evaluated->sortByDesc('score')->first();
    }

    protected function evaluateSlot(Trip $trip, array $origin, array $destination, Carbon $departAt, string $timezone): array
    {
        $route = $this->callTomTomRoute($origin, $destination, $departAt);
        $delayPenalty = $this->historicalDelayPenalty($trip, $departAt->hour, $timezone);

        return $this->scoreSlot($departAt, $route, $delayPenalty);
    }

    /**
     * Which local timezone applies to this trip's business-hour logic (candidate slot
     * generation, night_penalty boundary, historical delay hour-matching) — derived
     * from whichever company is actually on the trip (PRD Bagian 5.1 combos always
     * have exactly one: origin_company_id for domestic/cross-border, or
     * destination_company_id for the port-arrival combo). Batam (WIB, UTC+7) and
     * Singapore (SGT, UTC+8) are 1 hour apart, so a Singapore-origin trip's "night"
     * genuinely isn't the same moment as a Batam-origin trip's.
     */
    protected function resolveTimezone(Trip $trip): string
    {
        $company = $trip->originCompany ?? $trip->destinationCompany;

        return $company?->city === 'Singapura' ? 'Asia/Singapore' : 'Asia/Jakarta';
    }

    /**
     * Resolve the lat/lng of a trip's origin or destination point, whichever of the
     * company/port pair is actually set for that side (PRD Bagian 5.1 combos).
     */
    protected function resolvePoint(Trip $trip, string $side): array
    {
        $model = $side === 'origin'
            ? ($trip->originCompany ?? $trip->originPort)
            : ($trip->destinationCompany ?? $trip->destinationPort);

        return [
            'lat' => (float) $model->latitude,
            'lng' => (float) $model->longitude,
        ];
    }

    /**
     * PRD Bagian 8.1: one Calculate Route call yields travel time + traffic delay
     * (scoring), length (distance_km), and points (route_geometry) — cached per PRD
     * Bagian 10 risk mitigation so repeated/identical requests don't burn the 2,500/day
     * TomTom quota.
     */
    protected function callTomTomRoute(array $origin, array $destination, Carbon $departAt): array
    {
        // Normalize to UTC for the cache key: two different real moments that happen to
        // share the same clock digits in different timezones (e.g. 06:00 WIB vs 06:00
        // SGT are 1 hour apart in reality) must never collide in the cache.
        $cacheKey = sprintf(
            'tomtom_route:%s,%s:%s,%s:%s',
            $origin['lat'], $origin['lng'], $destination['lat'], $destination['lng'], $departAt->clone()->utc()->format('Y-m-d\TH:i')
        );

        return Cache::remember($cacheKey, now()->addMinutes(15), function () use ($origin, $destination, $departAt) {
            $response = Http::get(sprintf(
                'https://api.tomtom.com/routing/1/calculateRoute/%s,%s:%s,%s/json',
                $origin['lat'], $origin['lng'], $destination['lat'], $destination['lng']
            ), [
                // Explicit UTC offset (P), not a naive local-looking string — leaving it
                // out risks TomTom interpreting the timestamp in the wrong zone, the same
                // class of bug as the app.timezone issue, just at the API boundary instead.
                'departAt' => $departAt->format('Y-m-d\TH:i:sP'),
                'traffic' => 'true',
                'key' => config('services.tomtom.key'),
            ]);

            if ($response->failed()) {
                throw new RuntimeException("HTTP {$response->status()}: {$response->body()}");
            }

            $route = $response->json('routes.0');

            if (! $route) {
                throw new RuntimeException('TomTom returned no route for this origin/destination.');
            }

            return [
                'travel_time_seconds' => $route['summary']['travelTimeInSeconds'],
                'traffic_delay_seconds' => $route['summary']['trafficDelayInSeconds'] ?? 0,
                'distance_meters' => $route['summary']['lengthInMeters'],
                // TomTom {latitude,longitude} per point -> GeoJSON [lng,lat] (Bagian 8.1/8.6).
                'route_geometry' => collect($route['legs'])
                    ->flatMap(fn (array $leg) => $leg['points'])
                    ->map(fn (array $p) => [$p['longitude'], $p['latitude']])
                    ->values()
                    ->all(),
            ];
        });
    }

    /**
     * PRD Bagian 17 delay_penalty: average historical delay (actual - estimated
     * duration, in minutes) for completed trips on this exact route that departed at
     * this exact hour. Zero if no matching history exists yet.
     */
    protected function historicalDelayPenalty(Trip $trip, int $hour, string $timezone): float
    {
        $avgDelayMinutes = Trip::query()
            ->where('status', 'completed')
            ->where('origin_company_id', $trip->origin_company_id)
            ->where('origin_port_id', $trip->origin_port_id)
            ->where('destination_company_id', $trip->destination_company_id)
            ->where('destination_port_id', $trip->destination_port_id)
            ->whereNotNull('actual_departure_at')
            ->whereNotNull('actual_arrival_at')
            ->whereNotNull('estimated_duration_min')
            ->get()
            // actual_departure_at is stored UTC — convert to the trip's local timezone
            // before reading ->hour, or a Batam trip's "hour" would silently be wrong
            // the same way the original app.timezone bug was.
            ->filter(fn (Trip $t) => $t->actual_departure_at->clone()->setTimezone($timezone)->hour === $hour)
            ->map(fn (Trip $t) => $t->actual_departure_at->diffInMinutes($t->actual_arrival_at) - $t->estimated_duration_min)
            ->average();

        return $avgDelayMinutes ? max(0, $avgDelayMinutes) * 0.5 : 0.0;
    }

    /**
     * PRD Bagian 17 formula, verbatim.
     */
    protected function scoreSlot(Carbon $departAt, array $route, float $delayPenalty): array
    {
        $trafficPenalty = ($route['traffic_delay_seconds'] / 60) * 2;
        $isNight = $departAt->hour >= 22 || $departAt->hour < 5;
        $nightPenalty = $isNight ? 50 : 0;

        return [
            'departure_at' => $departAt->toIso8601String(),
            'estimated_arrival_at' => $departAt->copy()->addSeconds($route['travel_time_seconds'])->toIso8601String(),
            'score' => round(100 - $trafficPenalty - $delayPenalty - $nightPenalty, 2),
            'traffic_delay_seconds' => $route['traffic_delay_seconds'],
            'travel_time_seconds' => $route['travel_time_seconds'],
            'distance_meters' => $route['distance_meters'],
            'route_geometry' => $route['route_geometry'],
            'is_night' => $isNight,
        ];
    }

    /**
     * PRD Bagian 5.1 step 4 static text template, e.g.:
     * "06:00 — direkomendasikan, lalu lintas ringan, estimasi tiba 06:45".
     */
    protected function buildReason(array $slot): string
    {
        $level = match (true) {
            $slot['traffic_delay_seconds'] < 300 => 'ringan',
            $slot['traffic_delay_seconds'] < 900 => 'sedang',
            default => 'padat',
        };

        $status = match (true) {
            $slot['is_recommended'] => 'direkomendasikan',
            $slot['is_night'] => 'alternatif, malam hari',
            default => 'alternatif',
        };

        $time = Carbon::parse($slot['departure_at'])->format('H:i');
        $arrival = Carbon::parse($slot['estimated_arrival_at'])->format('H:i');

        return "{$time} — {$status}, lalu lintas {$level}, estimasi tiba {$arrival}";
    }
}
