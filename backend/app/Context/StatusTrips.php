<?php

namespace App\Context;

class StatusTrips
{
    public const DRAFT = 'draft';
    public const ASSIGNED = 'assigned';
    public const IN_TRANSIT_ORIGIN = 'in_transit_origin';
    public const AT_ORIGIN_PORT = 'at_origin_port';
    public const ON_SHIP = 'on_ship';
    public const AT_DESTINATION_PORT = 'at_destination_port';
    public const IN_TRANSIT_DESTINATION = 'in_transit_destination';
    public const ARRIVED = 'arrived';
    public const COMPLETED = 'completed';
    public const CANCELLED = 'cancelled';
}