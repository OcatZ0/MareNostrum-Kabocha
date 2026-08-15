<?php

use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        //
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (ValidationException $e, $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation error',
                    'errors' => $e->errors(),
                ], 422);
            }
        });

        $exceptions->render(function (AuthenticationException $e, $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthenticated.',
                ], 401);
            }
        });

        // Catches every HTTP-status-carrying exception (abort(403/404/...), 403 from
        // FormRequest::authorize() -> AuthorizationException -> AccessDeniedHttpException,
        // route-model-binding 404s, etc.) — one handler instead of whitelisting each
        // Symfony subclass individually, which is easy to miss (see git history).
        $exceptions->render(function (HttpExceptionInterface $e, $request) {
            if ($request->is('api/*')) {
                // 404 always gets a clean generic message — the raw exception message
                // for a failed route-model-binding leaks the Eloquent model class name
                // (e.g. "No query results for model [App\Models\Trip] 99999").
                $message = $e->getStatusCode() === 404
                    ? 'Not found.'
                    : ($e->getMessage() ?: match ($e->getStatusCode()) {
                        403 => 'Forbidden.',
                        default => 'Error.',
                    });

                return response()->json([
                    'success' => false,
                    'message' => $message,
                ], $e->getStatusCode());
            }
        });
    })->create();
