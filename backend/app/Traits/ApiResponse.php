<?php

namespace App\Traits;

use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

trait ApiResponse
{
    protected function success(mixed $data = null, string $message = 'OK', int $code = 200)
    {
        $payload = [
            'success' => true,
            'message' => $message,
            'data' => $data,
        ];

        if ($data instanceof AnonymousResourceCollection && $data->resource instanceof \Illuminate\Contracts\Pagination\LengthAwarePaginator) {
            $paginator = $data->resource;
            $payload['meta'] = [
                'current_page' => $paginator->currentPage(),
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
            ];
        }

        return response()->json($payload, $code);
    }

    protected function error(string $message, int $code = 400)
    {
        return response()->json([
            'success' => false,
            'message' => $message,
        ], $code);
    }
}
