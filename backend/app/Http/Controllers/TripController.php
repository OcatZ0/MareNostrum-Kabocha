<?php

namespace App\Http\Controllers;

use App\Http\Requests\AssignTripRequest;
use App\Http\Requests\ShipTripRequest;
use App\Http\Requests\SimulateTripRequest;
use App\Http\Requests\StoreTripRequest;
use App\Http\Requests\UpdateTripRequest;
use App\Http\Resources\TripResource;
use App\Models\Notification;
use App\Models\Port;
use App\Models\Trip;
use App\Traits\ApiResponse;
use App\Traits\ResolvesTripPoints;
use Carbon\Carbon;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Pool;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use OpenApi\Attributes as OA;
use RuntimeException;

class TripController extends Controller
{
    use ApiResponse;
    use ResolvesTripPoints;

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
            .'the combo clears any previously computed recommended_slots/distance_km/'
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
        // clearing them rather than leaving stale distance/CO2 attached to a trip that
        // no longer goes where they were calculated for.
        $comboData['recommended_slots'] = null;
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
            .'in a loop. Saves recommended_slots, and copies distance_km/estimated_duration_min from the winning '
            .'slot onto the trip.',
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

        // The 3 ranges are searched as 2 network "waves" total (all ranges' hourly
        // candidates fetched together, then all ranges' refinement candidates fetched
        // together), not 3 ranges x 2 waves each = 6 sequential waves. Ranges searched
        // independently one after another (each internally already concurrent) still
        // added up past PHP's max_execution_time, since it's the number of sequential
        // network round trips that matters, not how each one is fetched.
        $ranges = collect($this->searchRanges)->map(fn (array $range) => [
            'start' => $date->copy()->addDays($range['start_day_offset'])->setTime($range['start_hour'], 0),
            'end' => $date->copy()->addDays($range['end_day_offset'])->setTime($range['end_hour'], 0),
        ]);

        // Fetched once and reused for every candidate below (historicalDelayPenalty()),
        // not re-queried per candidate, see historicalTripsForRoute()'s docblock.
        $historicalTrips = $this->historicalTripsForRoute($trip);

