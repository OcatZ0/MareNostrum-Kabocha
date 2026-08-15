<?php

namespace App\Context;

class NotificationType
{
    public const TRIP_ASSIGNED = 'trip_assigned';
    public const TRIP_CANCELLED = 'trip_cancelled';
    public const TRIP_COMPLETED = 'trip_completed';
    public const ARRIVED_AT_POINT = 'arrived_at_point';
    public const LOCATION_VALIDATION_FAILED = 'location_validation_failed';
    public const SHIP_DEPARTED = 'ship_departed';
    public const SHIP_ARRIVED = 'ship_arrived';
    public const GENERAL = 'general';
}
