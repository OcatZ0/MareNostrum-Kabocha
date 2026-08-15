<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * TEMPORARY — replaces `auth:sanctum` on API routes while POST /api/login (PRD Bagian
 * 14, Backend 1) doesn't exist yet. If a Bearer token is present, resolves the user
 * via the sanctum guard as usual (so real tokens — e.g. a driver's — still test role
 * scoping correctly). If no token is present, defaults to the seeded admin user
 * instead of rejecting the request with 401.
 *
 * REMOVE THIS and restore `auth:sanctum` in routes/api.php once login exists.
 */
class BypassAuthForTesting
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user() ?? ($request->bearerToken()
            ? auth('sanctum')->user()
            : null);

        $request->setUserResolver(fn () => $user ?? User::where('username', 'admin')->first());

        return $next($request);
    }
}
