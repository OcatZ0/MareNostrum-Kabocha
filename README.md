# Mare Nostrum

**Our sea, our trade.** Smart cross-border logistics visibility for shipments moving between Batam and Singapore.

🔗 **Live demo:** https://mare-nostrum-tau.vercel.app/

Built for the Politeknik Negeri Batam Hackathon by **Team Kabocha**.

## The problem

Congestion in Batam's industrial corridors (Sudirman, Yos Sudarso), ferry/port traffic at peak hours, and near-zero visibility once a shipment leaves the warehouse all push admins toward scheduling on guesswork instead of data. Mare Nostrum gives a single dashboard to plan, schedule, and track shipments end-to-end — trucks on land, ships at sea — from a Batam warehouse to a Singapore berth.

## How it works

1. **Plan & traffic routing** — admin picks origin and destination; the system pulls real-time TomTom traffic data to estimate travel time.
2. **Schedule & slot recommendation** — the system generates 3 departure time options scored on live traffic and historical delay data, then admin assigns a truck, driver, and (for cross-border trips) a vessel reference.
3. **Track on land** — the driver activates GPS on departure; arrival is confirmed automatically once the truck enters a 100m geofence around the destination.
4. **Track at sea** — for cross-border shipments, the vessel's position and arrival are tracked via VesselAPI until the cargo reaches the destination port.

## Features

- Traffic-aware departure scheduling (3 auto-generated slots, scored with a transparent breakdown of traffic/delay/night penalties)
- Live TomTom map with route line + real-time position marker, for both truck legs and vessel crossings
- Driver GPS tracking with automatic 100m-radius arrival validation
- Vessel tracking via VesselAPI (MMSI/IMO), with live position and arrival detection
- CO2 emissions calculator per truck and per trip
- In-app notifications (trip assigned, checkpoint reached, delivery completed)
- Truck, driver/admin, company, and port management
- Role-based dashboards: a full operations view for admins, a focused trip-execution view for drivers
- Trip history and analytics dashboard

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Laravel 12 (PHP 8.2), Sanctum auth, `l5-swagger` for API docs |
| Frontend | React 19 + Vite, React Router, Tailwind CSS, GSAP, Recharts |
| Database | PostgreSQL (Supabase) |
| Maps & routing | TomTom Maps SDK + Routing API (live traffic) |
| Vessel tracking | VesselAPI (AIS position, port events) |
| Deployment | Frontend on Vercel, backend on IIS |

## Project structure

```
backend/     Laravel API (routes, controllers, models, migrations, seeders)
frontend/    React SPA (Vite) — admin dashboard + driver dashboard
```

## Getting started

### Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Fill in `.env`:
- `DB_*` — Supabase Postgres credentials (use the **connection pooler** host, session mode, port 5432 — the direct host is IPv6-only)
- `TOMTOM_API_KEY` — from [developer.tomtom.com](https://developer.tomtom.com), or use the hackathon judging key below
- `VESSELAPI_KEY` — from [vesselapi.com](https://vesselapi.com), or use the hackathon judging key below

> **For judges** — live keys so you can run the app without creating your own accounts. These will be rotated after the hackathon, do not reuse elsewhere:
> ```
> TOMTOM_API_KEY=g0LHKnMb1rkp4HIxFrjK88COHaAjGRw6
> VESSELAPI_KEY=d447b8e5ae6d09ce0b18306d489051c375a237ecb0b0c3aefa2212f6e3a07aa9
> ```

```bash
php artisan migrate:fresh --seed
php artisan l5-swagger:generate
php artisan serve
```

API docs available at `/api/documentation` once running.

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:
```
VITE_API_BASE_URL=http://localhost:8000
VITE_TOMTOM_API_KEY=g0LHKnMb1rkp4HIxFrjK88COHaAjGRw6
```

> Same hackathon judging key as above — for map rendering/routing in the browser.

```bash
npm run dev
```

## Demo credentials

Seeded by `php artisan db:seed`:

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin` |
| Driver | `driver` | `driver` |

## Team

Politeknik Negeri Batam Hackathon · **Team Kabocha**