        try {
            $hourlySlotsByRange = $ranges->map(fn (array $r) => $this->buildHourlySlots($r['start'], $r['end']));
            $hourlyRoutes = $this->fetchRoutes($origin, $destination, $hourlySlotsByRange->flatten(1)->all());

            // Baseline for traffic_penalty (scoreSlot()): the fastest travel_time_seconds
            // among all hourly candidates across all 3 ranges. Established once here and
            // reused for refinement candidates below too (not recomputed per phase), so
            // both phases' scores stay on the same scale, needed for the final
            // hourlyEvaluated->merge($refinementEvaluated)->sortByDesc('score') to be a
            // fair comparison rather than comparing scores computed against 2 different
            // baselines.
            $fastestTravelTimeSeconds = collect($hourlyRoutes)->min('travel_time_seconds');

            $hourlyEvaluatedByRange = $hourlySlotsByRange->map(
                fn (Collection $slots) => $this->evaluateCandidates($historicalTrips, $slots, $hourlyRoutes, $timezone, $fastestTravelTimeSeconds)
            );

            $refinementSlotsByRange = $hourlyEvaluatedByRange->map(function (Collection $evaluated, int $i) use ($ranges) {
                $bestHour = Carbon::parse($evaluated->sortByDesc('score')->first()['departure_at']);

                return $this->refinementSlotsAround($bestHour, $ranges[$i]['start'], $ranges[$i]['end']);
            });

            $allRefinementSlots = $refinementSlotsByRange->flatten(1);
            $refinementRoutes = $allRefinementSlots->isNotEmpty()
                ? $this->fetchRoutes($origin, $destination, $allRefinementSlots->all())
                : [];

            $slots = $hourlyEvaluatedByRange->map(function (Collection $hourlyEvaluated, int $i) use ($refinementSlotsByRange, $refinementRoutes, $historicalTrips, $timezone, $fastestTravelTimeSeconds) {
                $refinementEvaluated = $this->evaluateCandidates($historicalTrips, $refinementSlotsByRange[$i], $refinementRoutes, $timezone, $fastestTravelTimeSeconds);

                return $hourlyEvaluated->merge($refinementEvaluated)->sortByDesc('score')->first();
            })->values();
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
            unset($slot['is_night'], $slot['distance_meters']);

            return $slot;
        })->values()->all();

        $trip->update([
            'recommended_slots' => $persistedSlots,
            'distance_km' => round($winner['distance_meters'] / 1000, 2),
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

    #[OA\Post(
        path: '/trips/{id}/simulate',
        summary: 'Simulate a custom departure time against the trip\'s nearest recommended slot',
        description: 'Admin only, draft trips only, requires /recommend to have been called first since this '
            .'compares against recommended_slots. Scores departure_at exactly like /recommend scores its own '
            .'candidates (PRD Bagian 17: traffic_penalty from a live TomTom Calculate Route call, delay_penalty '
            .'from route history, night_penalty), then diffs it against whichever recommended_slots entry is '
            .'closest in time. Read-only, nothing is persisted to the trip, call /assign separately to actually '
            .'commit to a departure time.',
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['departure_at'],
                properties: [
                    new OA\Property(property: 'departure_at', type: 'string', format: 'date-time', description: 'Any future timestamp, not restricted to one of recommended_slots.'),
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
                        new OA\Property(property: 'message', type: 'string', example: 'Simulasi selesai'),
                        new OA\Property(property: 'data', properties: [
                            new OA\Property(property: 'simulated', type: 'object', description: 'Same shape as one recommended_slots entry.'),
                            new OA\Property(property: 'nearest_recommended', type: 'object', description: 'The closest-in-time recommended_slots entry being compared against.'),
                            new OA\Property(property: 'diff', properties: [
                                new OA\Property(property: 'score', type: 'number', description: 'simulated.score - nearest_recommended.score'),
                                new OA\Property(property: 'travel_time_seconds', type: 'integer', description: 'simulated - nearest_recommended, negative means the simulated slot is faster'),
                                new OA\Property(property: 'distance_km', type: 'number', description: 'simulated - nearest_recommended'),
                                new OA\Property(property: 'minutes_from_nearest_recommended', type: 'integer', description: 'Positive means departure_at is later than nearest_recommended, negative means earlier'),
                            ], type: 'object'),
                        ], type: 'object'),
                    ]
                )
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Forbidden, admin only'),
            new OA\Response(response: 404, description: 'Trip not found'),
            new OA\Response(response: 422, description: 'Validation error, trip is not draft, or /recommend has not been called yet'),
            new OA\Response(response: 502, description: 'TomTom API request failed'),
        ]
    )]
    public function simulate(SimulateTripRequest $request, Trip $trip)
    {
        if ($trip->status !== 'draft') {
            return $this->error('Simulasi hanya bisa dilakukan selagi trip berstatus draft.', 422);
        }

        if (empty($trip->recommended_slots)) {
            return $this->error('Trip belum punya rekomendasi, panggil /recommend dulu.', 422);
        }

        $trip->loadMissing(['originCompany', 'originPort', 'destinationCompany', 'destinationPort']);

        $origin = $this->resolvePoint($trip, 'origin');
        $destination = $this->resolvePoint($trip, 'destination');
        $timezone = $this->resolveTimezone($trip);
        // If the client's departure_at string carries an explicit offset (e.g. a UTC 'Z'
        // suffix), Carbon::parse() uses that offset and ignores the $timezone argument
        // entirely (it only applies to naive/no-offset input) — the object would stay in
        // whatever zone the client sent, silently wrong for every hour-based check below
        // (night_penalty, historicalDelayPenalty's hour match). Force-normalize to the
        // trip's own timezone after parsing, same pattern already used for
        // actual_departure_at elsewhere in this class.
        $departAt = Carbon::parse($request->input('departure_at'), $timezone)->setTimezone($timezone);

        try {
            $routes = $this->fetchRoutes($origin, $destination, [$departAt]);
        } catch (RuntimeException $e) {
            return $this->error('Gagal menghubungi TomTom API: '.$e->getMessage(), 502);
        }

        $historicalTrips = $this->historicalTripsForRoute($trip);

        // Same baseline the trip's own recommended_slots were scored against (that
        // request already guarded recommended_slots isn't empty), keeps this simulated
        // slot's score on the same scale as what it's being diffed against below.
        $fastestTravelTimeSeconds = collect($trip->recommended_slots)->min('travel_time_seconds');

        $simulated = $this->scoreSlotAt($historicalTrips, $departAt, $routes[$departAt->toIso8601String()], $timezone, $fastestTravelTimeSeconds);
        $simulated['is_recommended'] = false;
        $simulated['reason'] = $this->buildReason($simulated);
        $simulated['distance_km'] = round($simulated['distance_meters'] / 1000, 2);
        unset($simulated['is_night'], $simulated['distance_meters']);

        // Closest in time, not highest-scoring — the point is comparing this specific
        // custom departure_at against whichever official recommendation it's actually
        // standing in for, not against whichever recommended slot happens to score best.
        $nearest = collect($trip->recommended_slots)->sortBy(
            fn (array $slot) => abs(Carbon::parse($slot['departure_at'])->timestamp - $departAt->timestamp)
        )->first();

        $diff = [
            'score' => round($simulated['score'] - $nearest['score'], 2),
            'travel_time_seconds' => $simulated['travel_time_seconds'] - $nearest['travel_time_seconds'],
            'distance_km' => round($simulated['distance_km'] - $nearest['distance_km'], 2),
            'minutes_from_nearest_recommended' => (int) round(($departAt->timestamp - Carbon::parse($nearest['departure_at'])->timestamp) / 60),
        ];

        return $this->success([
            'simulated' => $simulated,
            'nearest_recommended' => $nearest,
            'diff' => $diff,
        ], 'Simulasi selesai');
    }

    #[OA\Post(
        path: '/trips/{id}/ship',
        summary: 'Set or update the vessel reference id for a cross-border trip',
        description: 'Admin only. Only valid on cross-border trips (ship_destination_port_id set, PRD Bagian '
            .'5.1 step 6); rejects trips without a ship leg. ship_ref_id is the MMSI or IMO number of the vessel '
            .'used for the Batam-Singapore crossing, later used to poll VesselAPI Port Events (Bagian 8.2, via '
            .'/ship-status). Can be called again to correct the value (PRD Bagian 4 nice-to-have #11) as long as '
            .'the trip is not yet completed or cancelled, unlike /assign it is not restricted to draft status.',
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['ship_ref_id'],
                properties: [
                    new OA\Property(property: 'ship_ref_id', type: 'string', description: 'MMSI (9 digits) or IMO number (7 digits, optionally prefixed "IMO").', example: '563123456'),
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
                        new OA\Property(property: 'message', type: 'string', example: 'Ship reference id disimpan'),
                        new OA\Property(property: 'data', ref: '#/components/schemas/Trip'),
                    ]
                )
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Forbidden, admin only'),
            new OA\Response(response: 404, description: 'Trip not found'),
            new OA\Response(response: 422, description: 'Validation error, trip is not cross-border, or trip is already completed/cancelled'),
        ]
    )]
    public function ship(ShipTripRequest $request, Trip $trip)
    {
        if (! $trip->ship_destination_port_id) {
            return $this->error('ship_ref_id hanya berlaku untuk trip lintas negara.', 422);
        }

        if (in_array($trip->status, ['completed', 'cancelled'], true)) {
            return $this->error('Trip sudah selesai atau dibatalkan, ship_ref_id tidak bisa diubah.', 422);
        }

        $trip->update([
            'ship_ref_id' => $request->input('ship_ref_id'),
        ]);

        return $this->success(new TripResource($trip->load($this->with)), 'Ship reference id disimpan');
    }

    #[OA\Get(
        path: '/trips/{id}/position',
        summary: 'Get the trip\'s current live position for a map marker',
        description: 'Admin can view any trip. Driver can only view a trip assigned to them. Intended to be '
            .'polled every 15-30s (PRD Bagian 15) — kept lightweight, single point only. Source switches '
            .'automatically: status=on_ship queries VesselAPI\'s live vessel position by ship_ref_id (separate '
            .'from Bagian 8.2\'s Port Events, which is for arrival detection via /ship-status, not built yet); '
            .'any other status returns the most recent GPS checkpoint. Falls back to the last known GPS '
            .'checkpoint if VesselAPI has no current data for the vessel (e.g. temporarily out of AIS range) or '
            .'the request fails — a moving marker with slightly stale data beats no marker at all on an endpoint '
            .'polled this frequently.',
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
                        new OA\Property(property: 'data', type: 'object', properties: [
                            new OA\Property(property: 'lat', type: 'number', format: 'float'),
                            new OA\Property(property: 'lng', type: 'number', format: 'float'),
                            new OA\Property(property: 'recorded_at', type: 'string', format: 'date-time'),
                            new OA\Property(property: 'source', type: 'string', enum: ['gps', 'api'], description: 'gps = last trip_checkpoints GPS ping, api = live VesselAPI vessel position.'),
                        ]),
                    ]
                )
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Forbidden — trip not assigned to this driver'),
            new OA\Response(response: 404, description: 'Trip not found, or no position data recorded for this trip yet'),
        ]
    )]
    public function position(Request $request, Trip $trip)
    {
        if ($request->user()->role !== 'admin' && $trip->driver_id !== $request->user()->id) {
            abort(403, 'Trip ini bukan milik Anda.');
        }

        if ($trip->status === 'on_ship' && $trip->ship_ref_id) {
            $position = $this->fetchVesselPosition($trip->ship_ref_id);

            if ($position) {
                return $this->success($position);
            }
        }

        $checkpoint = $trip->checkpoints()
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->latest('recorded_at')
            ->first();

        if (! $checkpoint) {
            return $this->error('Belum ada data posisi untuk trip ini.', 404);
        }

        return $this->success([
            'lat' => (float) $checkpoint->latitude,
            'lng' => (float) $checkpoint->longitude,
            'recorded_at' => $checkpoint->recorded_at->toIso8601String(),
            'source' => 'gps',
        ]);
    }

    /**
     * VesselAPI live vessel position (PRD Bagian 8.2's Port Events is a different
     * endpoint, for arrival detection — this is /v1/vessel/{id}/position, verified
     * directly against the real API since VesselAPI's own docs summary omitted the
     * response's `vesselPosition` wrapper key). ship_ref_id may be either an MMSI (9
     * digits) or an IMO number (7 digits, optionally "IMO"-prefixed) per
     * ShipTripRequest's validation — VesselAPI needs to know which via filter.idType.
     * Returns null on any failure (no data for this vessel right now, bad response,
     * network error) so the caller falls back to the last GPS checkpoint instead of
     * surfacing an error on an endpoint meant to be polled every 15-30s.
     */
    protected function fetchVesselPosition(string $shipRefId): ?array
    {
        $id = preg_replace('/^IMO/i', '', $shipRefId);
        $idType = strlen($id) === 7 ? 'imo' : 'mmsi';

        try {
            $response = Http::withHeaders(['Authorization' => 'Bearer '.config('services.vesselapi.key')])
                ->get("https://api.vesselapi.com/v1/vessel/{$id}/position", ['filter.idType' => $idType]);
        } catch (ConnectionException) {
            return null;
        }

        $position = $response->json('vesselPosition');

        if (! $response->successful() || ! $position) {
            return null;
        }

        return [
            'lat' => (float) $position['latitude'],
            'lng' => (float) $position['longitude'],
            'recorded_at' => $position['timestamp'],
            'source' => 'api',
        ];
    }

    #[OA\Get(
        path: '/trips/{id}/ship-status',
        summary: 'Poll for the ship\'s arrival at the destination port',
        description: 'Admin can view any trip. Driver can only view a trip assigned to them. Meaningful only '
            .'while status=on_ship — polls VesselAPI Port Events (PRD Bagian 8.2) filtered by '
            .'ship_destination_port_id\'s unlocode, checking for an arrival event matching ship_ref_id. On a '
            .'match, updates the trip to at_destination_port, records a ship_arrived checkpoint, and notifies '
            .'the driver — tracking ends there (Bagian 5.3: Company A does not track partner trucks on the '
            .'other side of the border). If Port Events has no matching data, falls back to Haversine distance '
            .'(Bagian 18) between the ship\'s last known live position and the destination port\'s coordinates, '
            .'considered arrived within 500m. Intended to be polled every 15-30s like /position; any status '
            .'other than on_ship is a no-op that just reports the trip\'s current status.',
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
                        new OA\Property(property: 'data', type: 'object', properties: [
                            new OA\Property(property: 'status', type: 'string', example: 'on_ship'),
                            new OA\Property(property: 'arrived', type: 'boolean', description: 'True only on the call that just detected arrival.'),
                            new OA\Property(property: 'source', type: 'string', nullable: true, enum: ['port_events', 'haversine_fallback'], description: 'How arrival was detected; null if not arrived (yet).'),
                        ]),
                    ]
                )
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Forbidden — trip not assigned to this driver'),
            new OA\Response(response: 404, description: 'Trip not found'),
        ]
    )]
    public function shipStatus(Request $request, Trip $trip)
    {
        if ($request->user()->role !== 'admin' && $trip->driver_id !== $request->user()->id) {
            abort(403, 'Trip ini bukan milik Anda.');
        }

        if ($trip->status !== 'on_ship' || ! $trip->ship_ref_id || ! $trip->ship_destination_port_id) {
            return $this->success(['status' => $trip->status, 'arrived' => false, 'source' => null]);
        }

        $trip->loadMissing('shipDestinationPort');
        $port = $trip->shipDestinationPort;

        $source = $this->checkPortEventsArrival($trip, $port)
            ? 'port_events'
            : ($this->checkHaversineArrival($trip, $port) ? 'haversine_fallback' : null);

        if (! $source) {
            return $this->success(['status' => $trip->status, 'arrived' => false, 'source' => null]);
        }

        $this->markShipArrived($trip, $source);

        return $this->success(['status' => $trip->fresh()->status, 'arrived' => true, 'source' => $source]);
    }

    /**
     * PRD Bagian 8.2. Verified directly against the real API since the PRD's documented
     * `GET /portEvents` (camelCase) 404s — the actual path is lowercase `/portevents`,
     * response wrapped under a `portEvents` array with `vessel.mmsi`/`vessel.imo` and
     * `port.unlo_code` fields. Matches ship_ref_id against either vessel field since we
     * don't track which format (MMSI or IMO) a given trip's ship_ref_id is in.
     */
    protected function checkPortEventsArrival(Trip $trip, Port $port): bool
    {
        $shipRefId = preg_replace('/^IMO/i', '', $trip->ship_ref_id);

        try {
            $response = Http::withHeaders(['Authorization' => 'Bearer '.config('services.vesselapi.key')])
                ->get('https://api.vesselapi.com/v1/portevents', [
                    'filter.unlocode' => $port->unlocode,
                    'filter.eventType' => 'arrival',
                    'pagination.limit' => 50,
                ]);
        } catch (ConnectionException) {
            return false;
        }

        if (! $response->successful()) {
            return false;
        }

        return collect($response->json('portEvents', []))->contains(
            fn (array $event) => (string) ($event['vessel']['mmsi'] ?? null) === $shipRefId
                || (string) ($event['vessel']['imo'] ?? null) === $shipRefId
        );
    }

    /**
     * PRD Bagian 8.2/18 fallback: Port Events gave no match, so check the ship's last
     * live position (same VesselAPI position lookup /position uses) against the
     * destination port's coordinates, within 500m per Bagian 5.3 step 3 — a different,
     * looser radius than the 100m used for GPS-based truck arrival checks elsewhere,
     * intentionally, not an oversight.
     */
    protected function checkHaversineArrival(Trip $trip, Port $port): bool
    {
        $position = $this->fetchVesselPosition($trip->ship_ref_id);

        if (! $position) {
            return false;
        }

        $distance = $this->haversineDistanceMeters(
            $position['lat'], $position['lng'], (float) $port->latitude, (float) $port->longitude
        );

        return $distance <= 500;
    }

    protected function markShipArrived(Trip $trip, string $source): void
    {
        $trip->update([
            'status' => 'at_destination_port',
            'actual_arrival_at' => now(),
        ]);

        $trip->checkpoints()->create([
            'event_type' => 'ship_arrived',
            'source' => 'api',
            'recorded_at' => now(),
        ]);

        Notification::create([
            'user_id' => $trip->driver_id,
            'trip_id' => $trip->id,
            'type' => 'ship_arrived',
            'message' => "Kapal untuk trip #{$trip->id} telah tiba di pelabuhan tujuan (via {$source}).",
        ]);
    }

    /**
     * Coarse-to-fine candidate generation for a single range: hourly first (kept at
     * full hourly resolution, this is what actually locates a genuinely good hour, so
     * it's not the granularity that got trimmed), then refined +/-30min in 15-min
     * steps around whichever hour scored best. Trimmed from +/-45min (6 refinement
     * candidates) to +/-30min (4) purely to cut TomTom call volume, TomTom's routing
     * API rate-limits to roughly 4-6 req/sec regardless of how the calls are paced, so
     * fewer total calls was the only remaining lever after concurrency and pacing had
     * already been tuned. recommend() fetches every range's hourly candidates
     * together, then every range's refinement candidates together (2 network waves
     * total instead of 3 ranges x 2 waves each), since it's the number of sequential
     * waves that risked PHP's max_execution_time, not how each individual wave is
     * fetched.
     */
    protected function buildHourlySlots(Carbon $start, Carbon $end): Collection
    {
        $slots = collect();
        $cursor = $start->copy();

        while ($cursor->lt($end)) {
            $slots->push($cursor->copy());
            $cursor->addHour();
        }

        return $slots;
    }

    protected function refinementSlotsAround(Carbon $bestHour, Carbon $start, Carbon $end): Collection
    {
        return collect([-30, -15, 15, 30])
            ->map(fn (int $offsetMinutes) => $bestHour->copy()->addMinutes($offsetMinutes))
            ->filter(fn (Carbon $candidate) => $candidate->gte($start) && $candidate->lt($end))
            ->values();
    }

    /**
     * @param  array<string, array>  $routesByIso  keyed by departAt->toIso8601String(), as returned by fetchRoutes()
     */
    protected function evaluateCandidates(Collection $historicalTrips, Collection $departAts, array $routesByIso, string $timezone, int $fastestTravelTimeSeconds): Collection
    {
        return $departAts->map(
            fn (Carbon $departAt) => $this->scoreSlotAt($historicalTrips, $departAt, $routesByIso[$departAt->toIso8601String()], $timezone, $fastestTravelTimeSeconds)
        );
    }

    protected function scoreSlotAt(Collection $historicalTrips, Carbon $departAt, array $route, string $timezone, int $fastestTravelTimeSeconds): array
    {
        $delay = $this->historicalDelayPenalty($historicalTrips, $departAt->hour, $timezone);

        return $this->scoreSlot($departAt, $route, $delay, $fastestTravelTimeSeconds);
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
     * How many TomTom Calculate Route calls to fire in each paced chunk. Observed
     * empirically via TomTom's own 429 Retry-After header (1 second): their limit is a
     * requests-per-second window, not a max-simultaneous-connections cap, so this is
     * also how many requests ROUTE_FETCH_PACING_MICROSECONDS is sized to safely fit in
     * one window (5 of 6 concurrent succeeded, 6 of 8 succeeded, in separate bursts).
     * Any stragglers that still get rate-limited are retried on a later paced pass
     * rather than pushed to a larger chunk.
     */
    protected const ROUTE_FETCH_CONCURRENCY = 5;

    /**
     * Gap enforced before every chunk after the first. Reacting to 429s after the fact
     * (retry with backoff) was tried first and made things worse: a guessed backoff
     * shorter than TomTom's real 1-second window let retries collide with the same
     * still-active window and cascade into more 429s than the original burst caused.
     * Pacing our own send rate up front avoids hitting the limit in the first place.
     */
    protected const ROUTE_FETCH_PACING_MICROSECONDS = 1_000_000;

    /**
     * PRD Bagian 8.1: one Calculate Route call yields travel time + traffic delay
     * (scoring) and length (distance_km), cached per PRD Bagian 10 risk mitigation so
     * repeated/identical requests don't burn the 2,500/day TomTom quota. Every
     * requested departAt not already cached is fetched in small
     * chunks (Http::pool), each chunk concurrent internally but paced a full second
     * apart from the next (see ROUTE_FETCH_PACING_MICROSECONDS), rather than one call
     * at a time (sequential fetching of the 12-18 calls a single range needs was slow
     * enough to blow past PHP's max_execution_time on its own) and rather than firing
     * every chunk back to back (still fast enough in aggregate to exceed TomTom's
     * per-second rate limit even with small individual chunks). Any request that still
     * comes back 429 or connection-failed is retried on a later pass, using the same
     * pacing, up to a few passes.
     *
     * @param  Carbon[]  $departAts
     * @return array<string, array>  keyed by $departAt->toIso8601String()
     */
    protected function fetchRoutes(array $origin, array $destination, array $departAts): array
    {
        // Normalize to UTC for the cache key: two different real moments that happen to
        // share the same clock digits in different timezones (e.g. 06:00 WIB vs 06:00
        // SGT are 1 hour apart in reality) must never collide in the cache.
        $keyedByCacheKey = collect($departAts)->mapWithKeys(fn (Carbon $departAt) => [
            $this->routeCacheKey($origin, $destination, $departAt) => $departAt,
        ]);

        $routesByCacheKey = $keyedByCacheKey->keys()->mapWithKeys(fn (string $key) => [$key => Cache::get($key)]);
        $pending = $routesByCacheKey->filter(fn ($route) => $route === null)->keys();
        $isFirstChunk = true;

        for ($pass = 0; $pending->isNotEmpty() && $pass < 3; $pass++) {
            foreach ($pending->chunk(self::ROUTE_FETCH_CONCURRENCY) as $chunk) {
                if (! $isFirstChunk) {
                    usleep(self::ROUTE_FETCH_PACING_MICROSECONDS);
                }
                $isFirstChunk = false;

                $responses = Http::pool(fn (Pool $pool) => $chunk->map(
                    fn (string $key) => $pool->as($key)->timeout(15)->get(sprintf(
                        'https://api.tomtom.com/routing/1/calculateRoute/%s,%s:%s,%s/json',
                        $origin['lat'], $origin['lng'], $destination['lat'], $destination['lng']
                    ), [
                        // Explicit UTC offset (P), not a naive local-looking string, leaving it
                        // out risks TomTom interpreting the timestamp in the wrong zone, the same
                        // class of bug as the app.timezone issue, just at the API boundary instead.
                        'departAt' => $keyedByCacheKey[$key]->format('Y-m-d\TH:i:sP'),
                        'traffic' => 'true',
                        // We only ever read routes[0].summary (travel time, traffic delay,
                        // distance), never the geometry, frontend gets its own route straight
                        // from TomTom's RoutingModule instead of a stored polyline (Bagian 8.6).
                        // summaryOnly skips the points/encodedPolyline fields server-side, so
                        // there's less for TomTom to compute and send, and less for us to parse.
                        'routeRepresentation' => 'summaryOnly',
                        'key' => config('services.tomtom.key'),
                    ])
                )->all());

                foreach ($chunk as $key) {
                    $response = $responses[$key];

                    // Http::pool() returns a ConnectionException in place of a Response for a
                    // request that failed at the transport level (timeout, reset, etc.) rather
                    // than throwing, so ->status() isn't callable, treat it the same as a 429:
                    // transient, retry on the next pass.
                    if ($response instanceof ConnectionException || $response->status() === 429) {
                        continue;
                    }

                    if ($response->failed()) {
                        throw new RuntimeException("HTTP {$response->status()}: {$response->body()}");
                    }

                    $route = $response->json('routes.0');

                    if (! $route) {
                        throw new RuntimeException('TomTom returned no route for this origin/destination.');
                    }

                    $parsedRoute = [
                        'travel_time_seconds' => $route['summary']['travelTimeInSeconds'],
                        'traffic_delay_seconds' => $route['summary']['trafficDelayInSeconds'] ?? 0,
                        'distance_meters' => $route['summary']['lengthInMeters'],
                    ];

                    Cache::put($key, $parsedRoute, now()->addMinutes(15));
                    $routesByCacheKey[$key] = $parsedRoute;
                }
            }

            $pending = $pending->reject(fn (string $key) => $routesByCacheKey[$key] !== null)->values();
        }

        if ($pending->isNotEmpty()) {
            throw new RuntimeException('TomTom rate limit sedang tercapai, coba lagi sebentar lagi.');
        }

        return $keyedByCacheKey->mapWithKeys(fn (Carbon $departAt, string $key) => [
            $departAt->toIso8601String() => $routesByCacheKey[$key],
        ])->all();
    }

    protected function routeCacheKey(array $origin, array $destination, Carbon $departAt): string
    {
        return sprintf(
            'tomtom_route:%s,%s:%s,%s:%s',
            $origin['lat'], $origin['lng'], $destination['lat'], $destination['lng'], $departAt->clone()->utc()->format('Y-m-d\TH:i')
        );
    }

    /**
     * PRD Bagian 17 delay_penalty source data: completed trips on this exact route,
     * fetched once per /recommend call and reused for every candidate's
     * historicalDelayPenalty() rather than re-querying per candidate. The query itself
     * doesn't depend on departure hour (only the later in-memory filter does), so
     * re-running it ~35 times (once per hourly + refinement candidate) was ~35 extra
     * network round trips to the Supabase pooler on top of the TomTom fetching, a real
     * contributor to /recommend timing out that concurrency/pacing alone couldn't fix.
     */
    protected function historicalTripsForRoute(Trip $trip): Collection
    {
        return Trip::query()
            ->where('status', 'completed')
            ->where('origin_company_id', $trip->origin_company_id)
            ->where('origin_port_id', $trip->origin_port_id)
            ->where('destination_company_id', $trip->destination_company_id)
            ->where('destination_port_id', $trip->destination_port_id)
            ->whereNotNull('actual_departure_at')
            ->whereNotNull('actual_arrival_at')
            ->whereNotNull('estimated_duration_min')
            // Needed by actualTravelDurationSeconds() for round-trip/cross-border route
            // shapes (leg-sum from checkpoint timestamps), eager-loaded here rather than
            // lazily per trip to avoid an N+1 when there's real history to iterate.
            ->with('checkpoints')
            ->get();
    }

    /**
     * PRD Bagian 17 delay_penalty: average historical delay (actual - estimated
     * duration, in minutes) for completed trips on this exact route that departed at
     * this exact hour. Zero if no matching history exists yet.
     */
    /**
     * @return array{penalty: float, sample_size: int}  sample_size lets the caller show
     *         whether this penalty is backed by real history or just defaulted to 0 for
     *         lack of data, the two look identical as a bare number otherwise.
     */
    protected function historicalDelayPenalty(Collection $historicalTrips, int $hour, string $timezone): array
    {
        $matching = $historicalTrips
            // actual_departure_at is stored UTC — convert to the trip's local timezone
            // before reading ->hour, or a Batam trip's "hour" would silently be wrong
            // the same way the original app.timezone bug was.
            ->filter(fn (Trip $t) => $t->actual_departure_at->clone()->setTimezone($timezone)->hour === $hour);

        $avgDelayMinutes = $matching
            ->map(function (Trip $t) {
                $actualSeconds = $this->actualTravelDurationSeconds($t);

                return $actualSeconds !== null ? ($actualSeconds / 60) - $t->estimated_duration_min : null;
            })
            // A trip can match the route+hour filter above yet still be excluded here,
            // e.g. a cross-border trip whose truck_returned_at checkpoint isn't recorded
            // yet, that trip contributes no delay data until its own duration is known.
            ->filter(fn (?float $delay) => $delay !== null)
            ->average();

        return [
            'penalty' => $avgDelayMinutes ? max(0, $avgDelayMinutes) * 0.5 : 0.0,
            'sample_size' => $matching->count(),
        ];
    }

    /**
     * Actual travel time, dwell/wait time excluded, seconds. Derivation depends on route
     * shape (hasTruckReturnLeg(), ResolvesTripPoints trait):
     *  - one-way: single diff, actual_departure_at to actual_arrival_at (no dwell exists
     *    to exclude, there's only one leg).
     *  - domestic round-trip / cross-border: sum of 2 legs from trip_checkpoints, the gap
     *    between leg1's end (arrived_at_destination/arrived_at_port) and leg2's start (the
     *    2nd departed event) is dwell time at the destination/port and is never summed, so
     *    it's excluded by construction rather than subtracted out.
     * Null if the trip hasn't reached the checkpoint this needs yet (e.g. a cross-border
     * trip whose truck hasn't returned), the caller treats that as "no data" and skips it
     * rather than guessing.
     */
    protected function actualTravelDurationSeconds(Trip $trip): ?int
    {
        if (! $trip->actual_departure_at) {
            return null;
        }

        if (! $this->hasTruckReturnLeg($trip)) {
            return $trip->actual_arrival_at
                ? $trip->actual_departure_at->diffInSeconds($trip->actual_arrival_at)
                : null;
        }

        $isCrossBorder = $trip->ship_destination_port_id !== null;
        $leg1EndEvent = $isCrossBorder ? 'arrived_at_port' : 'arrived_at_destination';
        $leg2EndEvent = $isCrossBorder ? 'truck_returned' : 'arrived_final';

        $leg1End = $trip->checkpoints->firstWhere('event_type', $leg1EndEvent);
        $leg2End = $trip->checkpoints->firstWhere('event_type', $leg2EndEvent);
        $departedEvents = $trip->checkpoints->where('event_type', 'departed')->sortBy('recorded_at')->values();

        if (! $leg1End || ! $leg2End || $departedEvents->count() < 2) {
            return null;
        }

        $leg1Seconds = $departedEvents[0]->recorded_at->diffInSeconds($leg1End->recorded_at);
        $leg2Seconds = $departedEvents[1]->recorded_at->diffInSeconds($leg2End->recorded_at);

        return $leg1Seconds + $leg2Seconds;
    }

    /**
     * PRD Bagian 17 formula, breakdown exposes the raw terms behind the final score
     * (not just the net number) so an admin can see why a slot scored what it did, not
     * just trust it.
     *
     * traffic_penalty deviates from the PRD's literal trafficDelayInSeconds-only
     * formula: TomTom's trafficDelayInSeconds only flags delay from incidents/
     * congestion above its own baseline, it stays 0 even when travel_time_seconds
     * itself genuinely differs between candidates from ordinary time-of-day traffic
     * modeling (observed: two same-route candidates both reporting 0 traffic delay,
     * one still ~2 minutes faster than the other). A formula that only reads
     * trafficDelayInSeconds is blind to that difference and can tie candidates that
     * aren't actually equal, sortByDesc('score')->first() then just keeps whichever
     * was evaluated first, not whichever is fastest. Penalizing relative to the
     * fastest travel_time_seconds in the batch being compared fixes this: the fastest
     * candidate always scores traffic_penalty=0, everything else is penalized
     * proportional to its real time cost, ties only happen when candidates are
     * genuinely equal.
     */
    protected function scoreSlot(Carbon $departAt, array $route, array $delay, int $fastestTravelTimeSeconds): array
    {
        $trafficPenalty = max(0, $route['travel_time_seconds'] - $fastestTravelTimeSeconds) / 60 * 2;
        $isNight = $departAt->hour >= 22 || $departAt->hour < 5;
        $nightPenalty = $isNight ? 50 : 0;
        $delayPenalty = $delay['penalty'];

        return [
            'departure_at' => $departAt->toIso8601String(),
            'estimated_arrival_at' => $departAt->copy()->addSeconds($route['travel_time_seconds'])->toIso8601String(),
            'score' => round(100 - $trafficPenalty - $delayPenalty - $nightPenalty, 2),
            'breakdown' => [
                'base' => 100,
                'traffic_penalty' => round($trafficPenalty, 2),
                'delay_penalty' => round($delayPenalty, 2),
                'night_penalty' => $nightPenalty,
                'historical_sample_size' => $delay['sample_size'],
            ],
            'traffic_delay_seconds' => $route['traffic_delay_seconds'],
            'travel_time_seconds' => $route['travel_time_seconds'],
            'distance_meters' => $route['distance_meters'],
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
