<?php

namespace App\Http\Controllers;

use OpenApi\Attributes as OA;

#[OA\Info(
    version: '1.0.0',
    title: 'Mare Nostrum API',
    description: 'Smart Mobility Flow — Batam-Singapore cross-border logistics tracking API.'
)]
#[OA\Server(url: '/api', description: 'API server')]
#[OA\SecurityScheme(
    securityScheme: 'sanctum',
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'Sanctum personal access token',
    description: 'Send as: Authorization: Bearer {token}'
)]
#[OA\Tag(name: 'Trips', description: 'Trip planning, assignment and tracking')]
#[OA\Tag(name: 'Companies', description: 'Company master data (internal + partner)')]
abstract class Controller
{
    //
}
