<?php

namespace App\Context;

class EventType
{
    public const DEPARTED = 'departed';
    public const GPS_PING = 'gps_ping';
    public const ARRIVED_AT_DESTINATION = 'arrived_at_destination';
    public const ARRIVED_AT_PORT = 'arrived_at_port';
    public const SHIP_DEPARTED = 'ship_departed';
    public const SHIP_ARRIVED = 'ship_arrived';
    public const ARRIVED_FINAL = 'arrived_final';
    public const TRUCK_RETURNED = 'truck_returned';
}