<?php

namespace App\Http\Controllers;

use App\Http\Resources\NotificationResource;
use App\Models\Notification;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class NotificationController extends Controller
{
    use ApiResponse;

    #[OA\Get(
        path: '/notifications',
        summary: 'Get paginated list of notifications',
        description: 'Supports unread=true query parameter to fetch only unread notifications (polled by frontend React every 15-30 seconds).',
        tags: ['Notifications'],
        parameters: [
            new OA\Parameter(name: 'unread', in: 'query', required: false, schema: new OA\Schema(type: 'boolean')),
            new OA\Parameter(name: 'user_id', in: 'query', required: false, schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'per_page', in: 'query', required: false, schema: new OA\Schema(type: 'integer', default: 15)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'List of notifications retrieved successfully.'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $query = Notification::query();

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->query('user_id'));
        } elseif ($request->user()) {
            $query->where('user_id', $request->user()->id);
        }

        if ($request->boolean('unread') || $request->query('unread') === 'true') {
            $query->where('is_read', false);
        }

        $perPage = (int) $request->query('per_page', 15);
        $notifications = $query->latest('id')->paginate($perPage);

        $unreadQuery = Notification::where('is_read', false);
        if ($request->filled('user_id')) {
            $unreadQuery->where('user_id', $request->query('user_id'));
        } elseif ($request->user()) {
            $unreadQuery->where('user_id', $request->user()->id);
        }
        $unreadCount = $unreadQuery->count();

        return response()->json([
            'success' => true,
            'message' => 'List of notifications retrieved successfully.',
            'unread_count' => $unreadCount,
            'data' => NotificationResource::collection($notifications),
            'meta' => [
                'current_page' => $notifications->currentPage(),
                'total' => $notifications->total(),
                'per_page' => $notifications->perPage(),
            ],
        ], 200);
    }

    #[OA\Post(
        path: '/notifications/{id}/read',
        summary: 'Mark a single notification as read',
        tags: ['Notifications'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Notification marked as read successfully.'),
            new OA\Response(response: 404, description: 'Notification not found.'),
        ]
    )]
    public function markAsRead(Request $request, int $id): JsonResponse
    {
        $notification = Notification::find($id);

        if (!$notification) {
            return $this->error('Notification not found.', 404);
        }

        $notification->update(['is_read' => true]);

        return $this->success(
            new NotificationResource($notification),
            'Notification marked as read successfully.'
        );
    }

    #[OA\Post(
        path: '/notifications/read-all',
        summary: 'Mark all unread notifications as read',
        tags: ['Notifications'],
        parameters: [
            new OA\Parameter(name: 'user_id', in: 'query', required: false, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'All notifications marked as read successfully.'),
        ]
    )]
    public function markAllAsRead(Request $request): JsonResponse
    {
        $query = Notification::where('is_read', false);

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->query('user_id'));
        } elseif ($request->user()) {
            $query->where('user_id', $request->user()->id);
        }

        $count = $query->update(['is_read' => true]);

        return $this->success(
            ['updated_count' => $count],
            "{$count} notifications marked as read successfully."
        );
    }
}
