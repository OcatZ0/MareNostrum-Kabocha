<?php

namespace App\Context;

class VesselScheduleStatus
{
    public const SCHEDULED = 'scheduled';
    public const DEPARTED = 'departed';
    public const ON_TIME = 'on_time';
    public const DELAYED = 'delayed';
    public const EARLY = 'early';
    public const BERTHING = 'berthing';
    public const ARRIVED = 'arrived';
    public const CANCELLED = 'cancelled';

    public static function all(): array
    {
        return [
            self::SCHEDULED,
            self::DEPARTED,
            self::ON_TIME,
            self::DELAYED,
            self::EARLY,
            self::BERTHING,
            self::ARRIVED,
            self::CANCELLED,
        ];
    }
}
